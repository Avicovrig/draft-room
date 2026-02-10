// Supabase Edge Function for auto-pick
// - Called immediately when captain has auto_pick_enabled
// - Called when timer expires for captains without auto_pick_enabled
// Deploy with: supabase functions deploy auto-pick

import { getCorsHeaders, handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { UUID_RE, errorResponse, requirePost, requireJson, timingSafeEqual } from '../_shared/validation.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { logAudit, getClientIp } from '../_shared/audit.ts'
import { authenticateManager } from '../_shared/auth.ts'
import { getCurrentCaptainId, getAvailablePlayersServer } from '../_shared/draftOrder.ts'
import type { AutoPickRequest, Captain, Player, League } from '../_shared/types.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Roll back a recorded pick: delete the pick row and optionally reset the player. */
async function rollbackPick(
  supabase: SupabaseClient,
  leagueId: string,
  pickNumber: number,
  playerId: string,
  resetPlayer: boolean
): Promise<void> {
  const { error: rb1 } = await supabase.from('draft_picks').delete().eq('league_id', leagueId).eq('pick_number', pickNumber)
  if (rb1) console.error('CRITICAL: Rollback failed (delete pick):', { leagueId, pickNumber, rb1 })
  if (resetPlayer) {
    const { error: rb2 } = await supabase.from('players').update({ drafted_by_captain_id: null, draft_pick_number: null }).eq('id', playerId)
    if (rb2) console.error('CRITICAL: Rollback failed (reset player):', { leagueId, playerId, rb2 })
  }
}

/**
 * Returns a 200 response with an error field for expected race conditions.
 * Returns 200 (not 409) for race conditions: multiple clients calling simultaneously
 * is expected behavior. The first succeeds, others get 200 + {error: "Pick already made"}.
 */
function raceConditionResponse(req: Request, body: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify(body),
    { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
  )
}

/** Validate that the timer has expired (with grace period). Skips check for auto-pick captains. */
function validateTimer(
  league: League,
  captain: Captain | undefined
): { expired: true } | { error: Record<string, unknown> } {
  if (captain?.auto_pick_enabled) {
    return { expired: true }
  }

  const GRACE_PERIOD_SECONDS = 2
  if (league.current_pick_started_at) {
    const startTime = new Date(league.current_pick_started_at).getTime()
    const elapsed = (Date.now() - startTime) / 1000
    const effectiveTimeLimit = league.time_limit_seconds - GRACE_PERIOD_SECONDS

    if (elapsed < effectiveTimeLimit) {
      return {
        error: {
          error: 'Timer has not expired yet',
          elapsed: Math.round(elapsed),
          required: effectiveTimeLimit,
        },
      }
    }
  }
  return { expired: true }
}

/** Select a player from the captain's queue, or pick randomly. */
async function selectPlayer(
  supabase: SupabaseClient,
  captainId: string,
  availablePlayers: Player[]
): Promise<{ player: Player; fromQueue: boolean }> {
  const availableIds = new Set(availablePlayers.map((p) => p.id))

  const { data: queue } = await supabase
    .from('captain_draft_queues')
    .select('player_id')
    .eq('captain_id', captainId)
    .order('position', { ascending: true })

  if (queue && queue.length > 0) {
    for (const entry of queue) {
      if (availableIds.has(entry.player_id)) {
        const player = availablePlayers.find((p) => p.id === entry.player_id)!
        return { player, fromQueue: true }
      }
    }
  }

  const randomIndex = Math.floor(Math.random() * availablePlayers.length)
  const player = availablePlayers[randomIndex]
  return { player, fromQueue: false }
}

/** Advance the league to the next pick, or mark complete. Uses optimistic locking. */
async function advanceLeague(
  supabase: SupabaseClient,
  leagueId: string,
  currentPickIndex: number,
  isComplete: boolean
): Promise<{ success: boolean; error?: unknown }> {
  const { data, error } = await supabase
    .from('leagues')
    .update({
      status: isComplete ? 'completed' : 'in_progress',
      current_pick_index: isComplete ? currentPickIndex : currentPickIndex + 1,
      current_pick_started_at: isComplete ? null : new Date().toISOString(),
    })
    .eq('id', leagueId)
    .eq('current_pick_index', currentPickIndex)
    .select('id')

  if (error) return { success: false, error }
  if (!data || data.length === 0) return { success: false }
  return { success: true }
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
    const supabase = createAdminClient()

    const { leagueId, expectedPickIndex, captainToken }: AutoPickRequest = await req.json()

    if (!leagueId) {
      return errorResponse('leagueId is required', 400, req)
    }

    if (!UUID_RE.test(leagueId)) {
      return errorResponse('Invalid field format', 400, req)
    }

    // Get the league
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('*, captains(id, name, draft_position, player_id, access_token, auto_pick_enabled), players(id, name, drafted_by_captain_id)')
      .eq('id', leagueId)
      .single()

    if (leagueError || !league) {
      return errorResponse('League not found', 404, req)
    }

    if (league.status !== 'in_progress') {
      return errorResponse('Draft is not in progress', 400, req)
    }

    // Idempotency check: verify we're picking for the expected turn.
    // Design note: Returns HTTP 200 with an error field (not 4xx) for expected race
    // conditions. When multiple clients call simultaneously, the first succeeds and
    // others get 200 + {error: "Pick already made"}. The frontend handles this by
    // checking response.data.error for expected messages (see DraftBoard.tsx).
    if (expectedPickIndex !== undefined && expectedPickIndex !== league.current_pick_index) {
      return raceConditionResponse(req, {
        error: 'Pick already made',
        expectedPickIndex,
        actualPickIndex: league.current_pick_index,
      })
    }

    // Determine current captain
    const currentCaptainId = getCurrentCaptainId(
      league.captains,
      league.current_pick_index,
      league.draft_type as 'snake' | 'round_robin'
    )
    const currentCaptain = league.captains.find((c: Captain) => c.id === currentCaptainId)

    // Auth: captain token OR manager JWT required
    if (captainToken) {
      if (!currentCaptain || !timingSafeEqual(currentCaptain.access_token, captainToken)) {
        return errorResponse('Invalid captain token', 403, req)
      }
    } else {
      const authResult = await authenticateManager(req, leagueId, supabase)
      if (authResult instanceof Response) return authResult
    }

    // Timer validation
    const timerResult = validateTimer(league as League, currentCaptain)
    if ('error' in timerResult) {
      return raceConditionResponse(req, timerResult.error)
    }

    // Get available players
    const availablePlayers = getAvailablePlayersServer(league.players, league.captains)

    if (availablePlayers.length === 0) {
      return errorResponse('No available players', 400, req)
    }

    // Select player (from queue or random)
    const { player: selectedPlayer, fromQueue: selectedFromQueue } = await selectPlayer(
      supabase,
      currentCaptainId!,
      availablePlayers
    )

    const pickNumber = league.current_pick_index + 1

    // Insert draft pick
    const { error: pickError } = await supabase.from('draft_picks').insert({
      league_id: leagueId,
      captain_id: currentCaptainId,
      player_id: selectedPlayer.id,
      pick_number: pickNumber,
      is_auto_pick: true,
    })

    if (pickError) {
      if (pickError.code === '23505') {
        return raceConditionResponse(req, { error: 'Pick already made', pickNumber })
      }
      throw pickError
    }

    // Update player
    const { error: playerError } = await supabase
      .from('players')
      .update({ drafted_by_captain_id: currentCaptainId, draft_pick_number: pickNumber })
      .eq('id', selectedPlayer.id)

    if (playerError) {
      console.error('[auto-pick] Failed to update player, rolling back pick:', playerError)
      await rollbackPick(supabase, leagueId, pickNumber, selectedPlayer.id, false)
      throw playerError
    }

    // Clean up: Remove picked player from ALL captain queues
    const { error: cleanupError } = await supabase
      .from('captain_draft_queues')
      .delete()
      .eq('player_id', selectedPlayer.id)

    if (cleanupError) {
      console.error('[auto-pick] Queue cleanup error:', cleanupError)
    }

    // Check completion and advance
    const isComplete = availablePlayers.length === 1

    const advanceResult = await advanceLeague(supabase, leagueId, league.current_pick_index, isComplete)

    if (!advanceResult.success) {
      if (advanceResult.error) {
        console.error('[auto-pick] Failed to update league, rolling back:', advanceResult.error)
      } else {
        console.error(`[auto-pick] Optimistic lock failed: current_pick_index changed since read`)
      }
      await rollbackPick(supabase, leagueId, pickNumber, selectedPlayer.id, true)
      if (advanceResult.error) throw advanceResult.error
      return raceConditionResponse(req, { error: 'Draft state changed concurrently' })
    }

    logAudit(supabase, {
      action: 'auto_pick_made',
      leagueId,
      actorType: 'system',
      metadata: {
        pickNumber,
        playerId: selectedPlayer.id,
        playerName: selectedPlayer.name,
        captainId: currentCaptainId,
        captainName: currentCaptain?.name,
        isComplete,
        fromQueue: selectedFromQueue,
      },
      ipAddress: getClientIp(req),
    })

    return new Response(
      JSON.stringify({
        success: true,
        pick: {
          player: selectedPlayer.name,
          captain: currentCaptain?.name,
          pickNumber,
          isComplete,
        },
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Auto-pick error:', error)
    return errorResponse('Internal server error', 500, req)
  }
})
