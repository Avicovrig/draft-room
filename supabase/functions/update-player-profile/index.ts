import { getCorsHeaders, handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { UUID_RE, errorResponse, validateUrl } from '../_shared/validation.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { logAudit, getClientIp } from '../_shared/audit.ts'
import type { UpdatePlayerProfileRequest } from '../_shared/types.ts'

const MAX_BIO_LENGTH = 5000
const MAX_PROFILE_PICTURE_URL_LENGTH = 4096
const MAX_FIELD_NAME_LENGTH = 200
const MAX_FIELD_VALUE_LENGTH = 1000
const DANGEROUS_PATTERN = /<[^>]*>|javascript:|data:/i

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const rateLimitResponse = rateLimit(req, { windowMs: 60_000, maxRequests: 10 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const {
      playerId,
      editToken,
      bio,
      profile_picture_url,
      customFields,
      deletedCustomFieldIds,
    }: UpdatePlayerProfileRequest = await req.json()

    if (!playerId || !editToken) {
      return errorResponse('Missing required fields', 400, req)
    }

    if (!UUID_RE.test(playerId) || !UUID_RE.test(editToken)) {
      return errorResponse('Invalid field format', 400, req)
    }

    // Validate input sizes
    if (bio && bio.length > MAX_BIO_LENGTH) {
      return errorResponse(`Bio exceeds maximum length of ${MAX_BIO_LENGTH} characters`, 400, req)
    }

    if (bio && DANGEROUS_PATTERN.test(bio)) {
      return errorResponse('Bio contains invalid characters', 400, req)
    }

    if (profile_picture_url && profile_picture_url.length > MAX_PROFILE_PICTURE_URL_LENGTH) {
      return errorResponse('Profile picture URL exceeds maximum length', 400, req)
    }

    // Validate profile picture URL protocol
    if (profile_picture_url && !validateUrl(profile_picture_url)) {
      return errorResponse('Invalid profile picture URL', 400, req)
    }

    if (customFields) {
      for (const field of customFields) {
        if (field.field_name && field.field_name.length > MAX_FIELD_NAME_LENGTH) {
          return errorResponse(`Field name exceeds maximum length of ${MAX_FIELD_NAME_LENGTH} characters`, 400, req)
        }
        if (field.field_value && field.field_value.length > MAX_FIELD_VALUE_LENGTH) {
          return errorResponse(`Field value exceeds maximum length of ${MAX_FIELD_VALUE_LENGTH} characters`, 400, req)
        }
        if (field.field_name && DANGEROUS_PATTERN.test(field.field_name)) {
          return errorResponse('Field name contains invalid characters', 400, req)
        }
        if (field.field_value && DANGEROUS_PATTERN.test(field.field_value)) {
          return errorResponse('Field value contains invalid characters', 400, req)
        }
      }
    }

    const supabaseAdmin = createAdminClient()

    // Verify edit token
    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .select('id, league_id')
      .eq('id', playerId)
      .eq('edit_token', editToken)
      .single()

    if (playerError || !player) {
      return errorResponse('Invalid player or token', 403, req)
    }

    // Validate required schema fields (always check, even if customFields is empty/missing)
    const { data: requiredSchemas } = await supabaseAdmin
      .from('league_field_schemas')
      .select('id, field_name, field_type')
      .eq('league_id', player.league_id)
      .eq('is_required', true)

    if (requiredSchemas && requiredSchemas.length > 0) {
      const submittedBySchemaId = new Map<string, string>()
      if (customFields) {
        for (const field of customFields) {
          if (field.schema_id) {
            submittedBySchemaId.set(field.schema_id, field.field_value || '')
          }
        }
      }

      const missingFields: string[] = []
      for (const schema of requiredSchemas) {
        const value = submittedBySchemaId.get(schema.id)
        if (!value || !value.trim()) {
          missingFields.push(schema.field_name)
        }
      }

      if (missingFields.length > 0) {
        return errorResponse(`Required fields missing: ${missingFields.join(', ')}`, 400, req)
      }
    }

    // Update player profile
    const updateData: Record<string, unknown> = {}
    if (bio !== undefined) updateData.bio = bio
    if (profile_picture_url !== undefined) updateData.profile_picture_url = profile_picture_url

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('players')
        .update(updateData)
        .eq('id', playerId)

      if (updateError) {
        console.error('Failed to update player:', updateError)
        return errorResponse('Failed to update profile', 500, req)
      }
    }

    // Delete removed custom fields
    if (deletedCustomFieldIds && deletedCustomFieldIds.length > 0) {
      if (deletedCustomFieldIds.some((id: string) => !UUID_RE.test(id))) {
        return errorResponse('Invalid field ID format', 400, req)
      }
      const { error: deleteError } = await supabaseAdmin
        .from('player_custom_fields')
        .delete()
        .in('id', deletedCustomFieldIds)
        .eq('player_id', playerId)

      if (deleteError) {
        console.error('Failed to delete custom fields:', deleteError)
      }
    }

    // Upsert custom fields
    if (customFields && customFields.length > 0) {
      for (const field of customFields) {
        if (field.id) {
          // Update existing
          const { error } = await supabaseAdmin
            .from('player_custom_fields')
            .update({
              field_name: field.field_name,
              field_value: field.field_value || null,
              field_order: field.field_order,
              schema_id: field.schema_id || null,
            })
            .eq('id', field.id)
            .eq('player_id', playerId)

          if (error) {
            console.error('Failed to update custom field:', error)
          }
        } else {
          // Insert new
          const { error } = await supabaseAdmin
            .from('player_custom_fields')
            .insert({
              player_id: playerId,
              field_name: field.field_name,
              field_value: field.field_value || null,
              field_order: field.field_order,
              schema_id: field.schema_id || null,
            })

          if (error) {
            console.error('Failed to insert custom field:', error)
          }
        }
      }
    }

    logAudit(supabaseAdmin, {
      action: 'player_profile_updated',
      leagueId: player.league_id,
      actorType: 'player',
      actorId: playerId,
      ipAddress: getClientIp(req),
    })

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Update player profile error:', error)
    return errorResponse('Internal server error', 500, req)
  }
})
