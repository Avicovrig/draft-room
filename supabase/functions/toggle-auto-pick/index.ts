import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { captainId, enabled, captainToken } = await req.json()

    if (!captainId || enabled === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Get the captain to validate token
    const { data: captain, error: captainError } = await supabaseAdmin
      .from('captains')
      .select('*')
      .eq('id', captainId)
      .single()

    if (captainError || !captain) {
      return new Response(
        JSON.stringify({ error: 'Captain not found' }),
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

    // Update the captain's auto_pick_enabled setting
    const { error: updateError } = await supabaseAdmin
      .from('captains')
      .update({ auto_pick_enabled: enabled })
      .eq('id', captainId)

    if (updateError) {
      console.error('Failed to update auto_pick_enabled:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update setting' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        captainId,
        auto_pick_enabled: enabled,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Toggle auto-pick error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
