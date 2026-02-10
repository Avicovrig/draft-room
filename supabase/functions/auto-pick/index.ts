// Supabase Edge Function for auto-pick
// - Called immediately when captain has auto_pick_enabled
// - Called when timer expires for captains without auto_pick_enabled
// Deploy with: supabase functions deploy auto-pick

import { getCorsHeaders, handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { UUID_RE, errorResponse } from '../_shared/validation.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { logAudit, getClientIp } from '../_shared/audit.ts'
import type { AutoPickRequest, Captain, Player } from '../_shared/types.ts'

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const rateLimitResponse = rateLimit(req, { windowMs: 60_000, maxRequests: 30 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const supabase = createAdminClient()

    const { leagueId, expectedPickIndex }: AutoPickRequest = await req.json()

    if (!leagueId) {
      return errorResponse('leagueId is required', 400, req)
    }

    if (!UUID_RE.test(leagueId)) {
      return errorResponse('Invalid field format', 400, req)
    }

    console.log(`[auto-pick] Request for league ${leagueId}, expectedPickIndex: ${expectedPickIndex}`)

    // Get the league
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('*, captains(*), players(*)')
      .eq('id', leagueId)
      .single()

    if (leagueError || !league) {
      return errorResponse('League not found', 404, req)
    }

    // Check if draft is in progress
    if (league.status !== 'in_progress') {
      console.log(`[auto-pick] Draft not in progress, status: ${league.status}`)
      return errorResponse('Draft is not in progress', 400, req)
    }

    // Idempotency check: verify we're picking for the expected turn.
    // Design note: Returns HTTP 200 with an error field (not 4xx) for expected race
    // conditions. When multiple clients call simultaneously, the first succeeds and
    // others get 200 + {error: "Pick already made"}. The frontend handles this by
    // checking response.data.error for expected messages (see DraftBoard.tsx).
    if (expectedPickIndex !== undefined && expectedPickIndex !== league.current_pick_index) {
      console.log(`[auto-pick] Pick index mismatch: expected ${expectedPickIndex}, actual ${league.current_pick_index}`)
      return new Response(
        JSON.stringify({
          error: 'Pick already made',
          expectedPickIndex,
          actualPickIndex: league.current_pick_index
        }),
        { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Get current captain first (needed to check auto_pick_enabled for timer validation)
    const sortedCaptains = [...league.captains].sort(
      (a: Captain, b: Captain) => a.draft_position - b.draft_position
    )
    const captainIds = sortedCaptains.map((c: Captain) => c.id)
    const captainCount = captainIds.length
    const currentRound = Math.floor(league.current_pick_index / captainCount)
    const positionInRound = league.current_pick_index % captainCount

    // Snake draft logic
    const isReversedRound = league.draft_type === 'snake' && currentRound % 2 === 1
    const orderForRound = isReversedRound ? [...captainIds].reverse() : captainIds
    const currentCaptainId = orderForRound[positionInRound]
    const currentCaptain = sortedCaptains.find((c: Captain) => c.id === currentCaptainId)

    // Timer validation - skip if captain has auto_pick_enabled (immediate pick)
    // Only validate timer for captains who don't have auto-pick enabled
    if (!currentCaptain?.auto_pick_enabled) {
      const GRACE_PERIOD_SECONDS = 2
      if (league.current_pick_started_at) {
        const startTime = new Date(league.current_pick_started_at).getTime()
        const elapsed = (Date.now() - startTime) / 1000
        const effectiveTimeLimit = league.time_limit_seconds - GRACE_PERIOD_SECONDS

        if (elapsed < effectiveTimeLimit) {
          console.log(`[auto-pick] Timer not expired: ${elapsed}s elapsed, need ${effectiveTimeLimit}s`)
          // Returns 200 with error field for expected race condition (see design note above)
          return new Response(
            JSON.stringify({
              error: 'Timer has not expired yet',
              elapsed: Math.round(elapsed),
              required: effectiveTimeLimit
            }),
            { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
          )
        }
      }
    } else {
      console.log(`[auto-pick] Captain ${currentCaptain.name} has auto_pick_enabled, skipping timer validation`)
    }

    // Get available players (exclude drafted and captain-linked players)
    // NOTE: Keep in sync with getAvailablePlayers() in src/lib/draft.ts
    const captainPlayerIds = new Set(
      league.captains
        .filter((c: Captain) => c.player_id)
        .map((c: Captain) => c.player_id!)
    )
    const availablePlayers = league.players.filter(
      (p: Player) => !p.drafted_by_captain_id && !captainPlayerIds.has(p.id)
    )

    if (availablePlayers.length === 0) {
      return errorResponse('No available players', 400, req)
    }

    // Determine which player to pick
    // Always check the captain's queue first, then fall back to random
    let selectedPlayer
    const availablePlayerIds = new Set(availablePlayers.map((p: Player) => p.id))

    // Get captain's queue ordered by position
    console.log(`[auto-pick] Checking queue for captain ${currentCaptain?.name}`)
    const { data: queue } = await supabase
      .from('captain_draft_queues')
      .select('player_id')
      .eq('captain_id', currentCaptainId)
      .order('position', { ascending: true })

    if (queue && queue.length > 0) {
      // Find first available player from queue
      for (const queueEntry of queue) {
        if (availablePlayerIds.has(queueEntry.player_id)) {
          selectedPlayer = availablePlayers.find((p: Player) => p.id === queueEntry.player_id)
          console.log(`[auto-pick] Selected from queue: ${selectedPlayer?.name}`)
          break
        }
      }
    }

    // If no player selected from queue, pick random
    if (!selectedPlayer) {
      const randomIndex = Math.floor(Math.random() * availablePlayers.length)
      selectedPlayer = availablePlayers[randomIndex]
      console.log(`[auto-pick] Selected random: ${selectedPlayer.name}`)
    }

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
      // Check for unique constraint violation (another client already made this pick)
      if (pickError.code === '23505') {
        // Returns 200 with error field for expected race condition (see design note above)
        console.log(`[auto-pick] Duplicate pick detected for pick_number ${pickNumber}`)
        return new Response(
          JSON.stringify({
            error: 'Pick already made',
            pickNumber,
          }),
          { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        )
      }
      throw pickError
    }

    // Update player
    const { error: playerError } = await supabase
      .from('players')
      .update({
        drafted_by_captain_id: currentCaptainId,
        draft_pick_number: pickNumber,
      })
      .eq('id', selectedPlayer.id)

    if (playerError) {
      // Roll back the pick insert to avoid inconsistent state
      console.error('[auto-pick] Failed to update player, rolling back pick:', playerError)
      await supabase.from('draft_picks').delete().eq('league_id', leagueId).eq('pick_number', pickNumber)
      throw playerError
    }

    // Clean up: Remove picked player from ALL captain queues
    const { error: cleanupError } = await supabase
      .from('captain_draft_queues')
      .delete()
      .eq('player_id', selectedPlayer.id)

    if (cleanupError) {
      // Log but don't fail the pick - cleanup is not critical
      console.error('[auto-pick] Queue cleanup error:', cleanupError)
    }

    // Check if draft is complete
    const isComplete = availablePlayers.length === 1

    // Update league
    const { error: updateError } = await supabase
      .from('leagues')
      .update({
        status: isComplete ? 'completed' : 'in_progress',
        current_pick_index: isComplete ? league.current_pick_index : league.current_pick_index + 1,
        current_pick_started_at: isComplete ? null : new Date().toISOString(),
      })
      .eq('id', leagueId)

    if (updateError) {
      // Roll back pick and player update to avoid inconsistent state
      console.error('[auto-pick] Failed to update league, rolling back:', updateError)
      await supabase.from('draft_picks').delete().eq('league_id', leagueId).eq('pick_number', pickNumber)
      await supabase.from('players').update({ drafted_by_captain_id: null, draft_pick_number: null }).eq('id', selectedPlayer.id)
      throw updateError
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
        fromQueue: !!selectedPlayer,
      },
      ipAddress: getClientIp(req),
    })

    return new Response(
      JSON.stringify({
        success: true,
        pick: {
          player: selectedPlayer.name,
          captain: sortedCaptains.find((c: Captain) => c.id === currentCaptainId)?.name,
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
