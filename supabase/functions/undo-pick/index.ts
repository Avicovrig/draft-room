import { getCorsHeaders, handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { UUID_RE, errorResponse, requirePost } from '../_shared/validation.ts'
import { authenticateManager } from '../_shared/auth.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { logAudit, getClientIp } from '../_shared/audit.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { DraftPick } from '../_shared/types.ts'

/** Re-insert a deleted pick and optionally restore the player's draft status. */
async function rollbackPick(
  supabaseAdmin: SupabaseClient,
  pick: DraftPick,
  restorePlayer: boolean
): Promise<void> {
  const { error: rb1 } = await supabaseAdmin.from('draft_picks').insert({
    id: pick.id,
    league_id: pick.league_id,
    captain_id: pick.captain_id,
    player_id: pick.player_id,
    pick_number: pick.pick_number,
    is_auto_pick: pick.is_auto_pick,
  })
  if (rb1) console.error('CRITICAL: Rollback failed (re-insert pick):', { pickId: pick.id, rb1 })

  if (restorePlayer) {
    const { error: rb2 } = await supabaseAdmin.from('players').update({
      drafted_by_captain_id: pick.captain_id,
      draft_pick_number: pick.pick_number,
    }).eq('id', pick.player_id)
    if (rb2) console.error('CRITICAL: Rollback failed (re-update player):', { playerId: pick.player_id, rb2 })
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const methodResponse = requirePost(req)
  if (methodResponse) return methodResponse

  const rateLimitResponse = rateLimit(req, { windowMs: 60_000, maxRequests: 10 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { leagueId } = await req.json()

    if (!leagueId) {
      return errorResponse('Missing required fields', 400, req)
    }

    if (!UUID_RE.test(leagueId)) {
      return errorResponse('Invalid field format', 400, req)
    }

    const authResult = await authenticateManager(req, leagueId)
    if (authResult instanceof Response) return authResult
    const { user, league } = authResult

    if (league.status !== 'in_progress' && league.status !== 'paused') {
      return errorResponse('Draft must be in progress or paused to undo', 400, req)
    }

    const supabaseAdmin = createAdminClient()

    if (league.current_pick_index <= 0) {
      return errorResponse('No picks to undo', 400, req)
    }

    // Find the last pick, verifying it matches the expected pick number.
    // This prevents race conditions where concurrent undo requests could
    // both try to undo the same pick.
    const expectedPickNumber = league.current_pick_index
    const { data: picks, error: picksError } = await supabaseAdmin
      .from('draft_picks')
      .select('*')
      .eq('league_id', leagueId)
      .eq('pick_number', expectedPickNumber)
      .limit(1)

    if (picksError || !picks || picks.length === 0) {
      return errorResponse('No picks to undo (pick may have already been undone)', 400, req)
    }

    const lastPick = picks[0] as DraftPick

    // Delete the draft pick
    const { error: deleteError } = await supabaseAdmin
      .from('draft_picks')
      .delete()
      .eq('id', lastPick.id)

    if (deleteError) {
      console.error('Failed to delete pick:', deleteError)
      return errorResponse('Failed to undo pick', 500, req)
    }

    // Reset the player's draft status
    const { error: resetPlayerError } = await supabaseAdmin
      .from('players')
      .update({ drafted_by_captain_id: null, draft_pick_number: null })
      .eq('id', lastPick.player_id)

    if (resetPlayerError) {
      console.error('Failed to reset player, rolling back:', resetPlayerError)
      await rollbackPick(supabaseAdmin, lastPick, false)
      return errorResponse('Failed to reset player', 500, req)
    }

    // Decrement pick index and reset timer (with optimistic lock to prevent desync)
    const { data: updatedLeague, error: updateLeagueError } = await supabaseAdmin
      .from('leagues')
      .update({
        current_pick_index: league.current_pick_index - 1,
        current_pick_started_at: league.status === 'in_progress' ? new Date().toISOString() : null,
      })
      .eq('id', leagueId)
      .eq('current_pick_index', league.current_pick_index)
      .select('id')

    if (updateLeagueError) {
      console.error('Failed to update league, rolling back:', updateLeagueError)
      await rollbackPick(supabaseAdmin, lastPick, true)
      return errorResponse('Failed to update league', 500, req)
    }

    // Optimistic lock: if no rows matched, a concurrent operation changed the pick index
    if (!updatedLeague || updatedLeague.length === 0) {
      console.error('[undo-pick] Optimistic lock failed: current_pick_index changed since read')
      await rollbackPick(supabaseAdmin, lastPick, true)
      return errorResponse('Draft state changed concurrently. Please try again.', 409, req)
    }

    logAudit(supabaseAdmin, {
      action: 'pick_undone',
      leagueId,
      actorType: 'manager',
      actorId: user.id,
      metadata: {
        pickNumber: lastPick.pick_number,
        playerId: lastPick.player_id,
        captainId: lastPick.captain_id,
      },
      ipAddress: getClientIp(req),
    })

    return new Response(
      JSON.stringify({ success: true, undonePick: lastPick.pick_number }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Undo pick error:', error)
    return errorResponse('Internal server error', 500, req)
  }
})
