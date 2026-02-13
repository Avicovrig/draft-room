# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Draft Room is a custom league draft application. League managers can create leagues, add players, assign captains, and run real-time drafts with spectator support.

**Tech Stack**: React 19 + TypeScript + Vite + Tailwind v4 + Supabase + Sentry

## Commands

- `npm run dev` - Start dev server against QA Supabase (http://localhost:5173, mode=qa)
- `npm run dev:prod` - Start dev server against production Supabase
- `npm run build` - Type-check with TypeScript then build for production
- `npm run build:qa` - Build for QA environment
- `npm run lint` - Run ESLint
- `npm test` - Run unit tests (Vitest)
- `npm run test:watch` - Run tests in watch mode during development
- `npm run test:coverage` - Run tests with coverage report
- `npm test -- draft.test.ts` - Run a single test file by name
- `npm test -- --grep "snake draft"` - Run tests matching a pattern
- `./scripts/deploy-functions.sh [qa|prod]` - Deploy only changed edge functions (use `--all` to force all)
- `./scripts/smoke-test.sh [qa|prod]` - Post-deployment verification

## Architecture

### Frontend

- **Routing**: React Router v7, configured in `App.tsx`. Protected routes use `<ProtectedRoute>` wrapper (requires Supabase auth). Token-based routes (captain, spectator, player edit) have no auth.
- **State**: TanStack Query for all server state. Hooks in `src/hooks/` wrap Supabase queries as TanStack Query hooks (`useQuery`/`useMutation`). React Context only for auth (`AuthContext`) and theme (`ThemeContext`).
- **Styling**: Tailwind v4 with CSS variables defined in `index.css`. Components follow shadcn/ui patterns using `class-variance-authority` for variants. Use `cn()` from `@/lib/utils` for conditional classNames.
- **Path aliases**: `@/*` maps to `src/*` (configured in `tsconfig.app.json` and `vite.config.ts`)
- **Forms**: React Hook Form + Zod validation

### Backend (Supabase Edge Functions)

All draft-critical mutations go through Deno edge functions in `supabase/functions/` that use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS:

- **`make-pick`** - Captain or manager makes a pick. Requires captain token OR manager JWT. Validates turn order, player availability. Handles race conditions via unique constraints on `pick_number` and `(league_id, player_id)`. Rolls back pick/player writes if later steps fail.
- **`auto-pick`** - Called on timer expiry or when captain has `auto_pick_enabled`. Requires any captain token from the league, spectator token, OR manager JWT (any connected client can trigger). Picks from captain's draft queue first, falls back to random. Has 2-second grace period on timer validation. Uses `expectedPickIndex` for idempotency. Rolls back on partial failure.
- **`toggle-auto-pick`** - Toggles a captain's auto-pick setting. Requires captain token OR manager JWT. Validates captain belongs to the specified league.
- **`update-player-profile`** - Player self-service profile updates via edit token. Validates required schema fields, rejects HTML in field names/values.
- **`update-captain-color`** - Updates a captain's team color, team name, and team photo. Requires captain token OR manager JWT.
- **`restart-draft`** - Manager-only. Deletes all picks, resets players, sets league back to `not_started`. Requires manager JWT.
- **`undo-pick`** - Manager-only. Removes last pick, resets that player, decrements pick index. Requires manager JWT.
- **`copy-league`** - Manager-only. Duplicates a league with all captains, players, field schemas, custom fields, and draft queues. Creates fresh tokens, resets draft state. Rolls back on partial failure.

All edge functions share utilities in `supabase/functions/_shared/`: CORS origin checking (`cors.ts`), rate limiting (`rateLimit.ts`), UUID/URL validation + Content-Type enforcement + JPEG validation + timing-safe comparison + HTTP method enforcement (`validation.ts`), manager JWT auth with optional client reuse (`auth.ts`), audit logging (`audit.ts`), admin client creation with fail-fast env validation (`supabase.ts`), draft order logic (`draftOrder.ts`), and shared type definitions (`types.ts`). All validate UUID format on ID parameters before hitting the database. All enforce `Content-Type: application/json` via `requireJson()`. Request body types and entity interfaces are defined in `_shared/types.ts` — use these instead of inline type annotations.

**IMPORTANT: Gateway JWT verification is disabled** (`verify_jwt = false` in `config.toml`, `--no-verify-jwt` on deploy). Supabase Auth issues ES256 user tokens but the edge function gateway validates using HS256 `JWT_SECRET`. All functions validate auth internally — never rely on gateway verification. Always deploy with `--no-verify-jwt`.

### Token Security

Token columns (`captains.access_token`, `players.edit_token`, `leagues.spectator_token`) are hidden from the `anon` and `authenticated` Postgres roles via column-level SELECT grants (migrations 013-014). Client-facing queries cannot read tokens.

Access is mediated through `SECURITY DEFINER` RPCs that run as the database owner:
- **`validate_captain_token(league_id, token)`** → captain row + `linked_player_edit_token`
- **`validate_spectator_token(league_id, token)`** → boolean
- **`validate_player_edit_token(player_id, token)`** → player row + custom fields + navigation tokens
- **`get_league_tokens(league_id)`** → all tokens for a league (manager-only, checks `auth.uid()`)

Frontend uses `useSecureToken` hook (`src/hooks/useSecureToken.ts`) which reads `?token=` from the URL on mount, stores it in `sessionStorage`, and strips it from the URL via `history.replaceState`.

### Real-time Data Flow

The `useDraft` hook (`src/hooks/useDraft.ts`) is the central draft state manager:
1. Subscribes to Supabase realtime on `leagues`, `players`, `draft_picks`, and `captains` tables
2. On any change, invalidates the TanStack Query cache to trigger a refetch
3. Falls back to 2-second polling when realtime subscription isn't connected

### Draft Logic

Core draft order logic lives in `src/lib/draft.ts`:
- **Snake**: Order reverses each round `[1,2,3,4,4,3,2,1,1,2,3,4,...]`
- **Round Robin**: Same order every round `[1,2,3,4,1,2,3,4,...]`
- Same logic is duplicated in edge functions (`make-pick`, `auto-pick`) and in the `process_expired_timers()` pg_cron function (migration 019) — changes must be made in all three places
- `getAvailablePlayers()` in `src/lib/draft.ts` filters out drafted and captain-linked players — also duplicated in edge functions (with cross-reference comments)

### Timer System

Server-authoritative: `leagues.current_pick_started_at` is the source of truth. All clients compute remaining time as `time_limit_seconds - elapsed`. When timer hits zero, any connected client (manager, captain, or spectator) calls the `auto-pick` edge function. The edge function validates the timer server-side (with 2s grace period) and uses `expectedPickIndex` for idempotency so multiple clients calling simultaneously is safe.

**Server-side timer (QStash)**: When a pick timer starts, a database trigger (`schedule_auto_pick_timer`, migration 020) schedules an Upstash QStash HTTP callback for `time_limit_seconds + 2s` later. QStash calls the auto-pick edge function with `expectedPickIndex` for idempotency and `x-cron-secret` for auth. If a captain already picked, the callback harmlessly returns "Pick already made". This provides precise server-side timer enforcement independent of connected clients. Requires vault secrets: `qstash_token`, `auto_pick_function_url`, `auto_pick_cron_secret`.

**Server-side fallback (pg_cron)**: Backup for QStash failures and auto-pick captain handling. `process_expired_timers()` runs every minute via `pg_cron` (migration 019), detects expired timers, and makes picks directly in SQL. For auto-pick captains, triggers after 10 seconds; for normal captains, after `time_limit_seconds + 5s` grace.

### Database Schema

Eight tables: `leagues`, `captains`, `players`, `player_custom_fields`, `draft_picks`, `captain_draft_queues`, `league_field_schemas`, `audit_logs`. Full schema in `docs/architecture.md`. Types in `src/lib/types.ts` mirror the DB schema with `Database` interface and convenience aliases (`League`, `Captain`, `Player`, etc.). Public variants (`CaptainPublic`, `PlayerPublic`, `LeaguePublic`, `LeagueFullPublic`) omit token columns and are used throughout the frontend.

**Important**: `useLeague` selects explicit columns (not `*`) from related tables to minimize payload and because token columns are not accessible. When adding new columns to the schema, they must also be added to the select in `src/hooks/useLeagues.ts`.

Migrations are in `supabase/migrations/` (001-020), applied sequentially.

### Draft State Machine

```
NOT_STARTED → IN_PROGRESS (start)
IN_PROGRESS → PAUSED (pause)
PAUSED → IN_PROGRESS (resume)
PAUSED → NOT_STARTED (restart, deletes all picks)
IN_PROGRESS → COMPLETED (all players drafted)
```

### Access Model

- **Manager**: Authenticated via Supabase Auth. Full control over league, draft, players.
- **Captain**: Token-based URL (`/league/:id/captain?token=<access_token>`). Can make picks during their turn.
- **Spectator**: Token-based URL (`/league/:id/spectate?token=<spectator_token>`). Read-only view.
- **Player**: Token-based URL (`/player/:playerId/edit?token=<edit_token>`). Can edit own profile.

Token is stripped from the URL on page load and stored in `sessionStorage` via `useSecureToken`. Token-based pages validate access through RPCs, not direct column queries.

## Code Conventions

- Use `@/` path alias for imports from src
- Components use named exports
- Dark mode: toggle via ThemeContext, uses `.dark` class on `<html>`
- Toast notifications: use `useToast()` hook from `@/components/ui/Toast`
- Each route in `App.tsx` is wrapped in its own `<ErrorBoundary>` for route-level error isolation. When adding new routes, always wrap them in `<ErrorBoundary>`.
- Hooks follow the pattern: `use<Entity>` for queries, `useCreate<Entity>`/`useUpdate<Entity>`/`useDelete<Entity>` for mutations
- Tables with unique constraints on position columns use two-phase updates with `Promise.all`: set positions to negative temps first, then final values
- **TypeScript**: Strict mode with `noUnusedLocals`/`noUnusedParameters` enforced — removing code that references variables/imports will cause build failures if you don't clean up unused references.
- **TypeScript imports**: `verbatimModuleSyntax` is enabled — use `import type { Foo }` for type-only imports. A bare `import { Foo }` where `Foo` is only a type will fail.

For detailed patterns (React 19, TanStack Query, Tailwind, modals, forms, lazy loading, etc.), see the **frontend-dev** skill. For edge function patterns, see the **edge-functions** skill.

## Skills

Detailed development patterns live in `.claude/skills/` and are auto-activated by hooks when your prompt matches relevant keywords:

- **frontend-dev** — React 19, TanStack Query, Tailwind v4, shadcn/ui, modals, forms, lazy loading, component conventions
- **edge-functions** — Deno runtime, shared utilities, rollback patterns, validation, rate limiting, CORS, audit logging
- **draft-logic** — GUARDRAIL: Draft order, available players, timer logic. Duplicated between frontend and edge functions — changes must be made in both places.

## Dev Docs

For large features or multi-step tasks, use the dev docs system to prevent context loss:

1. **`/dev-docs [task name]`** — Creates `dev/active/[task-name]/` with plan, context, and tasks files
2. **`/dev-docs-update`** — Updates existing dev docs before context compaction

Dev docs are gitignored (`dev/active/`) — they're local working files, not committed.

## Testing

- **Framework**: Vitest (config in `vitest.config.ts`), globals enabled (`describe`/`it`/`expect` available without imports)
- **Test location**: `__tests__/` directories adjacent to source files (e.g., `src/lib/__tests__/draft.test.ts`)
- **All new pure functions MUST have corresponding unit tests.** When adding a function to `src/lib/` or `supabase/functions/_shared/`, write tests for it.
- **Edge function shared utilities** (`supabase/functions/_shared/`) use Deno-style `.ts` imports that Vitest can't resolve directly. Tests for these re-implement the logic under test. When modifying these files, update both the source and the corresponding test.
- **Draft logic is duplicated** in `src/lib/draft.ts` and edge functions (`make-pick`, `auto-pick`). Shared helpers are in `supabase/functions/_shared/draftOrder.ts`. Tests cover both the frontend version and the shared helpers (via re-implementation). When modifying draft logic, update both locations and verify tests still pass.
- **Coverage thresholds**: 80% for statements, branches, functions, and lines (enforced in `vitest.config.ts`). Applies to `src/lib/` files. Edge function shared files are excluded from v8 coverage metrics but tested via re-implementation.
- **Pre-commit hook**: Husky runs `lint-staged` (ESLint with `--max-warnings 0` + Prettier on staged `.ts`/`.tsx` files — any warning blocks the commit). The full test suite runs in CI, not locally.
- **Claude Code stop hook**: `.claude/hooks/build-check.sh` runs `tsc -b` when Claude finishes responding. If type errors exist, it exits with code 2 (shows errors to Claude, expects them to be fixed before stopping).
- **CI pipeline**: GitHub Actions (`.github/workflows/ci.yml`) on every push to `main` and on PRs. Three jobs: `lint-and-typecheck` (ESLint + `tsc -b`), `test` (coverage), then `build` (depends on both; uses dummy env vars since it only checks compilation).
- **Post-deployment smoke tests**: Run `./scripts/smoke-test.sh [qa|prod]` after deployments to verify token security, RPCs, CORS, and frontend availability. QA defaults to the stable Vercel branch alias URL.
- **Keep CLAUDE.md updated**: When adding or modifying tests, implementing best practices, or changing conventions, update this file to reflect the changes.

## Error Monitoring (Sentry)

Sentry captures frontend errors, performance data, and session replays (on error). Configured in `src/lib/sentry.ts`, imported first in `main.tsx`. Disabled in local dev (`enabled: import.meta.env.PROD`).

- React 19 error handlers (`onUncaughtError`, `onCaughtError`, `onRecoverableError`) report to Sentry via `Sentry.reactErrorHandler()` in `main.tsx`
- `ErrorBoundary.componentDidCatch` also calls `Sentry.captureException()`
- Source maps upload via `@sentry/vite-plugin` during builds (requires `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`)
- CSP in `vercel.json` allows `*.sentry.io` and `*.ingest.sentry.io`
- **IMPORTANT: `tracePropagationTargets` must NOT include `supabase.co`** — the Supabase API gateway overrides `Access-Control-Allow-Headers` returned by edge functions, stripping any non-standard headers like `sentry-trace` and `baggage`. If Sentry injects these on Supabase requests, browsers block the POST after CORS preflight fails. Only propagate traces to same-origin (`/^\//`).

## Environment Variables

Vite loads `.env.[mode]` automatically. Local dev defaults to QA mode.

- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_SENTRY_DSN` - Sentry DSN (optional — Sentry disabled if empty)

Edge functions use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (set automatically by Supabase).

Build-time env vars (set in CI/Vercel, not in `.env` files):
- `SENTRY_AUTH_TOKEN` - Sentry auth token for source map uploads
- `SENTRY_ORG` - Sentry organization slug
- `SENTRY_PROJECT` - Sentry project slug

## Accepted Design Trade-offs

- **Token chain in player edit page (M-25)**: When a player edits their profile, the response includes `linked_captain_access_token` and `league_spectator_token` for navigation. These tokens are fetched via a `SECURITY DEFINER` RPC, never from direct column access. Acceptable because it enables seamless UX without re-authentication.
- **Token re-exposure in session (M-44)**: Tokens are stored in `sessionStorage` via `useSecureToken` after being stripped from the URL. They remain accessible to same-tab JS for the session lifetime. Acceptable because session tokens are inherently visible to the current tab's JS context.
- **Open redirect in Login.tsx (M-23)**: `location.state.from.pathname` is used for post-login redirect. Not exploitable because React Router's `location.state` can only be set programmatically (not via URL manipulation), and `navigate()` only handles in-app routes.
- **`team_color` CSS injection (M-22)**: Colors are rendered via `style={{ backgroundColor: captain.team_color }}`. Not exploitable via CSS `style` attribute (no script execution). Colors are validated server-side in edge functions (`isValidHexColor`), and client-side input comes from `<input type="color">`.
- **`console.error` in ErrorBoundary (M-43)**: `componentDidCatch` logs errors via `console.error`. This is appropriate for production error tracking and matches React's own behavior.
- **ESLint unused `_` variables**: `varsIgnorePattern: '^_'` is configured in ESLint. The `_` prefix convention is used for intentionally unused destructuring targets (e.g., `const { [key]: _, ...rest } = obj`).

## Supabase Setup

1. Run migrations from `supabase/migrations/` in order (001-020)
2. Deploy all 8 edge functions: `make-pick`, `auto-pick`, `toggle-auto-pick`, `update-player-profile`, `update-captain-color`, `restart-draft`, `undo-pick`, `copy-league`
3. Enable realtime on tables: `leagues`, `players`, `draft_picks`, `captains`
4. Set up QStash for server-side timer enforcement:
   - Create Upstash account (free tier: 500 messages/day)
   - Insert vault secrets: `qstash_token`, `auto_pick_function_url`, `auto_pick_cron_secret`
   - Set edge function secret: `supabase secrets set AUTO_PICK_CRON_SECRET=<value>`
   - See migration 020 comments for detailed steps
