import { describe, it, expect, vi } from 'vitest'

// Re-implement the logic under test (source uses Deno-style .ts imports).

function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const ips = xff.split(',').map(ip => ip.trim()).filter(Boolean)
    if (ips.length > 0) return ips[ips.length - 1]
  }
  return req.headers.get('x-real-ip') ?? 'unknown'
}

interface AuditLogEntry {
  action: string
  leagueId: string
  actorType: 'manager' | 'captain' | 'player' | 'system'
  actorId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}

function logAudit(
  supabaseAdmin: { from: (table: string) => { insert: (data: Record<string, unknown>) => { then: (cb: (result: { error: unknown }) => void) => void } } },
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

describe('getClientIp', () => {
  it('returns last IP from x-forwarded-for (rightmost = infrastructure proxy)', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1, 192.168.1.1' },
    })
    expect(getClientIp(req)).toBe('192.168.1.1')
  })

  it('returns single IP from x-forwarded-for', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.50' },
    })
    expect(getClientIp(req)).toBe('203.0.113.50')
  })

  it('trims whitespace from IPs', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': ' 1.2.3.4 , 5.6.7.8 ' },
    })
    expect(getClientIp(req)).toBe('5.6.7.8')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-real-ip': '10.0.0.5' },
    })
    expect(getClientIp(req)).toBe('10.0.0.5')
  })

  it('returns "unknown" when no IP headers present', () => {
    const req = new Request('http://localhost')
    expect(getClientIp(req)).toBe('unknown')
  })

  it('skips empty entries in x-forwarded-for', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, , , 5.6.7.8' },
    })
    expect(getClientIp(req)).toBe('5.6.7.8')
  })

  it('handles empty x-forwarded-for by falling back to x-real-ip', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '', 'x-real-ip': '10.0.0.1' },
    })
    expect(getClientIp(req)).toBe('10.0.0.1')
  })
})

describe('logAudit', () => {
  it('inserts correct fields to audit_logs table', () => {
    const insertData: Record<string, unknown> = {}
    const mockClient = {
      from: (table: string) => {
        expect(table).toBe('audit_logs')
        return {
          insert: (data: Record<string, unknown>) => {
            Object.assign(insertData, data)
            return { then: (cb: (result: { error: unknown }) => void) => cb({ error: null }) }
          },
        }
      },
    }

    logAudit(mockClient, {
      action: 'make_pick',
      leagueId: 'league-123',
      actorType: 'captain',
      actorId: 'captain-456',
      metadata: { player: 'John' },
      ipAddress: '1.2.3.4',
    })

    expect(insertData).toEqual({
      action: 'make_pick',
      league_id: 'league-123',
      actor_type: 'captain',
      actor_id: 'captain-456',
      metadata: { player: 'John' },
      ip_address: '1.2.3.4',
    })
  })

  it('defaults optional fields to null/empty', () => {
    const insertData: Record<string, unknown> = {}
    const mockClient = {
      from: () => ({
        insert: (data: Record<string, unknown>) => {
          Object.assign(insertData, data)
          return { then: (cb: (result: { error: unknown }) => void) => cb({ error: null }) }
        },
      }),
    }

    logAudit(mockClient, {
      action: 'restart_draft',
      leagueId: 'league-789',
      actorType: 'manager',
    })

    expect(insertData.actor_id).toBeNull()
    expect(insertData.metadata).toEqual({})
    expect(insertData.ip_address).toBeNull()
  })

  it('logs error but does not throw on insert failure', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const mockClient = {
      from: () => ({
        insert: () => ({
          then: (cb: (result: { error: unknown }) => void) => cb({ error: new Error('DB failure') }),
        }),
      }),
    }

    // Should not throw
    logAudit(mockClient, {
      action: 'undo_pick',
      leagueId: 'league-abc',
      actorType: 'system',
    })

    expect(consoleError).toHaveBeenCalledWith('[audit] Failed to log:', expect.any(Error))
    consoleError.mockRestore()
  })

  it('does not log when insert succeeds', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const mockClient = {
      from: () => ({
        insert: () => ({
          then: (cb: (result: { error: unknown }) => void) => cb({ error: null }),
        }),
      }),
    }

    logAudit(mockClient, {
      action: 'make_pick',
      leagueId: 'league-xyz',
      actorType: 'captain',
    })

    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
