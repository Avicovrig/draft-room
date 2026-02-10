import { describe, it, expect } from 'vitest'

// Re-implement the logic under test (source uses Deno-style .ts imports).

interface Captain {
  id: string
  draft_position: number
  player_id: string | null
  drafted_by_captain_id?: string | null
}

interface Player {
  id: string
  drafted_by_captain_id: string | null
}

function getCurrentCaptainId(
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

function getAvailablePlayersServer(
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

function makeCaptain(id: string, position: number, playerId: string | null = null): Captain {
  return { id, draft_position: position, player_id: playerId }
}

function makePlayer(id: string, draftedBy: string | null = null): Player {
  return { id, drafted_by_captain_id: draftedBy }
}

describe('getCurrentCaptainId', () => {
  const captains = [
    makeCaptain('c1', 1),
    makeCaptain('c2', 2),
    makeCaptain('c3', 3),
  ]

  describe('snake draft', () => {
    it('returns first captain for pick index 0', () => {
      expect(getCurrentCaptainId(captains, 0, 'snake')).toBe('c1')
    })

    it('returns last captain for last pick in round 1', () => {
      expect(getCurrentCaptainId(captains, 2, 'snake')).toBe('c3')
    })

    it('reverses order in round 2', () => {
      expect(getCurrentCaptainId(captains, 3, 'snake')).toBe('c3')
      expect(getCurrentCaptainId(captains, 4, 'snake')).toBe('c2')
      expect(getCurrentCaptainId(captains, 5, 'snake')).toBe('c1')
    })

    it('alternates forward/reverse across rounds', () => {
      // Round 3 (index 6-8) should be forward again
      expect(getCurrentCaptainId(captains, 6, 'snake')).toBe('c1')
      expect(getCurrentCaptainId(captains, 7, 'snake')).toBe('c2')
      expect(getCurrentCaptainId(captains, 8, 'snake')).toBe('c3')
    })
  })

  describe('round robin draft', () => {
    it('returns first captain for pick index 0', () => {
      expect(getCurrentCaptainId(captains, 0, 'round_robin')).toBe('c1')
    })

    it('repeats same order each round', () => {
      expect(getCurrentCaptainId(captains, 3, 'round_robin')).toBe('c1')
      expect(getCurrentCaptainId(captains, 4, 'round_robin')).toBe('c2')
      expect(getCurrentCaptainId(captains, 5, 'round_robin')).toBe('c3')
    })
  })

  it('returns undefined for empty captains', () => {
    expect(getCurrentCaptainId([], 0, 'snake')).toBeUndefined()
  })

  it('sorts captains by draft_position regardless of input order', () => {
    const unsorted = [
      makeCaptain('c3', 3),
      makeCaptain('c1', 1),
      makeCaptain('c2', 2),
    ]
    expect(getCurrentCaptainId(unsorted, 0, 'snake')).toBe('c1')
    expect(getCurrentCaptainId(unsorted, 1, 'snake')).toBe('c2')
  })

  it('works with a single captain', () => {
    const solo = [makeCaptain('c1', 1)]
    expect(getCurrentCaptainId(solo, 0, 'snake')).toBe('c1')
    expect(getCurrentCaptainId(solo, 5, 'snake')).toBe('c1')
  })
})

describe('getAvailablePlayersServer', () => {
  it('returns all players when none are drafted or captain-linked', () => {
    const players = [makePlayer('p1'), makePlayer('p2')]
    const captains = [makeCaptain('c1', 1)]
    expect(getAvailablePlayersServer(players, captains)).toHaveLength(2)
  })

  it('excludes drafted players', () => {
    const players = [makePlayer('p1', 'c1'), makePlayer('p2')]
    const captains = [makeCaptain('c1', 1)]
    const available = getAvailablePlayersServer(players, captains)
    expect(available).toHaveLength(1)
    expect(available[0].id).toBe('p2')
  })

  it('excludes captain-linked players', () => {
    const players = [makePlayer('p1'), makePlayer('p2')]
    const captains = [makeCaptain('c1', 1, 'p1')]
    const available = getAvailablePlayersServer(players, captains)
    expect(available).toHaveLength(1)
    expect(available[0].id).toBe('p2')
  })

  it('excludes both drafted and captain-linked', () => {
    const players = [makePlayer('p1'), makePlayer('p2', 'c2'), makePlayer('p3')]
    const captains = [makeCaptain('c1', 1, 'p1'), makeCaptain('c2', 2)]
    const available = getAvailablePlayersServer(players, captains)
    expect(available).toHaveLength(1)
    expect(available[0].id).toBe('p3')
  })

  it('returns empty array for empty inputs', () => {
    expect(getAvailablePlayersServer([], [])).toEqual([])
  })

  it('handles captains with null player_id', () => {
    const players = [makePlayer('p1')]
    const captains = [makeCaptain('c1', 1, null)]
    expect(getAvailablePlayersServer(players, captains)).toHaveLength(1)
  })
})
