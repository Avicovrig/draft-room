import { getCorsHeaders, handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { UUID_RE, errorResponse } from '../_shared/validation.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { logAudit, getClientIp } from '../_shared/audit.ts'

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const rateLimitResponse = rateLimit(req, { windowMs: 60_000, maxRequests: 20 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const { captainId, enabled, captainToken, leagueId } = await req.json()

    if (!captainId || enabled === undefined || !leagueId) {
      return errorResponse('Missing required fields', 400, req)
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

    // Validate captain token if provided
    if (captainToken && captain.access_token !== captainToken) {
      return errorResponse('Invalid captain token', 403, req)
    }

    // Update the captain's auto_pick_enabled setting
    const { error: updateError } = await supabaseAdmin
      .from('captains')
      .update({ auto_pick_enabled: enabled })
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
