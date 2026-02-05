import type { LeagueStatus, DraftType, Captain } from './types'

/**
 * Calculate the pick order for a draft
 * @param captains - Array of captains sorted by draft_position
 * @param totalPicks - Total number of picks to make
 * @param draftType - 'snake' or 'round_robin'
 * @returns Array of captain IDs in pick order
 */
export function getPickOrder(
  captains: Captain[],
  totalPicks: number,
  draftType: DraftType
): string[] {
  if (captains.length === 0) return []

  const sortedCaptains = [...captains].sort((a, b) => a.draft_position - b.draft_position)
  const captainIds = sortedCaptains.map((c) => c.id)
  const order: string[] = []

  for (let round = 0; order.length < totalPicks; round++) {
    const roundOrder =
      draftType === 'snake' && round % 2 === 1
        ? [...captainIds].reverse()
        : captainIds
    order.push(...roundOrder)
  }

  return order.slice(0, totalPicks)
}

/**
 * Get the captain who should pick at a given index
 */
export function getCaptainAtPick(
  captains: Captain[],
  pickIndex: number,
  draftType: DraftType
): Captain | undefined {
  const order = getPickOrder(captains, pickIndex + 1, draftType)
  const captainId = order[pickIndex]
  return captains.find((c) => c.id === captainId)
}

/**
 * Get the current round number (1-indexed)
 */
export function getCurrentRound(pickIndex: number, captainCount: number): number {
  if (captainCount === 0) return 0
  return Math.floor(pickIndex / captainCount) + 1
}

/**
 * Check if a draft status transition is valid
 */
export function isValidTransition(
  currentStatus: LeagueStatus,
  newStatus: LeagueStatus
): boolean {
  const validTransitions: Record<LeagueStatus, LeagueStatus[]> = {
    not_started: ['in_progress'],
    in_progress: ['paused', 'completed'],
    paused: ['in_progress', 'not_started'],
    completed: [],
  }

  return validTransitions[currentStatus].includes(newStatus)
}

/**
 * Calculate remaining time for current pick
 */
export function getRemainingTime(
  currentPickStartedAt: string | null,
  timeLimitSeconds: number
): number {
  if (!currentPickStartedAt) return timeLimitSeconds

  const startTime = new Date(currentPickStartedAt).getTime()
  const elapsed = (Date.now() - startTime) / 1000
  return Math.max(0, timeLimitSeconds - elapsed)
}

/**
 * Check if timer has expired
 */
export function isTimerExpired(
  currentPickStartedAt: string | null,
  timeLimitSeconds: number
): boolean {
  return getRemainingTime(currentPickStartedAt, timeLimitSeconds) <= 0
}

/**
 * Format seconds as MM:SS
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
