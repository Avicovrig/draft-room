import { getCorsHeaders } from './cors.ts'
import { getClientIp } from './audit.ts'

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

/**
 * Best-effort in-memory per-isolate rate limiter. NOT a security boundary.
 *
 * Limitations:
 * - State resets on isolate cold starts and redeployments
 * - Each isolate counts independently (requests across isolates are not shared)
 * - An attacker can bypass by timing requests to hit different isolates
 *
 * This provides basic protection against accidental rapid-fire requests (e.g., double-clicks,
 * buggy retry loops) but should not be relied upon to prevent determined abuse. For
 * security-critical rate limiting, use a shared store (e.g., Upstash Redis, database-backed).
 *
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
    const updated = { ...entry, count: entry.count + 1 }
    store.set(ip, updated)
    if (updated.count > maxRequests) {
      return new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: {
          ...getCorsHeaders(req),
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)),
        },
      })
    }
  } else {
    store.set(ip, { count: 1, resetAt: now + windowMs })
  }

  return null
}
