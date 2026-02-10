import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface AuditLogEntry {
  action: string
  leagueId: string
  actorType: 'manager' | 'captain' | 'player' | 'system'
  actorId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}

/**
 * Log an action to the audit_logs table. Fire-and-forget — errors are logged
 * but do not propagate to the caller.
 */
export function logAudit(
  supabaseAdmin: SupabaseClient,
  { action, leagueId, actorType, actorId, metadata, ipAddress }: AuditLogEntry
): void {
  supabaseAdmin
    .from('audit_logs')
    .insert({
      action,
      league_id: leagueId,
      actor_type: actorType,
      actor_id: actorId ?? null,
      metadata: metadata ?? {},
      ip_address: ipAddress ?? null,
    })
    .then(({ error }) => {
      if (error) console.error('[audit] Failed to log:', error)
    })
}

/**
 * Extract client IP from request headers.
 * Uses the last entry in x-forwarded-for (added by the infrastructure proxy)
 * rather than the first (which can be client-spoofed).
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const ips = xff.split(',').map(ip => ip.trim()).filter(Boolean)
    if (ips.length > 0) return ips[ips.length - 1]
  }
  return req.headers.get('x-real-ip') ?? 'unknown'
}
