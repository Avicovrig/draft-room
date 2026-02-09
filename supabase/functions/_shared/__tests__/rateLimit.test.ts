import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Re-implement the rate limiter logic for testing in Node (source uses Deno-style imports).
// This tests the same algorithm without Deno module resolution.

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimitOptions {
  windowMs: number
  maxRequests: number
}

let store: Map<string, RateLimitEntry>
let lastCleanup: number
const CLEANUP_INTERVAL = 60_000

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}

function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

function rateLimit(
  req: Request,
  { windowMs, maxRequests }: RateLimitOptions
): Response | null {
  cleanup()

  const ip = getClientIp(req)
  const now = Date.now()
  const entry = store.get(ip)

  if (entry && now < entry.resetAt) {
    entry.count++
    if (entry.count > maxRequests) {
      return new Response(
        JSON.stringify({ error: 'Too many requests' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)),
          },
        }
      )
    }
  } else {
    store.set(ip, { count: 1, resetAt: now + windowMs })
  }

  return null
}

function makeRequest(ip: string): Request {
  return new Request('https://example.com', {
    headers: { 'x-forwarded-for': ip },
  })
}

beforeEach(() => {
  store = new Map()
  lastCleanup = Date.now()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getClientIp', () => {
  it('extracts IP from x-forwarded-for', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    })
    expect(getClientIp(req)).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-real-ip': '10.0.0.1' },
    })
    expect(getClientIp(req)).toBe('10.0.0.1')
  })

  it('returns "unknown" when no IP headers present', () => {
    const req = new Request('https://example.com')
    expect(getClientIp(req)).toBe('unknown')
  })

  it('trims whitespace from x-forwarded-for', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '  1.2.3.4  , 5.6.7.8' },
    })
    expect(getClientIp(req)).toBe('1.2.3.4')
  })
})

describe('rateLimit', () => {
  it('allows requests under the limit', () => {
    const opts = { windowMs: 60_000, maxRequests: 3 }

    expect(rateLimit(makeRequest('1.1.1.1'), opts)).toBeNull()
    expect(rateLimit(makeRequest('1.1.1.1'), opts)).toBeNull()
    expect(rateLimit(makeRequest('1.1.1.1'), opts)).toBeNull()
  })

  it('blocks requests over the limit', () => {
    const opts = { windowMs: 60_000, maxRequests: 2 }

    expect(rateLimit(makeRequest('1.1.1.1'), opts)).toBeNull()  // count=1
    expect(rateLimit(makeRequest('1.1.1.1'), opts)).toBeNull()  // count=2
    const response = rateLimit(makeRequest('1.1.1.1'), opts)    // count=3 > 2
    expect(response).not.toBeNull()
    expect(response!.status).toBe(429)
  })

  it('returns 429 with correct body', async () => {
    const opts = { windowMs: 60_000, maxRequests: 1 }

    rateLimit(makeRequest('1.1.1.1'), opts)
    const response = rateLimit(makeRequest('1.1.1.1'), opts)
    const body = await response!.json()
    expect(body.error).toBe('Too many requests')
  })

  it('includes Retry-After header', () => {
    const opts = { windowMs: 60_000, maxRequests: 1 }

    rateLimit(makeRequest('1.1.1.1'), opts)
    const response = rateLimit(makeRequest('1.1.1.1'), opts)
    expect(response!.headers.get('Retry-After')).toBeTruthy()
    const retryAfter = parseInt(response!.headers.get('Retry-After')!)
    expect(retryAfter).toBeGreaterThan(0)
    expect(retryAfter).toBeLessThanOrEqual(60)
  })

  it('tracks different IPs independently', () => {
    const opts = { windowMs: 60_000, maxRequests: 1 }

    expect(rateLimit(makeRequest('1.1.1.1'), opts)).toBeNull()
    expect(rateLimit(makeRequest('2.2.2.2'), opts)).toBeNull()
    // First IP is now blocked
    expect(rateLimit(makeRequest('1.1.1.1'), opts)).not.toBeNull()
    // Second IP is also blocked
    expect(rateLimit(makeRequest('2.2.2.2'), opts)).not.toBeNull()
  })

  it('resets after window expires', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const opts = { windowMs: 1_000, maxRequests: 1 }

    expect(rateLimit(makeRequest('1.1.1.1'), opts)).toBeNull()
    expect(rateLimit(makeRequest('1.1.1.1'), opts)).not.toBeNull()

    // Advance time past the window
    vi.spyOn(Date, 'now').mockReturnValue(now + 2_000)
    expect(rateLimit(makeRequest('1.1.1.1'), opts)).toBeNull()
  })
})

describe('cleanup', () => {
  it('removes expired entries', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    store.set('old-ip', { count: 5, resetAt: now - 1000 })
    store.set('active-ip', { count: 1, resetAt: now + 60_000 })

    // Force cleanup by advancing past interval
    lastCleanup = now - CLEANUP_INTERVAL - 1
    cleanup()

    expect(store.has('old-ip')).toBe(false)
    expect(store.has('active-ip')).toBe(true)
  })

  it('skips cleanup if interval has not passed', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    store.set('old-ip', { count: 5, resetAt: now - 1000 })
    lastCleanup = now // Just cleaned up

    cleanup()

    // Old entry should still be there since cleanup was skipped
    expect(store.has('old-ip')).toBe(true)
  })
})
