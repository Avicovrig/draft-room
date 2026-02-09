import type { LeagueStatus, DraftType, CaptainPublic, PlayerPublic } from './types'

/**
 * Calculate the pick order for a draft
 * @param captains - Array of captains sorted by draft_position
 * @param totalPicks - Total number of picks to make
 * @param draftType - 'snake' or 'round_robin'
 * @returns Array of captain IDs in pick order
 */
export function getPickOrder(
  captains: CaptainPublic[],
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
  captains: CaptainPublic[],
  pickIndex: number,
  draftType: DraftType
): CaptainPublic | undefined {
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

/**
 * Format scheduled start time for display
 */
export function formatScheduledTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

/**
 * Get time remaining until scheduled start
 */
export function getTimeUntilStart(dateString: string): {
  days: number
  hours: number
  minutes: number
  seconds: number
  totalMs: number
} | null {
  const targetTime = new Date(dateString).getTime()
  const now = Date.now()
  const diff = targetTime - now

  if (diff <= 0) return null

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  return { days, hours, minutes, seconds, totalMs: diff }
}

/**
 * Format countdown for display
 */
export function formatCountdown(dateString: string): string {
  const timeUntil = getTimeUntilStart(dateString)

  if (!timeUntil) return 'Starting soon!'

  const { days, hours, minutes } = timeUntil

  if (days > 0) {
    return `${days}d ${hours}h`
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else if (minutes > 0) {
    return `${minutes}m`
  } else {
    return 'Less than a minute'
  }
}

/**
 * Convert ISO string to datetime-local input value
 */
export function toDatetimeLocal(dateString: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  // Format: YYYY-MM-DDTHH:mm
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

/**
 * Convert datetime-local input value to ISO string
 */
export function fromDatetimeLocal(value: string): string | null {
  if (!value) return null
  return new Date(value).toISOString()
}

/**
 * Get players available for drafting (not drafted and not linked to a captain).
 * NOTE: This logic is duplicated in edge functions (make-pick, auto-pick) for
 * server-side validation. Keep them in sync when modifying.
 */
export function getAvailablePlayers(players: PlayerPublic[], captains: CaptainPublic[]): PlayerPublic[] {
  const captainPlayerIds = new Set(
    captains.filter((c) => c.player_id).map((c) => c.player_id)
  )
  return players.filter((p) => !p.drafted_by_captain_id && !captainPlayerIds.has(p.id))
}
