# Draft Room - Architecture

## Overview
Custom league draft app with React + TypeScript + Vite frontend and Supabase backend.

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite, React Router v7
- **Styling**: Tailwind CSS v4 + shadcn/ui patterns
- **Backend**: Supabase (Auth, Postgres, Real-time, Edge Functions)
- **State**: TanStack Query (server state), React Context (auth, theme)
- **Forms**: React Hook Form + Zod validation

---

## Database Schema

### leagues
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
manager_id      uuid REFERENCES auth.users(id) NOT NULL
name            text NOT NULL
spectator_token uuid DEFAULT gen_random_uuid()
draft_type      text CHECK (draft_type IN ('snake', 'round_robin')) DEFAULT 'snake'
time_limit_seconds integer CHECK (time_limit_seconds BETWEEN 15 AND 1800) DEFAULT 60
status          text CHECK (status IN ('not_started', 'in_progress', 'paused', 'completed')) DEFAULT 'not_started'
current_pick_index integer DEFAULT 0
current_pick_started_at timestamptz
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
UNIQUE(manager_id, name)
```

### captains
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
league_id       uuid REFERENCES leagues(id) ON DELETE CASCADE NOT NULL
name            text NOT NULL
is_participant  boolean DEFAULT true
access_token    uuid DEFAULT gen_random_uuid()
draft_position  integer NOT NULL
created_at      timestamptz DEFAULT now()
UNIQUE(league_id, draft_position)
```

### players
```sql
id                    uuid PRIMARY KEY DEFAULT gen_random_uuid()
league_id             uuid REFERENCES leagues(id) ON DELETE CASCADE NOT NULL
name                  text NOT NULL
drafted_by_captain_id uuid REFERENCES captains(id)
draft_pick_number     integer
created_at            timestamptz DEFAULT now()
```

### draft_picks
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
league_id   uuid REFERENCES leagues(id) ON DELETE CASCADE NOT NULL
captain_id  uuid REFERENCES captains(id) NOT NULL
player_id   uuid REFERENCES players(id) NOT NULL
pick_number integer NOT NULL
is_auto_pick boolean DEFAULT false
picked_at   timestamptz DEFAULT now()
```

---

## Draft State Machine

```
NOT_STARTED → IN_PROGRESS (start)
IN_PROGRESS → PAUSED (pause)
PAUSED → IN_PROGRESS (resume)
PAUSED → NOT_STARTED (restart, resets picks)
IN_PROGRESS → COMPLETED (all picks made)
```

---

## URL-based Access

| URL Pattern | Access Level | Auth Required |
|-------------|--------------|---------------|
| `/league/:id/manage` | Full control | Yes (manager) |
| `/league/:id/captain?token=<token>` | Make picks | No (token) |
| `/league/:id/spectate?token=<token>` | Read-only | No (token) |

---

## Synced Timer

All clients calculate remaining time from `leagues.current_pick_started_at`:
```typescript
const elapsed = (Date.now() - new Date(current_pick_started_at).getTime()) / 1000;
const remaining = Math.max(0, time_limit_seconds - elapsed);
```

When timer expires, client calls Edge Function for auto-pick with server-side validation.

---

## Draft Order Logic

**Round Robin**: `[1, 2, 3, 4, 1, 2, 3, 4, ...]`

**Snake**: `[1, 2, 3, 4, 4, 3, 2, 1, 1, 2, 3, 4, ...]`

---

## Real-time Subscriptions

Subscribe to Supabase Postgres changes:
- `leagues` table for status/timer updates
- `draft_picks` table for new picks
- `players` table for draft assignments
