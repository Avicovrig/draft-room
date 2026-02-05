# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Draft Room is a custom league draft application. League managers can create leagues, add players, assign captains, and run real-time drafts with spectator support.

**Tech Stack**: React 19 + TypeScript + Vite + Tailwind v4 + Supabase

## Commands

- `npm run dev` - Start development server (http://localhost:5173)
- `npm run build` - Type-check with TypeScript then build for production
- `npm run lint` - Run ESLint

## Architecture

See `docs/architecture.md` for full technical details including database schema and state machine.

**Key patterns:**
- **Routing**: React Router v7 in `App.tsx`
- **State**: TanStack Query for server state, React Context for auth/theme
- **Styling**: Tailwind v4 with CSS variables in `index.css`, shadcn/ui-style components
- **Path aliases**: `@/*` maps to `src/*`

**Directory structure:**
```
src/
├── lib/          # Utilities (supabase client, types, cn helper)
├── hooks/        # Custom React hooks
├── context/      # React contexts (Auth, Theme)
├── components/
│   ├── ui/       # Base UI components (Button, etc.)
│   ├── layout/   # Layout components (Header, ProtectedRoute)
│   ├── league/   # League-related components
│   └── draft/    # Draft-related components
└── pages/        # Route page components
```

## Code Conventions

- Use `@/` path alias for imports from src
- Components use named exports
- Use `cn()` from `@/lib/utils` for conditional classNames
- Dark mode: toggle via ThemeContext, uses `.dark` class on `<html>`
- Toast notifications: use `useToast()` hook from `@/components/ui/Toast`
- Wrap route content with ErrorBoundary for graceful error handling

## Key Features

- **Draft Types**: Snake draft (order reverses each round) or Round Robin
- **Real-time Updates**: Supabase realtime subscriptions for live draft state
- **Server-authoritative Timer**: `current_pick_started_at` timestamp ensures synced timers
- **Auto-pick**: Edge function at `supabase/functions/auto-pick` handles timer expiry
- **Token-based Access**: Captains and spectators access via URL tokens (no auth required)

## Routes

- `/` - Landing page
- `/auth/login`, `/auth/signup` - Authentication
- `/dashboard` - Manager's league list (protected)
- `/league/new` - Create new league (protected)
- `/league/:id/manage` - League settings and setup (protected)
- `/league/:id/draft` - Manager's draft control view (protected)
- `/league/:id/captain?token=<token>` - Captain draft view (token-based)
- `/league/:id/spectate?token=<token>` - Spectator view (token-based)
- `/league/:id/summary` - Post-draft summary

## Environment Variables

Copy `.env.example` to `.env.local` and set:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

## Supabase Setup

1. Run migration from `supabase/migrations/001_initial_schema.sql`
2. Deploy edge function: `supabase functions deploy auto-pick`
3. Enable realtime on tables: leagues, players, draft_picks
