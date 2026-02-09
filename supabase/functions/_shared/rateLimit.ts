import { getCorsHeaders } from './cors.ts'

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimitOptions {
  windowMs: number
  maxRequests: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 60 seconds
let lastCleanup = Date.now()
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

/**
 * In-memory per-isolate rate limiter.
 * Returns a 429 Response if the limit is exceeded, or null to continue.
 */
export function rateLimit(
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
            ...getCorsHeaders(req),
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
