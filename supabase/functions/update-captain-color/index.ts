import { getCorsHeaders, handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { UUID_RE, errorResponse, validateUrl } from '../_shared/validation.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { logAudit, getClientIp } from '../_shared/audit.ts'
import { authenticateManager } from '../_shared/auth.ts'
import type { UpdateCaptainColorRequest } from '../_shared/types.ts'

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/
const MAX_TEAM_NAME_LENGTH = 50

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const rateLimitResponse = rateLimit(req, { windowMs: 60_000, maxRequests: 10 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { captainId, captainToken, leagueId, color, teamName, teamPhotoUrl }: UpdateCaptainColorRequest = await req.json()

    if (!captainId || !leagueId) {
      return errorResponse('Missing required fields', 400, req)
    }

    if (!UUID_RE.test(captainId) || !UUID_RE.test(leagueId)) {
      return errorResponse('Invalid field format', 400, req)
    }

    // At least one field to update must be provided
    if (color === undefined && teamName === undefined && teamPhotoUrl === undefined) {
      return errorResponse('No fields to update', 400, req)
    }

    // Validate color if provided
    if (color !== undefined && color !== null && !HEX_COLOR_RE.test(color)) {
      return errorResponse('Invalid color format. Must be a hex color like #FF0000', 400, req)
    }

    // Validate team name if provided
    if (teamName !== undefined && teamName !== null && typeof teamName === 'string' && teamName.length > MAX_TEAM_NAME_LENGTH) {
      return errorResponse(`Team name exceeds maximum length of ${MAX_TEAM_NAME_LENGTH} characters`, 400, req)
    }

    // Validate team photo URL protocol
    if (teamPhotoUrl && !validateUrl(teamPhotoUrl)) {
      return errorResponse('Invalid team photo URL', 400, req)
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
      return errorResponse('Captain not found in this league', 404, req)
    }

    // Auth: captain token OR manager JWT required
    if (captainToken) {
      if (captain.access_token !== captainToken) {
        return errorResponse('Invalid captain token', 403, req)
      }
    } else {
      const authResult = await authenticateManager(req, leagueId)
      if (authResult instanceof Response) return authResult
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
      return errorResponse('Failed to update captain', 500, req)
    }

    logAudit(supabaseAdmin, {
      action: 'captain_updated',
      leagueId,
      actorType: captainToken ? 'captain' : 'manager',
      actorId: captainId,
      metadata: updateFields,
      ipAddress: getClientIp(req),
    })

    return new Response(
      JSON.stringify({
        success: true,
        captainId,
        ...updateFields,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Update captain error:', error)
    return errorResponse('Internal server error', 500, req)
  }
})
