import { getCorsHeaders, handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import {
  UUID_RE,
  errorResponse,
  validateUrl,
  requirePost,
  requireJson,
  timingSafeEqual,
  isValidJpeg,
  isValidHexColor,
  MAX_BASE64_BLOB_LENGTH,
  DANGEROUS_PATTERN,
} from '../_shared/validation.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { logAudit, getClientIp } from '../_shared/audit.ts'
import { authenticateManager } from '../_shared/auth.ts'
import type { UpdateCaptainColorRequest } from '../_shared/types.ts'

const MAX_TEAM_NAME_LENGTH = 50

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const methodResponse = requirePost(req)
  if (methodResponse) return methodResponse

  const jsonResponse = requireJson(req)
  if (jsonResponse) return jsonResponse

  const rateLimitResponse = rateLimit(req, { windowMs: 60_000, maxRequests: 10 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const {
      captainId,
      captainToken,
      leagueId,
      color,
      teamName,
      teamPhotoUrl,
      teamPhotoBlob,
    }: UpdateCaptainColorRequest = await req.json()

    if (!captainId || !leagueId) {
      return errorResponse('Missing required fields', 400, req)
    }

    if (!UUID_RE.test(captainId) || !UUID_RE.test(leagueId)) {
      return errorResponse('Invalid field format', 400, req)
    }

    // At least one field to update must be provided
    if (
      color === undefined &&
      teamName === undefined &&
      teamPhotoUrl === undefined &&
      !teamPhotoBlob
    ) {
      return errorResponse('No fields to update', 400, req)
    }

    // Validate color if provided
    if (color !== undefined && color !== null && !isValidHexColor(color)) {
      return errorResponse('Invalid color format. Must be a hex color like #FF0000', 400, req)
    }

    // Validate team name if provided
    if (teamName !== undefined && teamName !== null) {
      if (typeof teamName !== 'string') {
        return errorResponse('teamName must be a string', 400, req)
      }
      if (teamName.length > MAX_TEAM_NAME_LENGTH) {
        return errorResponse(
          `Team name exceeds maximum length of ${MAX_TEAM_NAME_LENGTH} characters`,
          400,
          req
        )
      }
      if (DANGEROUS_PATTERN.test(teamName)) {
        return errorResponse('Team name contains invalid characters', 400, req)
      }
    }

    // Validate team photo URL protocol
    if (teamPhotoUrl && !validateUrl(teamPhotoUrl)) {
      return errorResponse('Invalid team photo URL', 400, req)
    }

    // Validate base64 blob size (max ~2MB decoded ≈ ~2.7MB base64)
    if (teamPhotoBlob && teamPhotoBlob.length > MAX_BASE64_BLOB_LENGTH) {
      return errorResponse('Team photo exceeds maximum size', 400, req)
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
      if (!timingSafeEqual(captain.access_token, captainToken)) {
        return errorResponse('Invalid captain token', 403, req)
      }
    } else {
      const authResult = await authenticateManager(req, leagueId, supabaseAdmin)
      if (authResult instanceof Response) return authResult
    }

    // Handle base64 photo blob upload (used by captains who can't upload to storage directly)
    let resolvedPhotoUrl = teamPhotoUrl
    if (teamPhotoBlob) {
      let binaryData: Uint8Array
      try {
        binaryData = Uint8Array.from(atob(teamPhotoBlob), (c) => c.charCodeAt(0))
      } catch {
        return errorResponse('Invalid base64 encoding', 400, req)
      }
      if (!isValidJpeg(binaryData)) {
        return errorResponse('Invalid image format — must be JPEG', 400, req)
      }
      const filePath = `${leagueId}/team-${captainId}.jpg`
      const { error: uploadError } = await supabaseAdmin.storage
        .from('profile-pictures')
        .upload(filePath, binaryData, { upsert: true, contentType: 'image/jpeg' })

      if (uploadError) {
        console.error('Failed to upload team photo:', uploadError)
        return errorResponse('Failed to upload team photo', 500, req)
      }

      const { data: urlData } = supabaseAdmin.storage
        .from('profile-pictures')
        .getPublicUrl(filePath)

      resolvedPhotoUrl = `${urlData.publicUrl}?t=${Date.now()}`
    }

    // Build update object dynamically
    const updateFields: Record<string, unknown> = {}
    if (color !== undefined) updateFields.team_color = color
    if (teamName !== undefined) updateFields.team_name = teamName ? teamName.trim() : null
    if (resolvedPhotoUrl !== undefined) updateFields.team_photo_url = resolvedPhotoUrl || null

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
