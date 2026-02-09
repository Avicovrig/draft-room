import { describe, it, expect, vi, afterEach } from 'vitest'
import type { CaptainPublic, PlayerPublic } from '../types'
import {
  getPickOrder,
  getCaptainAtPick,
  getCurrentRound,
  isValidTransition,
  getRemainingTime,
  isTimerExpired,
  formatTime,
  getTimeUntilStart,
  formatCountdown,
  toDatetimeLocal,
  fromDatetimeLocal,
  getAvailablePlayers,
} from '../draft'

// --- Helpers ---

function makeCaptain(overrides: Partial<CaptainPublic> & { id: string; draft_position: number }): CaptainPublic {
  return {
    league_id: 'league-1',
    name: `Captain ${overrides.draft_position}`,
    is_participant: false,
    player_id: null,
    auto_pick_enabled: false,
    team_color: null,
    team_name: null,
    team_photo_url: null,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

function makePlayer(overrides: Partial<PlayerPublic> & { id: string }): PlayerPublic {
  return {
    league_id: 'league-1',
    name: `Player ${overrides.id}`,
    drafted_by_captain_id: null,
    draft_pick_number: null,
    bio: null,
    profile_picture_url: null,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

// --- getPickOrder ---

describe('getPickOrder', () => {
  const captains = [
    makeCaptain({ id: 'c1', draft_position: 1 }),
    makeCaptain({ id: 'c2', draft_position: 2 }),
    makeCaptain({ id: 'c3', draft_position: 3 }),
  ]

  it('returns empty array for no captains', () => {
    expect(getPickOrder([], 10, 'snake')).toEqual([])
  })

  it('returns empty array for zero picks', () => {
    expect(getPickOrder(captains, 0, 'snake')).toEqual([])
  })

  describe('snake draft', () => {
    it('generates correct order for round 1 (forward)', () => {
      expect(getPickOrder(captains, 3, 'snake')).toEqual(['c1', 'c2', 'c3'])
    })

    it('reverses for round 2', () => {
      expect(getPickOrder(captains, 6, 'snake')).toEqual([
        'c1', 'c2', 'c3',
        'c3', 'c2', 'c1',
      ])
    })

    it('alternates forward/reverse across multiple rounds', () => {
      expect(getPickOrder(captains, 9, 'snake')).toEqual([
        'c1', 'c2', 'c3',
        'c3', 'c2', 'c1',
        'c1', 'c2', 'c3',
      ])
    })

    it('truncates to exact totalPicks', () => {
      const order = getPickOrder(captains, 4, 'snake')
      expect(order).toEqual(['c1', 'c2', 'c3', 'c3'])
      expect(order.length).toBe(4)
    })
  })

  describe('round robin draft', () => {
    it('repeats same order every round', () => {
      expect(getPickOrder(captains, 6, 'round_robin')).toEqual([
        'c1', 'c2', 'c3',
        'c1', 'c2', 'c3',
      ])
    })

    it('truncates to exact totalPicks', () => {
      expect(getPickOrder(captains, 4, 'round_robin')).toEqual([
        'c1', 'c2', 'c3', 'c1',
      ])
    })
  })

  it('sorts captains by draft_position regardless of input order', () => {
    const unsorted = [
      makeCaptain({ id: 'c3', draft_position: 3 }),
      makeCaptain({ id: 'c1', draft_position: 1 }),
      makeCaptain({ id: 'c2', draft_position: 2 }),
    ]
    expect(getPickOrder(unsorted, 3, 'snake')).toEqual(['c1', 'c2', 'c3'])
  })

  it('works with a single captain', () => {
    const solo = [makeCaptain({ id: 'c1', draft_position: 1 })]
    expect(getPickOrder(solo, 5, 'snake')).toEqual(['c1', 'c1', 'c1', 'c1', 'c1'])
  })
})

// --- getCaptainAtPick ---

describe('getCaptainAtPick', () => {
  const captains = [
    makeCaptain({ id: 'c1', draft_position: 1 }),
    makeCaptain({ id: 'c2', draft_position: 2 }),
  ]

  it('returns correct captain for first pick', () => {
    expect(getCaptainAtPick(captains, 0, 'snake')?.id).toBe('c1')
  })

  it('returns correct captain for second pick', () => {
    expect(getCaptainAtPick(captains, 1, 'snake')?.id).toBe('c2')
  })

  it('reverses in snake draft round 2', () => {
    expect(getCaptainAtPick(captains, 2, 'snake')?.id).toBe('c2')
    expect(getCaptainAtPick(captains, 3, 'snake')?.id).toBe('c1')
  })

  it('repeats in round robin', () => {
    expect(getCaptainAtPick(captains, 2, 'round_robin')?.id).toBe('c1')
    expect(getCaptainAtPick(captains, 3, 'round_robin')?.id).toBe('c2')
  })

  it('returns undefined for empty captains', () => {
    expect(getCaptainAtPick([], 0, 'snake')).toBeUndefined()
  })
})

// --- getCurrentRound ---

describe('getCurrentRound', () => {
  it('returns 1 for the first pick', () => {
    expect(getCurrentRound(0, 4)).toBe(1)
  })

  it('returns 1 for last pick of first round', () => {
    expect(getCurrentRound(3, 4)).toBe(1)
  })

  it('returns 2 for first pick of second round', () => {
    expect(getCurrentRound(4, 4)).toBe(2)
  })

  it('returns 0 when there are no captains', () => {
    expect(getCurrentRound(0, 0)).toBe(0)
  })
})

// --- isValidTransition ---

describe('isValidTransition', () => {
  it('allows not_started -> in_progress', () => {
    expect(isValidTransition('not_started', 'in_progress')).toBe(true)
  })

  it('allows in_progress -> paused', () => {
    expect(isValidTransition('in_progress', 'paused')).toBe(true)
  })

  it('allows in_progress -> completed', () => {
    expect(isValidTransition('in_progress', 'completed')).toBe(true)
  })

  it('allows paused -> in_progress', () => {
    expect(isValidTransition('paused', 'in_progress')).toBe(true)
  })

  it('allows paused -> not_started (restart)', () => {
    expect(isValidTransition('paused', 'not_started')).toBe(true)
  })

  it('rejects not_started -> paused', () => {
    expect(isValidTransition('not_started', 'paused')).toBe(false)
  })

  it('rejects not_started -> completed', () => {
    expect(isValidTransition('not_started', 'completed')).toBe(false)
  })

  it('rejects completed -> anything', () => {
    expect(isValidTransition('completed', 'not_started')).toBe(false)
    expect(isValidTransition('completed', 'in_progress')).toBe(false)
    expect(isValidTransition('completed', 'paused')).toBe(false)
  })

  it('rejects same-state transitions', () => {
    expect(isValidTransition('in_progress', 'in_progress')).toBe(false)
    expect(isValidTransition('paused', 'paused')).toBe(false)
  })
})

// --- getRemainingTime ---

describe('getRemainingTime', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns full time when no start time', () => {
    expect(getRemainingTime(null, 60)).toBe(60)
  })

  it('returns remaining time based on elapsed', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const startedAt = new Date(now - 30_000).toISOString() // 30 seconds ago
    const remaining = getRemainingTime(startedAt, 60)
    expect(remaining).toBeCloseTo(30, 0)
  })

  it('returns 0 when timer has expired', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const startedAt = new Date(now - 120_000).toISOString() // 2 minutes ago
    expect(getRemainingTime(startedAt, 60)).toBe(0)
  })

  it('never returns negative values', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const startedAt = new Date(now - 999_000).toISOString()
    expect(getRemainingTime(startedAt, 60)).toBe(0)
  })
})

// --- isTimerExpired ---

describe('isTimerExpired', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns false when no start time', () => {
    expect(isTimerExpired(null, 60)).toBe(false)
  })

  it('returns false when time remains', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const startedAt = new Date(now - 10_000).toISOString()
    expect(isTimerExpired(startedAt, 60)).toBe(false)
  })

  it('returns true when time has expired', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const startedAt = new Date(now - 61_000).toISOString()
    expect(isTimerExpired(startedAt, 60)).toBe(true)
  })
})

// --- formatTime ---

describe('formatTime', () => {
  it('formats zero seconds', () => {
    expect(formatTime(0)).toBe('0:00')
  })

  it('formats seconds only', () => {
    expect(formatTime(45)).toBe('0:45')
  })

  it('formats minutes and seconds', () => {
    expect(formatTime(125)).toBe('2:05')
  })

  it('pads single-digit seconds', () => {
    expect(formatTime(61)).toBe('1:01')
  })

  it('handles fractional seconds by flooring', () => {
    expect(formatTime(59.9)).toBe('0:59')
  })
})

// --- getTimeUntilStart ---

describe('getTimeUntilStart', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null when date is in the past', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(getTimeUntilStart(past)).toBeNull()
  })

  it('returns time breakdown for future date', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    // 1 day, 2 hours, 30 minutes, 15 seconds from now
    const ms = (1 * 24 * 60 * 60 + 2 * 60 * 60 + 30 * 60 + 15) * 1000
    const future = new Date(now + ms).toISOString()

    const result = getTimeUntilStart(future)
    expect(result).not.toBeNull()
    expect(result!.days).toBe(1)
    expect(result!.hours).toBe(2)
    expect(result!.minutes).toBe(30)
    expect(result!.seconds).toBe(15)
    expect(result!.totalMs).toBe(ms)
  })
})

// --- formatCountdown ---

describe('formatCountdown', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns "Starting soon!" for past dates', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(formatCountdown(past)).toBe('Starting soon!')
  })

  it('shows days and hours when days > 0', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const future = new Date(now + 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString()
    expect(formatCountdown(future)).toBe('2d 3h')
  })

  it('shows hours and minutes when hours > 0 but no days', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const future = new Date(now + 5 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString()
    expect(formatCountdown(future)).toBe('5h 30m')
  })

  it('shows minutes only when less than an hour', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const future = new Date(now + 15 * 60 * 1000).toISOString()
    expect(formatCountdown(future)).toBe('15m')
  })

  it('returns "Less than a minute" for very near future', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const future = new Date(now + 30 * 1000).toISOString()
    expect(formatCountdown(future)).toBe('Less than a minute')
  })
})

// --- toDatetimeLocal ---

describe('toDatetimeLocal', () => {
  it('returns empty string for null', () => {
    expect(toDatetimeLocal(null)).toBe('')
  })

  it('formats ISO string to datetime-local format', () => {
    // Create a date and verify the output matches local time formatting
    const date = new Date(2025, 5, 15, 14, 30) // June 15, 2025 at 2:30 PM local
    const result = toDatetimeLocal(date.toISOString())
    expect(result).toBe('2025-06-15T14:30')
  })
})

// --- fromDatetimeLocal ---

describe('fromDatetimeLocal', () => {
  it('returns null for empty string', () => {
    expect(fromDatetimeLocal('')).toBeNull()
  })

  it('converts datetime-local value to ISO string', () => {
    const result = fromDatetimeLocal('2025-06-15T14:30')
    expect(result).toBeTruthy()
    // Verify it's a valid ISO string
    expect(new Date(result!).toISOString()).toBe(result)
  })
})

// --- getAvailablePlayers ---

describe('getAvailablePlayers', () => {
  it('returns all players when none are drafted or captain-linked', () => {
    const players = [
      makePlayer({ id: 'p1' }),
      makePlayer({ id: 'p2' }),
      makePlayer({ id: 'p3' }),
    ]
    const captains = [
      makeCaptain({ id: 'c1', draft_position: 1 }),
    ]
    expect(getAvailablePlayers(players, captains)).toHaveLength(3)
  })

  it('excludes drafted players', () => {
    const players = [
      makePlayer({ id: 'p1', drafted_by_captain_id: 'c1' }),
      makePlayer({ id: 'p2' }),
    ]
    const captains = [makeCaptain({ id: 'c1', draft_position: 1 })]
    const available = getAvailablePlayers(players, captains)
    expect(available).toHaveLength(1)
    expect(available[0].id).toBe('p2')
  })

  it('excludes captain-linked players', () => {
    const players = [
      makePlayer({ id: 'p1' }),
      makePlayer({ id: 'p2' }),
    ]
    const captains = [
      makeCaptain({ id: 'c1', draft_position: 1, player_id: 'p1' }),
    ]
    const available = getAvailablePlayers(players, captains)
    expect(available).toHaveLength(1)
    expect(available[0].id).toBe('p2')
  })

  it('excludes both drafted and captain-linked players', () => {
    const players = [
      makePlayer({ id: 'p1' }),
      makePlayer({ id: 'p2', drafted_by_captain_id: 'c2' }),
      makePlayer({ id: 'p3' }),
    ]
    const captains = [
      makeCaptain({ id: 'c1', draft_position: 1, player_id: 'p1' }),
      makeCaptain({ id: 'c2', draft_position: 2 }),
    ]
    const available = getAvailablePlayers(players, captains)
    expect(available).toHaveLength(1)
    expect(available[0].id).toBe('p3')
  })

  it('returns empty array when all players are drafted', () => {
    const players = [
      makePlayer({ id: 'p1', drafted_by_captain_id: 'c1' }),
    ]
    const captains = [makeCaptain({ id: 'c1', draft_position: 1 })]
    expect(getAvailablePlayers(players, captains)).toHaveLength(0)
  })

  it('returns empty array for empty inputs', () => {
    expect(getAvailablePlayers([], [])).toEqual([])
  })

  it('handles captains with null player_id', () => {
    const players = [makePlayer({ id: 'p1' })]
    const captains = [
      makeCaptain({ id: 'c1', draft_position: 1, player_id: null }),
    ]
    expect(getAvailablePlayers(players, captains)).toHaveLength(1)
  })
})
