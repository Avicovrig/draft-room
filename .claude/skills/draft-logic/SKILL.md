---
name: draft-logic
description: "GUARDRAIL: Draft logic is duplicated between src/lib/draft.ts, edge functions (make-pick, auto-pick), and pg_cron (migration 019). Changes MUST be made in all three places."
---

# Draft Logic Guardrail

## ⚠️ WARNING: DUPLICATED CODE

Draft logic exists in THREE places that MUST stay in sync:

| Logic | Frontend | Edge Functions (shared) | pg_cron fallback |
|-------|----------|------------------------|------------------|
| Pick order (snake/round robin) | `src/lib/draft.ts` — `getPickOrder()`, `getCaptainAtPick()` | `_shared/draftOrder.ts` — `getCurrentCaptainId()` | `process_expired_timers()` in migration 019 |
| Available players filter | `src/lib/draft.ts` — `getAvailablePlayers()` | `_shared/draftOrder.ts` — `getAvailablePlayersServer()` | `process_expired_timers()` in migration 019 |
| Timer validation | `src/components/draft/PickTimer.tsx` | Inline in `auto-pick/index.ts` | `process_expired_timers()` (5s grace for timer, 10s for auto-pick captains) |

## When Modifying Draft Logic, ALWAYS:

1. Change `src/lib/draft.ts` (frontend)
2. Change `_shared/draftOrder.ts` (shared edge function logic)
3. Check call sites in `make-pick/index.ts` and `auto-pick/index.ts` for inline logic (e.g., `countRemainingPlayers`, captain-player rejection)
4. Update `process_expired_timers()` in `supabase/migrations/019_auto_pick_cron.sql` (or create a new migration with `CREATE OR REPLACE FUNCTION`)
5. Run `npm test` to verify frontend tests pass
6. Deploy changed edge functions to QA and test
7. Look for `// NOTE: Keep in sync with ...` comments — check the referenced location

---

## Snake Draft Order

```
Round 0 (even): [1, 2, 3, 4]     (normal order)
Round 1 (odd):  [4, 3, 2, 1]     (reversed)
Round 2 (even): [1, 2, 3, 4]     (normal order)
```

Calculation:
```
round = floor(pickIndex / captainCount)
positionInRound = pickIndex % captainCount
if snake AND round is odd: captainIndex = captainCount - 1 - positionInRound
else: captainIndex = positionInRound
```

## Round Robin Order

Same order every round: `[1, 2, 3, 4, 1, 2, 3, 4, ...]`

Calculation: `captainIndex = pickIndex % captainCount`

## Available Players

A player is available if ALL of these are true:
1. `drafted_by_captain_id` is `null` (not yet drafted)
2. Player's `id` is NOT in `captainPlayerIds` set (not linked to a captain)

Captain-linked players: players whose `id` matches some captain's `player_id`. They are team captains and must NOT appear in available lists or be draftable. The `make-pick` edge function explicitly rejects them server-side.

- **Frontend**: `getAvailablePlayers()` in `src/lib/draft.ts` handles both filters. Also used in `PlayerList.tsx` (management page). Any new view showing available players MUST use this utility.
- **Edge functions**: `getAvailablePlayersServer()` in `_shared/draftOrder.ts` is the server-side equivalent. Used by `auto-pick`. `make-pick` has inline logic (`countRemainingPlayers` + captain rejection check) that must also stay in sync.

## Timer System

- **Source of truth**: `leagues.current_pick_started_at` (server timestamp)
- **Client computes**: `remaining = time_limit_seconds - elapsed_seconds`
- **Client waits 2 seconds** after timer hits zero, then calls `auto-pick` edge function
- **Server validates**: `elapsed >= time_limit_seconds - GRACE_PERIOD_SECONDS` (2s)
- These 2-second values MUST stay in sync between client and server
- **Any connected client** (manager, captain, or spectator) triggers auto-pick calls
- **pg_cron fallback**: If ALL clients disconnect, `process_expired_timers()` runs every minute and makes picks directly in SQL

## Draft State Machine

```
NOT_STARTED → IN_PROGRESS  (start draft)
IN_PROGRESS → PAUSED       (pause draft)
PAUSED      → IN_PROGRESS  (resume draft)
PAUSED      → NOT_STARTED  (restart draft — deletes all picks)
IN_PROGRESS → COMPLETED    (all available players drafted)
```

## Auto-Pick Triggering

Any connected client (manager, captain, or spectator) can trigger auto-pick calls. The edge function authenticates via any captain token from the league, spectator token, or manager JWT. The `useAutoPick` hook handles this — all clients fire `handleTimerExpire()` on timer expiry.

## Cross-Reference Comments

Both frontend and edge function code have comments like:
```typescript
// NOTE: Keep in sync with getAvailablePlayers() in src/lib/draft.ts
```

When you see these, ALWAYS check the other location before finishing your changes.
