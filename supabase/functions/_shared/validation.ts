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

/** Reject requests without application/json Content-Type. Returns a 415 Response, or null to continue. */
export function requireJson(req: Request): Response | null {
  if (!req.headers.get('content-type')?.includes('application/json')) {
    return errorResponse('Content-Type must be application/json', 415, req)
  }
  return null
}

/** Validate JPEG magic bytes (FF D8 FF). Returns true if data starts with valid JPEG header. */
export function isValidJpeg(data: Uint8Array): boolean {
  return data.length >= 3 && data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF
}

/** Validate a hex color string (#RRGGBB format). */
export function isValidHexColor(color: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(color)
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
