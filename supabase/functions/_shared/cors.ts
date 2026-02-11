const ALLOWED_ORIGINS = ['https://draft-room-eta.vercel.app']

/** Check if the origin is allowed. Supports exact matches and draft-room Vercel previews. */
function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true
  // Allow draft-room Vercel preview deploys only, pinned to our team slug to prevent
  // attacker-controlled origins like draft-room-evil.vercel.app
  if (/^https:\/\/draft-room-[\w]+-avis-projects-58313b0f\.vercel\.app$/.test(origin)) return true
  // Allow localhost for development
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true
  return false
}

/** Get CORS headers with the correct Access-Control-Allow-Origin for the request. */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

/** Returns a Response for OPTIONS preflight requests, or null to continue. */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }
  return null
}
