# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Draft Room is a custom league draft application. League managers can create leagues, add players, assign captains, and run real-time drafts with spectator support.

**Tech Stack**: React 19 + TypeScript + Vite + Tailwind v4 + Supabase

## Commands

- `npm run dev` - Start dev server against QA Supabase (http://localhost:5173, mode=qa)
- `npm run dev:prod` - Start dev server against production Supabase
- `npm run build` - Type-check with TypeScript then build for production
- `npm run build:qa` - Build for QA environment
- `npm run lint` - Run ESLint
- `npm test` - Run unit tests (Vitest)
- `npm run test:watch` - Run tests in watch mode during development
- `npm run test:coverage` - Run tests with coverage report
- `supabase functions deploy <function-name>` - Deploy a single edge function
- `./scripts/smoke-test.sh [qa|prod]` - Post-deployment verification

## Architecture

### Frontend

- **Routing**: React Router v7, configured in `App.tsx`. Protected routes use `<ProtectedRoute>` wrapper (requires Supabase auth). Token-based routes (captain, spectator, player edit) have no auth.
- **State**: TanStack Query for all server state. Hooks in `src/hooks/` wrap Supabase queries as TanStack Query hooks (`useQuery`/`useMutation`). React Context only for auth (`AuthContext`) and theme (`ThemeContext`).
- **Styling**: Tailwind v4 with CSS variables defined in `index.css`. Components follow shadcn/ui patterns using `class-variance-authority` for variants. Use `cn()` from `@/lib/utils` for conditional classNames.
- **Path aliases**: `@/*` maps to `src/*` (configured in `tsconfig.app.json` and `vite.config.ts`)
- **Forms**: React Hook Form + Zod validation
- **TypeScript**: Strict mode with `noUnusedLocals`/`noUnusedParameters` enforced — removing code that references variables/imports will cause build failures if you don't clean up unused references.

### Backend (Supabase Edge Functions)

All draft-critical mutations go through Deno edge functions in `supabase/functions/` that use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS:

- **`make-pick`** - Captain or manager makes a pick. Validates turn order, player availability, captain token. Handles race conditions via unique constraint on `pick_number`. Rolls back pick/player writes if later steps fail.
- **`auto-pick`** - Called on timer expiry or when captain has `auto_pick_enabled`. Picks from captain's draft queue first, falls back to random. Has 2-second grace period on timer validation. Uses `expectedPickIndex` for idempotency. Rolls back on partial failure.
- **`toggle-auto-pick`** - Toggles a captain's auto-pick setting. Validates captain belongs to the specified league.
- **`update-player-profile`** - Player self-service profile updates via edit token. Validates required schema fields, rejects HTML in field names/values.
- **`update-captain-color`** - Updates a captain's team color, team name, and team photo.
- **`restart-draft`** - Manager-only. Deletes all picks, resets players, sets league back to `not_started`. Requires JWT auth.
- **`undo-pick`** - Manager-only. Removes last pick, resets that player, decrements pick index. Requires JWT auth.

All edge functions share utilities in `supabase/functions/_shared/`: CORS origin checking (`cors.ts`), rate limiting (`rateLimit.ts`), UUID/URL validation (`validation.ts`), manager JWT auth (`auth.ts`), and audit logging (`audit.ts`). All validate UUID format on ID parameters before hitting the database.

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
- Same logic is duplicated in edge functions (`make-pick`, `auto-pick`) for server-side validation — changes must be made in both places
- `getAvailablePlayers()` in `src/lib/draft.ts` filters out drafted and captain-linked players — also duplicated in edge functions (with cross-reference comments)

### Timer System

Server-authoritative: `leagues.current_pick_started_at` is the source of truth. All clients compute remaining time as `time_limit_seconds - elapsed`. When timer hits zero, client waits 2 seconds then calls the `auto-pick` edge function. The edge function validates the timer server-side (with matching 2s grace period). Only managers and captains trigger auto-pick calls — spectators never make API calls.

### Database Schema

Eight tables: `leagues`, `captains`, `players`, `player_custom_fields`, `draft_picks`, `captain_draft_queues`, `league_field_schemas`, `audit_logs`. Full schema in `docs/architecture.md`. Types in `src/lib/types.ts` mirror the DB schema with `Database` interface and convenience aliases (`League`, `Captain`, `Player`, etc.). Public variants (`CaptainPublic`, `PlayerPublic`, `LeaguePublic`, `LeagueFullPublic`) omit token columns and are used throughout the frontend.

**Important**: `useLeague` selects explicit columns (not `*`) from related tables to minimize payload and because token columns are not accessible. When adding new columns to the schema, they must also be added to the select in `src/hooks/useLeagues.ts`.

Migrations are in `supabase/migrations/` (001-014), applied sequentially.

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
- Each route in `App.tsx` is wrapped in its own `<ErrorBoundary>` for route-level error isolation. An outer `ErrorBoundary` wraps the entire app as a final fallback. When adding new routes, always wrap them in `<ErrorBoundary>`.
- Hooks follow the pattern: `use<Entity>` for queries, `useCreate<Entity>`/`useUpdate<Entity>`/`useDelete<Entity>` for mutations
- Tables with unique constraints on position columns (`captains.draft_position`, `captain_draft_queues.position`) use two-phase updates: set positions to negative temps first, then final values
- All modals use `useModalFocus` hook (`src/hooks/useModalFocus.ts`) for ESC key, click-outside, body scroll lock, focus trap, and ARIA attributes
- `DraftBoard` receives props from 3 callers (`DraftView`, `CaptainView`, `SpectatorView`). Adding new props requires updating all 3.
- `Button` component accepts `loading` boolean — shows spinner and auto-disables. Use this for all async actions.
- **TanStack Query staleTime**: All query hooks should have an appropriate `staleTime`. Use `5 * 60 * 1000` (5 min) for static/rarely-changing data (league list, field schemas, token validation), `30 * 1000` (30 sec) for data edited in the current view (player profiles, custom fields), and no staleTime for live draft state (`useLeague` with realtime/polling).
- **React 19 patterns**:
  - Do NOT mutate refs during render — use `useEffect` instead
  - Prefer derived values over `useState` + sync `useEffect` when state can be computed from props/other state
  - Use lazy initializers (`useState(() => fn())`) when reading initial state from external sources (localStorage, modules)
  - Use `aria-live="polite"` and `role="status"` on dynamic content that screen readers should announce (e.g., timers, countdowns)

## Testing

- **Framework**: Vitest (config in `vitest.config.ts`), globals enabled (`describe`/`it`/`expect` available without imports)
- **Test location**: `__tests__/` directories adjacent to source files (e.g., `src/lib/__tests__/draft.test.ts`)
- **All new pure functions MUST have corresponding unit tests.** When adding a function to `src/lib/` or `supabase/functions/_shared/`, write tests for it.
- **Edge function shared utilities** (`supabase/functions/_shared/`) use Deno-style `.ts` imports that Vitest can't resolve directly. Tests for these re-implement the logic under test. When modifying these files, update both the source and the corresponding test.
- **Draft logic is duplicated** in `src/lib/draft.ts` and edge functions (`make-pick`, `auto-pick`). Tests cover the frontend version. When modifying draft logic, update both locations and verify tests still pass.
- **Pre-commit hook**: Husky runs `lint-staged` (ESLint on staged `.ts`/`.tsx` files) and then the full Vitest suite before every commit.
- **CI pipeline**: GitHub Actions (`.github/workflows/ci.yml`) runs lint, type check, tests with coverage, and build on every push to `main` and on PRs.
- **Post-deployment smoke tests**: Run `./scripts/smoke-test.sh [qa|prod]` after deployments to verify token security, RPCs, CORS, and frontend availability. For QA, pass `QA_FRONTEND_URL` env var since Vercel preview URLs change each deploy.
- **Keep CLAUDE.md updated**: When adding or modifying tests, implementing best practices, or changing conventions, update this file to reflect the changes.

## Environment Variables

Vite loads `.env.[mode]` automatically. Local dev defaults to QA mode.

- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

Edge functions use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (set automatically by Supabase).

## Supabase Setup

1. Run migrations from `supabase/migrations/` in order (001-014)
2. Deploy all 7 edge functions: `make-pick`, `auto-pick`, `toggle-auto-pick`, `update-player-profile`, `update-captain-color`, `restart-draft`, `undo-pick`
3. Enable realtime on tables: `leagues`, `players`, `draft_picks`, `captains`
