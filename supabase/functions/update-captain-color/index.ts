import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { captainId, captainToken, leagueId, color } = await req.json()

    if (!captainId || !leagueId || !color) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!UUID_RE.test(captainId) || !UUID_RE.test(leagueId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid field format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!HEX_COLOR_RE.test(color)) {
      return new Response(
        JSON.stringify({ error: 'Invalid color format. Must be a hex color like #FF0000' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Get the captain and verify it belongs to the specified league
    const { data: captain, error: captainError } = await supabaseAdmin
      .from('captains')
      .select('*')
      .eq('id', captainId)
      .eq('league_id', leagueId)
      .single()

    if (captainError || !captain) {
      return new Response(
        JSON.stringify({ error: 'Captain not found in this league' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate captain token if provided
    if (captainToken && captain.access_token !== captainToken) {
      return new Response(
        JSON.stringify({ error: 'Invalid captain token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update the captain's team color
    const { error: updateError } = await supabaseAdmin
      .from('captains')
      .update({ team_color: color })
      .eq('id', captainId)

    if (updateError) {
      console.error('Failed to update team_color:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update team color' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        captainId,
        team_color: color,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Update captain color error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
