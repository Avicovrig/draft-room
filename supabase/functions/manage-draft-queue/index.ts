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
import type { ManageDraftQueueRequest } from '../_shared/types.ts'

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const methodResponse = requirePost(req)
  if (methodResponse) return methodResponse

  const jsonResponse = requireJson(req)
  if (jsonResponse) return jsonResponse

  const rateLimitResponse = rateLimit(req, { windowMs: 60_000, maxRequests: 60 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    const body: ManageDraftQueueRequest = await req.json()
    const { action, captainId, leagueId, captainToken } = body

    if (!action || !captainId || !leagueId) {
      return errorResponse('Missing required fields: action, captainId, leagueId', 400, req)
    }

    if (!['add', 'remove', 'reorder'].includes(action)) {
      return errorResponse('Invalid action. Must be add, remove, or reorder', 400, req)
    }

    if (!UUID_RE.test(captainId) || !UUID_RE.test(leagueId)) {
      return errorResponse('Invalid field format', 400, req)
    }

    const supabaseAdmin = createAdminClient()

    // Verify captain belongs to this league
    const { data: captain, error: captainError } = await supabaseAdmin
      .from('captains')
      .select('*')
      .eq('id', captainId)
      .eq('league_id', leagueId)
      .single()

    if (captainError || !captain) {
      return errorResponse('Captain not found in this league', 404, req)
    }

    // Auth: captain token OR manager JWT
    if (captainToken) {
      if (!timingSafeEqual(captain.access_token, captainToken)) {
        return errorResponse('Invalid captain token', 403, req)
      }
    } else {
      const authResult = await authenticateManager(req, leagueId, supabaseAdmin)
      if (authResult instanceof Response) return authResult
    }

    const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' }

    // --- ADD ---
    if (action === 'add') {
      const { playerId } = body
      if (!playerId || !UUID_RE.test(playerId)) {
        return errorResponse('Missing or invalid playerId', 400, req)
      }

      // Get current max position
      const { data: existing } = await supabaseAdmin
        .from('captain_draft_queues')
        .select('position')
        .eq('captain_id', captainId)
        .order('position', { ascending: false })
        .limit(1)

      const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0

      const { data, error } = await supabaseAdmin
        .from('captain_draft_queues')
        .insert({
          captain_id: captainId,
          player_id: playerId,
          position: nextPosition,
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          return errorResponse('Player is already in queue', 409, req)
        }
        console.error('Failed to add to queue:', error)
        return errorResponse('Failed to add to queue', 500, req)
      }

      logAudit(supabaseAdmin, {
        action: 'draft_queue_add',
        leagueId,
        actorType: captainToken ? 'captain' : 'manager',
        actorId: captainId,
        metadata: { playerId },
        ipAddress: getClientIp(req),
      })

      return new Response(JSON.stringify({ success: true, entry: data }), {
        status: 200,
        headers,
      })
    }

    // --- REMOVE ---
    if (action === 'remove') {
      const { queueEntryId } = body
      if (!queueEntryId || !UUID_RE.test(queueEntryId)) {
        return errorResponse('Missing or invalid queueEntryId', 400, req)
      }

      // Verify the entry belongs to this captain
      const { data: entry, error: entryError } = await supabaseAdmin
        .from('captain_draft_queues')
        .select('id, captain_id')
        .eq('id', queueEntryId)
        .eq('captain_id', captainId)
        .single()

      if (entryError || !entry) {
        return errorResponse('Queue entry not found', 404, req)
      }

      const { error } = await supabaseAdmin
        .from('captain_draft_queues')
        .delete()
        .eq('id', queueEntryId)

      if (error) {
        console.error('Failed to remove from queue:', error)
        return errorResponse('Failed to remove from queue', 500, req)
      }

      logAudit(supabaseAdmin, {
        action: 'draft_queue_remove',
        leagueId,
        actorType: captainToken ? 'captain' : 'manager',
        actorId: captainId,
        metadata: { queueEntryId },
        ipAddress: getClientIp(req),
      })

      return new Response(JSON.stringify({ success: true }), { status: 200, headers })
    }

    // --- REORDER ---
    if (action === 'reorder') {
      const { entryIds } = body
      if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
        return errorResponse('Missing or invalid entryIds array', 400, req)
      }

      if (!entryIds.every((id) => UUID_RE.test(id))) {
        return errorResponse('Invalid entry ID format', 400, req)
      }

      // Atomic reorder via database function — single UPDATE avoids the
      // two-phase negative-temp pattern that risked partial failures.
      const { error: reorderError } = await supabaseAdmin.rpc('reorder_draft_queue', {
        p_captain_id: captainId,
        p_entry_ids: entryIds,
      })

      if (reorderError) {
        console.error('Failed to reorder queue:', reorderError)
        const message = reorderError.message?.includes('Not all entries belong')
          ? 'One or more entry IDs do not belong to this captain'
          : 'Failed to reorder queue'
        const status = message.includes('do not belong') ? 400 : 500
        return errorResponse(message, status, req)
      }

      logAudit(supabaseAdmin, {
        action: 'draft_queue_reorder',
        leagueId,
        actorType: captainToken ? 'captain' : 'manager',
        actorId: captainId,
        metadata: { entryCount: entryIds.length },
        ipAddress: getClientIp(req),
      })

      return new Response(JSON.stringify({ success: true }), { status: 200, headers })
    }

    return errorResponse('Invalid action', 400, req)
  } catch (error) {
    console.error('Manage draft queue error:', error)
    return errorResponse('Internal server error', 500, req)
  }
})
