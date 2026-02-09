const ALLOWED_ORIGINS = [
  'https://draft-room-eta.vercel.app',
]

/** Check if the origin is allowed. Supports exact matches and *.vercel.app pattern. */
function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true
  // Allow all Vercel preview deploys
  if (/^https:\/\/[\w-]+\.vercel\.app$/.test(origin)) return true
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
    'Vary': 'Origin',
  }
}

/** Returns a Response for OPTIONS preflight requests, or null to continue. */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }
  return null
}
