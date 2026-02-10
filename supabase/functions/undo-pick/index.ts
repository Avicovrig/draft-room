import { getCorsHeaders, handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { UUID_RE, errorResponse } from '../_shared/validation.ts'
import { authenticateManager } from '../_shared/auth.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { logAudit, getClientIp } from '../_shared/audit.ts'

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

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
    const expectedPickNumber = league.current_pick_index - 1
    const { data: picks, error: picksError } = await supabaseAdmin
      .from('draft_picks')
      .select('*')
      .eq('league_id', leagueId)
      .eq('pick_number', expectedPickNumber)
      .limit(1)

    if (picksError || !picks || picks.length === 0) {
      return errorResponse('No picks to undo (pick may have already been undone)', 400, req)
    }

    const lastPick = picks[0]

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
      // Roll back: re-insert the pick
      console.error('Failed to reset player, rolling back:', resetPlayerError)
      await supabaseAdmin.from('draft_picks').insert({
        id: lastPick.id,
        league_id: lastPick.league_id,
        captain_id: lastPick.captain_id,
        player_id: lastPick.player_id,
        pick_number: lastPick.pick_number,
        is_auto_pick: lastPick.is_auto_pick,
      })
      return errorResponse('Failed to reset player', 500, req)
    }

    // Decrement pick index and reset timer
    const { error: updateLeagueError } = await supabaseAdmin
      .from('leagues')
      .update({
        current_pick_index: league.current_pick_index - 1,
        current_pick_started_at: league.status === 'in_progress' ? new Date().toISOString() : null,
      })
      .eq('id', leagueId)

    if (updateLeagueError) {
      // Roll back: re-insert pick and re-update player
      console.error('Failed to update league, rolling back:', updateLeagueError)
      await supabaseAdmin.from('draft_picks').insert({
        id: lastPick.id,
        league_id: lastPick.league_id,
        captain_id: lastPick.captain_id,
        player_id: lastPick.player_id,
        pick_number: lastPick.pick_number,
        is_auto_pick: lastPick.is_auto_pick,
      })
      await supabaseAdmin.from('players').update({
        drafted_by_captain_id: lastPick.captain_id,
        draft_pick_number: lastPick.pick_number,
      }).eq('id', lastPick.player_id)
      return errorResponse('Failed to update league', 500, req)
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
