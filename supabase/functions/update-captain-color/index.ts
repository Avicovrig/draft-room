import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { UUID_RE, errorResponse } from '../_shared/validation.ts'

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { captainId, captainToken, leagueId, color } = await req.json()

    if (!captainId || !leagueId || !color) {
      return errorResponse('Missing required fields', 400)
    }

    if (!UUID_RE.test(captainId) || !UUID_RE.test(leagueId)) {
      return errorResponse('Invalid field format', 400)
    }

    if (!HEX_COLOR_RE.test(color)) {
      return errorResponse('Invalid color format. Must be a hex color like #FF0000', 400)
    }

    const supabaseAdmin = createAdminClient()

    // Get the captain and verify it belongs to the specified league
    const { data: captain, error: captainError } = await supabaseAdmin
      .from('captains')
      .select('*')
      .eq('id', captainId)
      .eq('league_id', leagueId)
      .single()

    if (captainError || !captain) {
      return errorResponse('Captain not found in this league', 404)
    }

    // Validate captain token if provided
    if (captainToken && captain.access_token !== captainToken) {
      return errorResponse('Invalid captain token', 403)
    }

    // Update the captain's team color
    const { error: updateError } = await supabaseAdmin
      .from('captains')
      .update({ team_color: color })
      .eq('id', captainId)

    if (updateError) {
      console.error('Failed to update team_color:', updateError)
      return errorResponse('Failed to update team color', 500)
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
    return errorResponse('Internal server error', 500)
  }
})
