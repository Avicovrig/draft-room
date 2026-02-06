import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { leagueId, captainId, playerId, captainToken } = await req.json()

    if (!leagueId || !captainId || !playerId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!UUID_RE.test(leagueId) || !UUID_RE.test(captainId) || !UUID_RE.test(playerId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid field format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Get the league and verify status
    const { data: league, error: leagueError } = await supabaseAdmin
      .from('leagues')
      .select('*, captains(*)')
      .eq('id', leagueId)
      .single()

    if (leagueError || !league) {
      return new Response(
        JSON.stringify({ error: 'League not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (league.status !== 'in_progress') {
      return new Response(
        JSON.stringify({ error: 'Draft is not in progress' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate captain token if provided (for non-manager picks)
    if (captainToken) {
      const captain = league.captains.find((c: { id: string; access_token: string }) =>
        c.id === captainId && c.access_token === captainToken
      )
      if (!captain) {
        return new Response(
          JSON.stringify({ error: 'Invalid captain token' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Verify it's this captain's turn
    const sortedCaptains = [...league.captains].sort((a: { draft_position: number }, b: { draft_position: number }) =>
      a.draft_position - b.draft_position
    )
    const captainCount = sortedCaptains.length
    const pickIndex = league.current_pick_index

    let expectedCaptainIndex: number
    if (league.draft_type === 'snake') {
      const round = Math.floor(pickIndex / captainCount)
      const positionInRound = pickIndex % captainCount
      expectedCaptainIndex = round % 2 === 0 ? positionInRound : captainCount - 1 - positionInRound
    } else {
      expectedCaptainIndex = pickIndex % captainCount
    }

    const expectedCaptain = sortedCaptains[expectedCaptainIndex]
    if (expectedCaptain.id !== captainId) {
      return new Response(
        JSON.stringify({ error: 'Not your turn to pick' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify player is available
    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .select('*')
      .eq('id', playerId)
      .eq('league_id', leagueId)
      .is('drafted_by_captain_id', null)
      .single()

    if (playerError || !player) {
      return new Response(
        JSON.stringify({ error: 'Player not available' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const pickNumber = league.current_pick_index + 1

    // Insert draft pick
    const { error: pickError } = await supabaseAdmin
      .from('draft_picks')
      .insert({
        league_id: leagueId,
        captain_id: captainId,
        player_id: playerId,
        pick_number: pickNumber,
        is_auto_pick: false,
      })

    if (pickError) {
      // Check for unique constraint violation (race condition - pick already made)
      if (pickError.code === '23505') {
        console.log(`[make-pick] Duplicate pick detected for pick_number ${pickNumber}`)
        return new Response(
          JSON.stringify({ error: 'Pick already made by another player' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      console.error('Failed to insert pick:', pickError)
      return new Response(
        JSON.stringify({ error: 'Failed to record pick' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update player
    const { error: updatePlayerError } = await supabaseAdmin
      .from('players')
      .update({
        drafted_by_captain_id: captainId,
        draft_pick_number: pickNumber,
      })
      .eq('id', playerId)

    if (updatePlayerError) {
      // Roll back the pick insert to avoid inconsistent state
      console.error('Failed to update player, rolling back pick:', updatePlayerError)
      await supabaseAdmin.from('draft_picks').delete().eq('league_id', leagueId).eq('pick_number', pickNumber)
      return new Response(
        JSON.stringify({ error: 'Failed to update player' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Clean up: Remove picked player from ALL captain queues
    const { error: cleanupError } = await supabaseAdmin
      .from('captain_draft_queues')
      .delete()
      .eq('player_id', playerId)

    if (cleanupError) {
      // Log but don't fail the pick - cleanup is not critical
      console.error('Queue cleanup error:', cleanupError)
    }

    // Count remaining available players (exclude drafted and captain-linked players)
    // NOTE: Keep in sync with getAvailablePlayers() in src/lib/draft.ts
    const captainPlayerIds = league.captains
      .filter((c: { player_id: string | null }) => c.player_id)
      .map((c: { player_id: string }) => c.player_id)

    let query = supabaseAdmin
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', leagueId)
      .is('drafted_by_captain_id', null)

    if (captainPlayerIds.length > 0) {
      query = query.not('id', 'in', `(${captainPlayerIds.join(',')})`)
    }

    const { count: remainingCount } = await query
    const isComplete = (remainingCount ?? 0) <= 0

    // Update league
    const { error: updateLeagueError } = await supabaseAdmin
      .from('leagues')
      .update({
        status: isComplete ? 'completed' : 'in_progress',
        current_pick_index: isComplete ? league.current_pick_index : league.current_pick_index + 1,
        current_pick_started_at: isComplete ? null : new Date().toISOString(),
      })
      .eq('id', leagueId)

    if (updateLeagueError) {
      // Roll back pick and player update to avoid inconsistent state
      console.error('Failed to update league, rolling back:', updateLeagueError)
      await supabaseAdmin.from('draft_picks').delete().eq('league_id', leagueId).eq('pick_number', pickNumber)
      await supabaseAdmin.from('players').update({ drafted_by_captain_id: null, draft_pick_number: null }).eq('id', playerId)
      return new Response(
        JSON.stringify({ error: 'Failed to update league' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        pick: {
          player: player.name,
          captain: expectedCaptain.name,
          pickNumber,
        },
        isComplete,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Make pick error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
