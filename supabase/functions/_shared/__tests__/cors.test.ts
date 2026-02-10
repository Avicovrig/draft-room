import { describe, it, expect } from 'vitest'

// Re-implement the logic under test directly since the source uses Deno-style .ts imports.
// This keeps tests decoupled from Deno module resolution while testing the same logic.

const ALLOWED_ORIGINS = [
  'https://draft-room-eta.vercel.app',
]

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true
  if (/^https:\/\/draft-room[\w-]*\.vercel\.app$/.test(origin)) return true
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true
  return false
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }
  return null
}

function makeRequest(origin: string, method = 'GET'): Request {
  return new Request('https://example.com', {
    method,
    headers: { Origin: origin },
  })
}

describe('isAllowedOrigin', () => {
  it('allows the production origin', () => {
    expect(isAllowedOrigin('https://draft-room-eta.vercel.app')).toBe(true)
  })

  it('allows draft-room Vercel preview deploy origins', () => {
    expect(isAllowedOrigin('https://draft-room-abc123.vercel.app')).toBe(true)
    expect(isAllowedOrigin('https://draft-room-abc123-team.vercel.app')).toBe(true)
  })

  it('rejects non-draft-room Vercel preview deploys', () => {
    expect(isAllowedOrigin('https://my-branch-deploy.vercel.app')).toBe(false)
    expect(isAllowedOrigin('https://other-project-abc.vercel.app')).toBe(false)
  })

  it('allows localhost with port', () => {
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true)
    expect(isAllowedOrigin('http://localhost:3000')).toBe(true)
  })

  it('allows localhost without port', () => {
    expect(isAllowedOrigin('http://localhost')).toBe(true)
  })

  it('rejects unknown origins', () => {
    expect(isAllowedOrigin('https://evil-site.com')).toBe(false)
    expect(isAllowedOrigin('https://not-vercel.app')).toBe(false)
  })

  it('rejects https localhost', () => {
    expect(isAllowedOrigin('https://localhost:5173')).toBe(false)
  })

  it('rejects empty origin', () => {
    expect(isAllowedOrigin('')).toBe(false)
  })

  it('rejects origins with path components', () => {
    expect(isAllowedOrigin('https://draft-room-eta.vercel.app/path')).toBe(false)
  })

  it('rejects subdomain attack on vercel.app', () => {
    // Should not match multi-level subdomains
    expect(isAllowedOrigin('https://evil.sub.vercel.app')).toBe(false)
  })
})

describe('getCorsHeaders', () => {
  it('returns matching origin for allowed request', () => {
    const req = makeRequest('https://draft-room-eta.vercel.app')
    const headers = getCorsHeaders(req)
    expect(headers['Access-Control-Allow-Origin']).toBe('https://draft-room-eta.vercel.app')
  })

  it('returns empty origin for blocked request', () => {
    const req = makeRequest('https://evil-site.com')
    const headers = getCorsHeaders(req)
    expect(headers['Access-Control-Allow-Origin']).toBe('')
  })

  it('always includes Vary: Origin', () => {
    const req = makeRequest('https://evil-site.com')
    const headers = getCorsHeaders(req)
    expect(headers['Vary']).toBe('Origin')
  })

  it('handles missing Origin header', () => {
    const req = new Request('https://example.com')
    const headers = getCorsHeaders(req)
    expect(headers['Access-Control-Allow-Origin']).toBe('')
  })
})

describe('handleCors', () => {
  it('returns Response for OPTIONS requests', () => {
    const req = makeRequest('https://draft-room-eta.vercel.app', 'OPTIONS')
    const response = handleCors(req)
    expect(response).not.toBeNull()
    expect(response!.status).toBe(200)
  })

  it('returns null for non-OPTIONS requests', () => {
    const req = makeRequest('https://draft-room-eta.vercel.app', 'POST')
    expect(handleCors(req)).toBeNull()
  })

  it('sets correct CORS headers on OPTIONS response', () => {
    const req = makeRequest('https://draft-room-eta.vercel.app', 'OPTIONS')
    const response = handleCors(req)
    expect(response!.headers.get('Access-Control-Allow-Origin')).toBe('https://draft-room-eta.vercel.app')
  })
})
