import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { UUID_RE, errorResponse } from '../_shared/validation.ts'

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/
const MAX_TEAM_NAME_LENGTH = 50

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const { captainId, captainToken, leagueId, color, teamName, teamPhotoUrl } = await req.json()

    if (!captainId || !leagueId) {
      return errorResponse('Missing required fields', 400)
    }

    if (!UUID_RE.test(captainId) || !UUID_RE.test(leagueId)) {
      return errorResponse('Invalid field format', 400)
    }

    // At least one field to update must be provided
    if (color === undefined && teamName === undefined && teamPhotoUrl === undefined) {
      return errorResponse('No fields to update', 400)
    }

    // Validate color if provided
    if (color !== undefined && color !== null && !HEX_COLOR_RE.test(color)) {
      return errorResponse('Invalid color format. Must be a hex color like #FF0000', 400)
    }

    // Validate team name if provided
    if (teamName !== undefined && teamName !== null && typeof teamName === 'string' && teamName.length > MAX_TEAM_NAME_LENGTH) {
      return errorResponse(`Team name exceeds maximum length of ${MAX_TEAM_NAME_LENGTH} characters`, 400)
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

    // Build update object dynamically
    const updateFields: Record<string, unknown> = {}
    if (color !== undefined) updateFields.team_color = color
    if (teamName !== undefined) updateFields.team_name = teamName ? teamName.trim() : null
    if (teamPhotoUrl !== undefined) updateFields.team_photo_url = teamPhotoUrl || null

    const { error: updateError } = await supabaseAdmin
      .from('captains')
      .update(updateFields)
      .eq('id', captainId)

    if (updateError) {
      console.error('Failed to update captain:', updateError)
      return errorResponse('Failed to update captain', 500)
    }

    return new Response(
      JSON.stringify({
        success: true,
        captainId,
        ...updateFields,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Update captain error:', error)
    return errorResponse('Internal server error', 500)
  }
})
