# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Draft Room is a custom league draft application. League managers can create leagues, add players, assign captains, and run real-time drafts with spectator support.

**Tech Stack**: React 19 + TypeScript + Vite + Tailwind v4 + Supabase

## Commands

- `npm run dev` - Start development server (http://localhost:5173)
- `npm run build` - Type-check with TypeScript then build for production
- `npm run lint` - Run ESLint
- `supabase functions deploy <function-name>` - Deploy a single edge function
- No test framework is configured

## Architecture

### Frontend

- **Routing**: React Router v7, configured in `App.tsx`. Protected routes use `<ProtectedRoute>` wrapper (requires Supabase auth). Token-based routes (captain, spectator) have no auth.
- **State**: TanStack Query for all server state. Hooks in `src/hooks/` wrap Supabase queries as TanStack Query hooks (`useQuery`/`useMutation`). React Context only for auth (`AuthContext`) and theme (`ThemeContext`).
- **Styling**: Tailwind v4 with CSS variables defined in `index.css`. Components follow shadcn/ui patterns using `class-variance-authority` for variants. Use `cn()` from `@/lib/utils` for conditional classNames.
- **Path aliases**: `@/*` maps to `src/*` (configured in `tsconfig.app.json` and `vite.config.ts`)
- **Forms**: React Hook Form + Zod validation

### Backend (Supabase Edge Functions)

All draft-critical mutations go through Deno edge functions in `supabase/functions/` that use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS:

- **`make-pick`** - Captain or manager makes a pick. Validates turn order, player availability, captain token. Handles race conditions via unique constraint on `pick_number`. Rolls back pick/player writes if later steps fail.
- **`auto-pick`** - Called on timer expiry or when captain has `auto_pick_enabled`. Picks from captain's draft queue first, falls back to random. Has 2-second grace period on timer validation. Uses `expectedPickIndex` for idempotency. Rolls back on partial failure.
- **`toggle-auto-pick`** - Toggles a captain's auto-pick setting. Validates captain belongs to the specified league.
- **`update-player-profile`** - Player self-service profile updates via edit token

All edge functions validate UUID format on ID parameters before hitting the database.

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

Six tables: `leagues`, `captains`, `players`, `player_custom_fields`, `draft_picks`, `captain_draft_queues`. Full schema in `docs/architecture.md`. Types in `src/lib/types.ts` mirror the DB schema with `Database` interface and convenience aliases (`League`, `Captain`, `Player`, etc.).

**Important**: `useLeague` selects explicit columns (not `*`) from related tables to minimize payload. When adding new columns to the schema, they must also be added to the select in `src/hooks/useLeagues.ts`.

Migrations are in `supabase/migrations/` (001-007), applied sequentially.

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

## Code Conventions

- Use `@/` path alias for imports from src
- Components use named exports
- Dark mode: toggle via ThemeContext, uses `.dark` class on `<html>`
- Toast notifications: use `useToast()` hook from `@/components/ui/Toast`
- Wrap route content with ErrorBoundary for graceful error handling
- Hooks follow the pattern: `use<Entity>` for queries, `useCreate<Entity>`/`useUpdate<Entity>`/`useDelete<Entity>` for mutations
- Tables with unique constraints on position columns (`captains.draft_position`, `captain_draft_queues.position`) use two-phase updates: set positions to negative temps first, then final values

## Environment Variables

Copy `.env.example` to `.env.local` and set:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

Edge functions use `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (set automatically by Supabase).

## Supabase Setup

1. Run migrations from `supabase/migrations/` in order
2. Deploy edge functions: `supabase functions deploy auto-pick`, etc.
3. Enable realtime on tables: `leagues`, `players`, `draft_picks`, `captains`
