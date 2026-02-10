import { getCorsHeaders } from './cors.ts'

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Create a JSON error response with CORS headers. */
export function errorResponse(message: string, status: number, req: Request): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
  )
}

/** Validate a URL is safe (http/https only, no javascript/data/blob schemes). */
export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

/** Reject non-POST requests. Returns a 405 Response, or null to continue. */
export function requirePost(req: Request): Response | null {
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, req)
  }
  return null
}

/**
 * Constant-time string comparison to prevent timing attacks on token validation.
 * Uses crypto.subtle.timingSafeEqual to avoid leaking token characters via response timing.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder()
  const bufA = encoder.encode(a)
  const bufB = encoder.encode(b)
  if (bufA.byteLength !== bufB.byteLength) return false
  return crypto.subtle.timingSafeEqual(bufA, bufB)
}
