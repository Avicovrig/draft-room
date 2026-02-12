---
name: edge-functions
description: Supabase Edge Function development patterns for Draft Room. Deno runtime, shared utilities, rollback logic, validation, rate limiting, CORS, audit logging.
---

# Edge Function Development Guidelines

## When to Use

Creating or modifying edge functions in `supabase/functions/`, working with shared utilities in `_shared/`.

---

## Edge Function Template

Every edge function follows this structure:

```typescript
import { getCorsHeaders, handleCors } from '../_shared/cors.ts'
import { createAdminClient } from '../_shared/supabase.ts'
import { UUID_RE, errorResponse, requirePost, requireJson } from '../_shared/validation.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { logAudit, getClientIp } from '../_shared/audit.ts'
import type { MyRequestType } from '../_shared/types.ts'

Deno.serve(async (req) => {
  // 1. CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  // 2. Method + Content-Type enforcement
  const methodResponse = requirePost(req)
  if (methodResponse) return methodResponse
  const jsonResponse = requireJson(req)
  if (jsonResponse) return jsonResponse

  // 3. Rate limiting
  const rateLimitResponse = rateLimit(req, { windowMs: 60_000, maxRequests: 30 })
  if (rateLimitResponse) return rateLimitResponse

  try {
    // 4. Parse and validate request body
    const body: MyRequestType = await req.json()
    if (!body.leagueId || !UUID_RE.test(body.leagueId)) {
      return errorResponse('Invalid field format', 400, req)
    }

    // 5. Create admin client (bypasses RLS via service role key)
    const supabaseAdmin = createAdminClient()

    // 6. Business logic...

    // 7. Audit log (fire-and-forget, don't await)
    logAudit(supabaseAdmin, { action: 'my_action', leagueId, actorType: 'manager', ... })

    // 8. Return success
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('My function error:', error)
    return errorResponse('Internal server error', 500, req)
  }
})
```

## Shared Utilities

All in `supabase/functions/_shared/`:

| File | Exports | Purpose |
|------|---------|---------|
| `cors.ts` | `getCorsHeaders(req)`, `handleCors(req)` | CORS origin checking, preflight responses |
| `validation.ts` | `UUID_RE`, `errorResponse()`, `requirePost()`, `requireJson()`, `validateUrl()`, `timingSafeEqual()`, `isValidHexColor()`, `isValidJpeg()` | Validation, error responses, security utilities |
| `rateLimit.ts` | `rateLimit(req, opts)` | In-memory per-isolate rate limiter |
| `auth.ts` | `authenticateManager(req, leagueId, client?)` | Manager JWT auth, returns `{user, league}` or error Response |
| `audit.ts` | `logAudit(client, entry)`, `getClientIp(req)` | Fire-and-forget audit logging |
| `supabase.ts` | `createAdminClient()` | Supabase client with service role key |
| `draftOrder.ts` | `getCurrentCaptainId()`, `getAvailablePlayersServer()` | Draft order logic + available players filter (shared by `make-pick` and `auto-pick`) |
| `draftHelpers.ts` | `rollbackPick()`, `advanceLeague()` | Pick rollback and league advancement with optimistic locking |
| `types.ts` | All interfaces | Request body types + entity interfaces |

## CRITICAL: Use Types from `_shared/types.ts`

Do NOT define inline type annotations for Captain, Player, League, DraftPick, or request bodies. Import from `_shared/types.ts`:

```typescript
import type { Captain, League, MakePickRequest } from '../_shared/types.ts'
```

## Rollback Pattern

`make-pick` and `auto-pick` use compensating rollback logic:

1. Insert draft_pick
2. Update player → if fails, delete the draft_pick
3. Update league → if fails, delete the draft_pick AND reset the player

Each step checks for errors and rolls back all prior writes on failure. New edge functions with multi-step writes should follow this pattern.

## Dual Auth (Captain Token OR Manager JWT)

For actions callable by both captains and managers (`make-pick`, `auto-pick`, `toggle-auto-pick`, `update-captain-color`):

```typescript
if (captainToken) {
  // Validate captain token (timing-safe comparison to prevent timing attacks)
  const captain = league.captains.find(
    (c) => c.id === captainId && timingSafeEqual(c.access_token, captainToken)
  )
  if (!captain) {
    return errorResponse('Invalid captain token', 403, req)
  }
} else {
  // No captain token — require manager JWT
  const authResult = await authenticateManager(req, leagueId, supabaseAdmin)
  if (authResult instanceof Response) return authResult
}
```

Every edge function must authenticate via one of these two paths. Never allow unauthenticated access.

## Manager-Only Auth

For manager-only actions (`restart-draft`, `undo-pick`):

1. Use `authenticateManager(req, leagueId)` from `_shared/auth.ts`
2. Extracts JWT from Authorization header
3. Verifies user owns the league via `manager_id`
4. Returns `{ user, league }` or a 401/403/404 Response

## Rate Limiting

Standard configuration: `{ windowMs: 60_000, maxRequests: 30 }` (30/min).
Lower for sensitive operations: `update-player-profile` uses `maxRequests: 10`.

## Deployment

**CRITICAL: Always use `--no-verify-jwt`** — Supabase Auth issues ES256 user tokens but the edge function gateway validates using HS256 `JWT_SECRET`. All functions validate auth internally, so gateway verification must be disabled.

```bash
# Production
supabase functions deploy <function-name> --no-verify-jwt

# QA
supabase functions deploy <function-name> --project-ref goyzyylpthhqotjdsmjn --no-verify-jwt
```

All 8 functions: `make-pick`, `auto-pick`, `toggle-auto-pick`, `update-player-profile`, `update-captain-color`, `restart-draft`, `undo-pick`, `copy-league`

## Testing

Edge function shared utilities have tests in `supabase/functions/_shared/__tests__/`. Tests re-implement the logic (Deno imports can't be resolved by Vitest). When modifying shared utils, update both the source and corresponding test.
