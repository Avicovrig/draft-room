---
name: draft-logic
description: "GUARDRAIL: Draft logic is duplicated between src/lib/draft.ts and edge functions (make-pick, auto-pick). Changes MUST be made in both places."
---

# Draft Logic Guardrail

## ⚠️ WARNING: DUPLICATED CODE

Draft logic exists in TWO places that MUST stay in sync:

| Logic | Frontend | Edge Functions |
|-------|----------|---------------|
| Pick order (snake/round robin) | `src/lib/draft.ts` — `getPickOrder()`, `getCaptainAtPick()` | `make-pick/index.ts` (lines 54-68), `auto-pick/index.ts` (lines 70-81) |
| Available players filter | `src/lib/draft.ts` — `getAvailablePlayers()` | `make-pick/index.ts` (lines 87-94, 149-166), `auto-pick/index.ts` (lines 112-119) |
| Timer validation | `src/components/draft/PickTimer.tsx` | `auto-pick/index.ts` (lines 86-108) |

## When Modifying Draft Logic, ALWAYS:

1. Change `src/lib/draft.ts` (frontend)
2. Change BOTH `make-pick/index.ts` AND `auto-pick/index.ts` (edge functions)
3. Run `npm test` to verify frontend tests pass (58 draft logic tests)
4. Deploy changed edge functions to QA and test
5. Look for `// NOTE: Keep in sync with ...` comments — check the referenced location

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

The `getAvailablePlayers()` utility in `src/lib/draft.ts` handles both filters. It is also used in `PlayerList.tsx` (management page). Any new view showing available players MUST use this utility.

## Timer System

- **Source of truth**: `leagues.current_pick_started_at` (server timestamp)
- **Client computes**: `remaining = time_limit_seconds - elapsed_seconds`
- **Client waits 2 seconds** after timer hits zero, then calls `auto-pick` edge function
- **Server validates**: `elapsed >= time_limit_seconds - GRACE_PERIOD_SECONDS` (2s)
- These 2-second values MUST stay in sync between client and server
- Only managers and captains trigger auto-pick calls — spectators NEVER make API calls

## Draft State Machine

```
NOT_STARTED → IN_PROGRESS  (start draft)
IN_PROGRESS → PAUSED       (pause draft)
PAUSED      → IN_PROGRESS  (resume draft)
PAUSED      → NOT_STARTED  (restart draft — deletes all picks)
IN_PROGRESS → COMPLETED    (all available players drafted)
```

## Spectator Safety

Spectators should NEVER trigger API calls. Guard auto-pick effects and `onExpire` callbacks with:
```typescript
if (isManager || viewingAsCaptain) { /* make API call */ }
```

## Cross-Reference Comments

Both frontend and edge function code have comments like:
```typescript
// NOTE: Keep in sync with getAvailablePlayers() in src/lib/draft.ts
```

When you see these, ALWAYS check the other location before finishing your changes.
