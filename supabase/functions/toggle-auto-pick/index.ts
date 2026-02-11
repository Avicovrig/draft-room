import { getCorsHeaders, handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import {
  UUID_RE,
  errorResponse,
  requirePost,
  requireJson,
  timingSafeEqual,
} from '../_shared/validation.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { logAudit, getClientIp } from '../_shared/audit.ts'
import { authenticateManager } from '../_shared/auth.ts'
import type { ToggleAutoPickRequest } from '../_shared/types.ts'

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const methodResponse = requirePost(req)
  if (methodResponse) return methodResponse

  const jsonResponse = requireJson(req)
  if (jsonResponse) return jsonResponse

  const rateLimitResponse = rateLimit(req, { windowMs: 60_000, maxRequests: 20 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { captainId, enabled, captainToken, leagueId }: ToggleAutoPickRequest = await req.json()

    if (!captainId || enabled === undefined || !leagueId) {
      return errorResponse('Missing required fields', 400, req)
    }

    if (typeof enabled !== 'boolean') {
      return errorResponse('enabled must be a boolean', 400, req)
    }

    if (!UUID_RE.test(captainId) || !UUID_RE.test(leagueId)) {
      return errorResponse('Invalid field format', 400, req)
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

    // Update the captain's auto_pick_enabled setting.
    // When disabling, also reset the timeout counter so the captain gets a fresh start.
    const updateData: Record<string, unknown> = { auto_pick_enabled: enabled }
    if (!enabled) {
      updateData.consecutive_timeout_picks = 0
    }
    const { error: updateError } = await supabaseAdmin
      .from('captains')
      .update(updateData)
      .eq('id', captainId)

    if (updateError) {
      console.error('Failed to update auto_pick_enabled:', updateError)
      return errorResponse('Failed to update setting', 500, req)
    }

    logAudit(supabaseAdmin, {
      action: 'auto_pick_toggled',
      leagueId,
      actorType: captainToken ? 'captain' : 'manager',
      actorId: captainId,
      metadata: { enabled },
      ipAddress: getClientIp(req),
    })

    return new Response(
      JSON.stringify({
        success: true,
        captainId,
        auto_pick_enabled: enabled,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Toggle auto-pick error:', error)
    return errorResponse('Internal server error', 500, req)
  }
})
