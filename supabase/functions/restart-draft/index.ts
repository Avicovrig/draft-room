import { getCorsHeaders, handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { UUID_RE, errorResponse, requirePost, requireJson } from '../_shared/validation.ts'
import { authenticateManager } from '../_shared/auth.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { logAudit, getClientIp } from '../_shared/audit.ts'

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const methodResponse = requirePost(req)
  if (methodResponse) return methodResponse

  const jsonResponse = requireJson(req)
  if (jsonResponse) return jsonResponse

  const rateLimitResponse = rateLimit(req, { windowMs: 60_000, maxRequests: 5 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { leagueId } = await req.json()

    if (!leagueId) {
      return errorResponse('Missing required fields', 400, req)
    }

    if (!UUID_RE.test(leagueId)) {
      return errorResponse('Invalid field format', 400, req)
    }

    const supabaseAdmin = createAdminClient()

    const authResult = await authenticateManager(req, leagueId, supabaseAdmin)
    if (authResult instanceof Response) return authResult
    const { user, league } = authResult

    if (league.status !== 'paused') {
      return errorResponse('Draft must be paused to restart', 400, req)
    }

    // Snapshot draft picks before deleting (for rollback)
    const { data: existingPicks } = await supabaseAdmin
      .from('draft_picks')
      .select('*')
      .eq('league_id', leagueId)

    // Snapshot drafted players (for rollback)
    const { data: draftedPlayers } = await supabaseAdmin
      .from('players')
      .select('id, drafted_by_captain_id, draft_pick_number')
      .eq('league_id', leagueId)
      .not('drafted_by_captain_id', 'is', null)

    // Step 1: Delete all draft picks
    const { error: deletePicksError } = await supabaseAdmin
      .from('draft_picks')
      .delete()
      .eq('league_id', leagueId)

    if (deletePicksError) {
      console.error('Failed to delete draft picks:', deletePicksError)
      return errorResponse('Failed to restart draft', 500, req)
    }

    // Step 2: Reset all players' draft status
    const { error: resetPlayersError } = await supabaseAdmin
      .from('players')
      .update({ drafted_by_captain_id: null, draft_pick_number: null })
      .eq('league_id', leagueId)

    if (resetPlayersError) {
      console.error('Failed to reset players, rolling back picks:', resetPlayersError)
      // Rollback: re-insert deleted picks
      if (existingPicks && existingPicks.length > 0) {
        const { error: rbErr } = await supabaseAdmin.from('draft_picks').insert(existingPicks)
        if (rbErr)
          console.error('CRITICAL: Rollback failed (re-insert picks):', { leagueId, rbErr })
      }
      return errorResponse('Failed to reset players', 500, req)
    }

    // Step 2.5: Clear all captain draft queues and reset timeout counters
    const { data: captainsForCleanup } = await supabaseAdmin
      .from('captains')
      .select('id')
      .eq('league_id', leagueId)
    if (captainsForCleanup && captainsForCleanup.length > 0) {
      const captainIds = captainsForCleanup.map((c: { id: string }) => c.id)
      const { error: queueCleanupError } = await supabaseAdmin
        .from('captain_draft_queues')
        .delete()
        .in('captain_id', captainIds)
      if (queueCleanupError) {
        console.error('Failed to clear draft queues during restart:', queueCleanupError)
      }
    }

    // Reset consecutive timeout counters and auto-pick for all captains
    const { error: resetCaptainsError } = await supabaseAdmin
      .from('captains')
      .update({ consecutive_timeout_picks: 0, auto_pick_enabled: false })
      .eq('league_id', leagueId)
    if (resetCaptainsError) {
      console.error('Failed to reset captain timeout counters during restart:', resetCaptainsError)
    }

    // Step 3: Reset league status
    const { error: updateLeagueError } = await supabaseAdmin
      .from('leagues')
      .update({
        status: 'not_started',
        current_pick_index: 0,
        current_pick_started_at: null,
      })
      .eq('id', leagueId)

    if (updateLeagueError) {
      console.error('Failed to update league, rolling back:', updateLeagueError)
      // Rollback: restore drafted players and picks
      if (draftedPlayers && draftedPlayers.length > 0) {
        const results = await Promise.allSettled(
          draftedPlayers.map((p) =>
            supabaseAdmin
              .from('players')
              .update({
                drafted_by_captain_id: p.drafted_by_captain_id,
                draft_pick_number: p.draft_pick_number,
              })
              .eq('id', p.id)
          )
        )
        results.forEach((result, i) => {
          if (result.status === 'rejected') {
            console.error('CRITICAL: Rollback failed (restore player):', {
              playerId: draftedPlayers[i].id,
              error: result.reason,
            })
          } else if (result.value.error) {
            console.error('CRITICAL: Rollback failed (restore player):', {
              playerId: draftedPlayers[i].id,
              error: result.value.error,
            })
          }
        })
      }
      if (existingPicks && existingPicks.length > 0) {
        const { error: rbErr } = await supabaseAdmin.from('draft_picks').insert(existingPicks)
        if (rbErr)
          console.error('CRITICAL: Rollback failed (re-insert picks):', { leagueId, rbErr })
      }
      return errorResponse('Failed to update league', 500, req)
    }

    logAudit(supabaseAdmin, {
      action: 'draft_restarted',
      leagueId,
      actorType: 'manager',
      actorId: user.id,
      ipAddress: getClientIp(req),
    })

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Restart draft error:', error)
    return errorResponse('Internal server error', 500, req)
  }
})
