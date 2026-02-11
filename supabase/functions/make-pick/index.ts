import { getCorsHeaders, handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import {
  UUID_RE,
  errorResponse,
  requirePost,
  requireJson,
  timingSafeEqual,
} from '../_shared/validation.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { logAudit, getClientIp } from '../_shared/audit.ts'
import { authenticateManager } from '../_shared/auth.ts'
import { getCurrentCaptainId } from '../_shared/draftOrder.ts'
import { rollbackPick, advanceLeague } from '../_shared/draftHelpers.ts'
import type { MakePickRequest, Captain, League } from '../_shared/types.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Verify the requested captain is the one whose turn it is. */
function verifyTurn(
  league: League,
  captainId: string
): { expectedCaptain: Captain } | { error: string } {
  const expectedId = getCurrentCaptainId(
    league.captains,
    league.current_pick_index,
    league.draft_type as 'snake' | 'round_robin'
  )
  const sorted = [...league.captains].sort(
    (a: Captain, b: Captain) => a.draft_position - b.draft_position
  )
  const expectedCaptain = sorted.find((c) => c.id === expectedId)

  if (!expectedCaptain || expectedCaptain.id !== captainId) {
    return { error: 'Not your turn to pick' }
  }
  return { expectedCaptain }
}

/** Count remaining available players (excluding drafted and captain-linked). */
async function countRemainingPlayers(
  supabase: SupabaseClient,
  leagueId: string,
  captains: Captain[]
): Promise<number> {
  // NOTE: Keep in sync with getAvailablePlayers() in src/lib/draft.ts
  const captainPlayerIds = captains
    .filter((c: Captain) => c.player_id && UUID_RE.test(c.player_id))
    .map((c: Captain) => c.player_id!)

  let query = supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('league_id', leagueId)
    .is('drafted_by_captain_id', null)

  if (captainPlayerIds.length > 0) {
    query = query.not('id', 'in', `(${captainPlayerIds.join(',')})`)
  }

  const { count } = await query
  return count ?? 0
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const methodResponse = requirePost(req)
  if (methodResponse) return methodResponse

  const jsonResponse = requireJson(req)
  if (jsonResponse) return jsonResponse

  const rateLimitResponse = rateLimit(req, { windowMs: 60_000, maxRequests: 30 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { leagueId, captainId, playerId, captainToken }: MakePickRequest = await req.json()

    if (!leagueId || !captainId || !playerId) {
      return errorResponse('Missing required fields', 400, req)
    }

    if (!UUID_RE.test(leagueId) || !UUID_RE.test(captainId) || !UUID_RE.test(playerId)) {
      return errorResponse('Invalid field format', 400, req)
    }

    const supabaseAdmin = createAdminClient()

    // Get the league and verify status
    const { data: league, error: leagueError } = await supabaseAdmin
      .from('leagues')
      .select(
        'id, status, draft_type, current_pick_index, current_pick_started_at, time_limit_seconds, captains(id, name, draft_position, player_id, access_token, auto_pick_enabled)'
      )
      .eq('id', leagueId)
      .single()

    if (leagueError || !league) {
      return errorResponse('League not found', 404, req)
    }

    if (league.status !== 'in_progress') {
      return errorResponse('Draft is not in progress', 400, req)
    }

    // Auth: captain token OR manager JWT required
    if (captainToken) {
      const captain = (league as League).captains.find(
        (c: Captain) => c.id === captainId && timingSafeEqual(c.access_token, captainToken)
      )
      if (!captain) {
        return errorResponse('Invalid captain token', 403, req)
      }
    } else {
      const authResult = await authenticateManager(req, leagueId, supabaseAdmin)
      if (authResult instanceof Response) return authResult
    }

    // Verify it's this captain's turn
    const turnResult = verifyTurn(league as League, captainId)
    if ('error' in turnResult) {
      return errorResponse(turnResult.error, 400, req)
    }
    const { expectedCaptain } = turnResult

    // Verify player is available (not drafted and not linked to a captain)
    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .select('id, name')
      .eq('id', playerId)
      .eq('league_id', leagueId)
      .is('drafted_by_captain_id', null)
      .single()

    if (playerError || !player) {
      return errorResponse('Player not available', 400, req)
    }

    // Reject captain-linked players (they are on teams already as captains)
    // NOTE: Keep in sync with getAvailablePlayers() in src/lib/draft.ts
    const isCaptainPlayer = league.captains.some((c: Captain) => c.player_id === playerId)
    if (isCaptainPlayer) {
      return errorResponse('Cannot draft a captain', 400, req)
    }

    const pickNumber = league.current_pick_index + 1

    // Insert draft pick
    const { error: pickError } = await supabaseAdmin.from('draft_picks').insert({
      league_id: leagueId,
      captain_id: captainId,
      player_id: playerId,
      pick_number: pickNumber,
      is_auto_pick: false,
    })

    if (pickError) {
      if (pickError.code === '23505') {
        console.warn(`[make-pick] Duplicate pick detected for pick_number ${pickNumber}`)
        return new Response(JSON.stringify({ error: 'Pick already made by another player' }), {
          status: 409,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
      console.error('Failed to insert pick:', pickError)
      return errorResponse('Failed to record pick', 500, req)
    }

    // Update player
    const { error: updatePlayerError } = await supabaseAdmin
      .from('players')
      .update({ drafted_by_captain_id: captainId, draft_pick_number: pickNumber })
      .eq('id', playerId)

    if (updatePlayerError) {
      console.error('Failed to update player, rolling back pick:', updatePlayerError)
      await rollbackPick(supabaseAdmin, leagueId, pickNumber, playerId, false)
      return errorResponse('Failed to update player', 500, req)
    }

    // Clean up: Remove picked player from ALL captain queues
    const { error: cleanupError } = await supabaseAdmin
      .from('captain_draft_queues')
      .delete()
      .eq('player_id', playerId)

    if (cleanupError) {
      console.error('Queue cleanup error:', cleanupError)
    }

    // Reset consecutive timeout counter on manual pick
    const { error: resetError } = await supabaseAdmin
      .from('captains')
      .update({ consecutive_timeout_picks: 0 })
      .eq('id', captainId)

    if (resetError) {
      console.error('[make-pick] Failed to reset timeout counter:', resetError)
    }

    // Check completion and advance
    const remainingCount = await countRemainingPlayers(supabaseAdmin, leagueId, league.captains)
    const isComplete = remainingCount <= 0

    const advanceResult = await advanceLeague(
      supabaseAdmin,
      leagueId,
      league.current_pick_index,
      isComplete
    )

    if (!advanceResult.success) {
      if (advanceResult.error) {
        console.error('Failed to update league, rolling back:', advanceResult.error)
      } else {
        console.error(`[make-pick] Optimistic lock failed: current_pick_index changed since read`)
      }
      await rollbackPick(supabaseAdmin, leagueId, pickNumber, playerId, true)
      return advanceResult.error
        ? errorResponse('Failed to update league', 500, req)
        : errorResponse('Draft state changed concurrently. Please try again.', 409, req)
    }

    logAudit(supabaseAdmin, {
      action: 'pick_made',
      leagueId,
      actorType: captainToken ? 'captain' : 'manager',
      actorId: captainToken ? captainId : undefined,
      metadata: {
        pickNumber,
        playerId,
        playerName: player.name,
        captainId,
        captainName: expectedCaptain.name,
        isComplete,
      },
      ipAddress: getClientIp(req),
    })

    return new Response(
      JSON.stringify({
        success: true,
        pick: { player: player.name, captain: expectedCaptain.name, pickNumber },
        isComplete,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Make pick error:', error)
    return errorResponse('Internal server error', 500, req)
  }
})
