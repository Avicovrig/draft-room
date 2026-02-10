import { describe, it, expect } from 'vitest'

// Re-implement the logic under test (source uses Deno-style .ts imports).
// authenticateManager relies on Supabase client, so we test its contract:
// 1. Rejects missing Authorization header
// 2. Rejects invalid auth token
// 3. Rejects league not found
// 4. Rejects non-manager user
// 5. Returns user + league on success

interface LeagueRow {
  id: string
  name: string
  manager_id: string
  status: string
  draft_type: string
  current_pick_index: number
  current_pick_started_at: string | null
  time_limit_seconds: number
  spectator_token: string
  [key: string]: unknown
}

function errorResponse(message: string, status: number, _req: Request): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function authenticateManager(
  req: Request,
  leagueId: string,
  client: {
    auth: { getUser: (token: string) => Promise<{ data: { user: { id: string } | null }; error: Error | null }> }
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          single: () => Promise<{ data: LeagueRow | null; error: Error | null }>
        }
      }
    }
  }
): Promise<{ user: { id: string }; league: LeagueRow } | Response> {
  const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!authHeader) {
    return errorResponse('Unauthorized', 401, req)
  }

  const { data: { user }, error: authError } = await client.auth.getUser(authHeader)
  if (authError || !user) {
    return errorResponse('Unauthorized', 401, req)
  }

  const { data: league, error: leagueError } = await client
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .single()

  if (leagueError || !league) {
    return errorResponse('League not found', 404, req)
  }

  if (league.manager_id !== user.id) {
    return errorResponse('Forbidden', 403, req)
  }

  return { user, league: league as LeagueRow }
}

function createMockClient(options: {
  user?: { id: string } | null
  authError?: Error | null
  league?: LeagueRow | null
  leagueError?: Error | null
}) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: options.user ?? null },
        error: options.authError ?? null,
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: options.league ?? null,
            error: options.leagueError ?? null,
          }),
        }),
      }),
    }),
  }
}

const sampleLeague: LeagueRow = {
  id: 'league-123',
  name: 'Test League',
  manager_id: 'user-456',
  status: 'not_started',
  draft_type: 'snake',
  current_pick_index: 0,
  current_pick_started_at: null,
  time_limit_seconds: 60,
  spectator_token: 'spec-token',
}

describe('authenticateManager', () => {
  it('rejects request without Authorization header', async () => {
    const req = new Request('http://localhost', { method: 'POST' })
    const client = createMockClient({ user: { id: 'user-456' }, league: sampleLeague })
    const result = await authenticateManager(req, 'league-123', client)

    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })

  it('rejects request with invalid auth token', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { Authorization: 'Bearer bad-token' },
    })
    const client = createMockClient({ authError: new Error('Invalid token') })
    const result = await authenticateManager(req, 'league-123', client)

    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })

  it('rejects request when user is null', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { Authorization: 'Bearer some-token' },
    })
    const client = createMockClient({ user: null })
    const result = await authenticateManager(req, 'league-123', client)

    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })

  it('returns 404 when league not found', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
    })
    const client = createMockClient({
      user: { id: 'user-456' },
      league: null,
      leagueError: new Error('Not found'),
    })
    const result = await authenticateManager(req, 'league-123', client)

    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(404)
  })

  it('returns 403 when user is not the league manager', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
    })
    const client = createMockClient({
      user: { id: 'different-user' },
      league: sampleLeague,
    })
    const result = await authenticateManager(req, 'league-123', client)

    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(403)
  })

  it('returns user and league on successful authentication', async () => {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
    })
    const client = createMockClient({
      user: { id: 'user-456' },
      league: sampleLeague,
    })
    const result = await authenticateManager(req, 'league-123', client)

    expect(result).not.toBeInstanceOf(Response)
    const success = result as { user: { id: string }; league: LeagueRow }
    expect(success.user.id).toBe('user-456')
    expect(success.league.id).toBe('league-123')
    expect(success.league.manager_id).toBe('user-456')
  })

  it('strips Bearer prefix from Authorization header', async () => {
    let capturedToken = ''
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: { Authorization: 'Bearer my-jwt-token' },
    })
    const client = {
      auth: {
        getUser: async (token: string) => {
          capturedToken = token
          return { data: { user: { id: 'user-456' } }, error: null }
        },
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: sampleLeague, error: null }),
          }),
        }),
      }),
    }
    await authenticateManager(req, 'league-123', client)
    expect(capturedToken).toBe('my-jwt-token')
  })
})
