/**
 * Shared draft order logic used by make-pick and auto-pick edge functions.
 * NOTE: Keep in sync with getPickOrder/getCaptainAtPick in src/lib/draft.ts.
 */

import type { Captain, Player } from './types.ts'

/** Determine which captain ID should pick at the given pick index. */
export function getCurrentCaptainId(
  captains: Captain[],
  pickIndex: number,
  draftType: 'snake' | 'round_robin'
): string | undefined {
  if (captains.length === 0) return undefined

  const sorted = [...captains].sort((a, b) => a.draft_position - b.draft_position)
  const captainIds = sorted.map((c) => c.id)
  const count = captainIds.length
  const round = Math.floor(pickIndex / count)
  const positionInRound = pickIndex % count

  if (draftType === 'snake' && round % 2 === 1) {
    return captainIds[count - 1 - positionInRound]
  }
  return captainIds[positionInRound]
}

/**
 * Filter players to only those available for drafting.
 * Excludes drafted players and captain-linked players.
 * NOTE: Keep in sync with getAvailablePlayers() in src/lib/draft.ts.
 */
export function getAvailablePlayersServer(
  players: Player[],
  captains: Captain[]
): Player[] {
  const captainPlayerIds = new Set(
    captains
      .filter((c) => c.player_id)
      .map((c) => c.player_id!)
  )
  return players.filter(
    (p) => !p.drafted_by_captain_id && !captainPlayerIds.has(p.id)
  )
}
