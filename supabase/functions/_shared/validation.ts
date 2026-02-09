import { getCorsHeaders } from './cors.ts'

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Create a JSON error response with CORS headers. */
export function errorResponse(message: string, status: number, req: Request): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
  )
}

/** Validate a URL is safe (https only, no javascript/data/blob schemes). */
export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}
