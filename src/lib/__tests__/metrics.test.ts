import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Sentry from '@sentry/react'
import { trackCount, trackDistribution, trackGauge, startTimer } from '../metrics'

vi.mock('@sentry/react', () => ({
  metrics: {
    count: vi.fn(),
    distribution: vi.fn(),
    gauge: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('trackCount', () => {
  it('calls Sentry.metrics.count with prefixed name', () => {
    trackCount('draft.started')
    expect(Sentry.metrics.count).toHaveBeenCalledWith('draft_room.draft.started', 1, {
      attributes: undefined,
    })
  })

  it('passes attributes', () => {
    trackCount('draft.pick_made', { by_manager: true })
    expect(Sentry.metrics.count).toHaveBeenCalledWith('draft_room.draft.pick_made', 1, {
      attributes: { by_manager: true },
    })
  })
})

describe('trackDistribution', () => {
  it('calls Sentry.metrics.distribution with prefixed name, value, and unit', () => {
    trackDistribution('edge_function.latency', 150, 'millisecond', {
      function_name: 'make-pick',
    })
    expect(Sentry.metrics.distribution).toHaveBeenCalledWith(
      'draft_room.edge_function.latency',
      150,
      { attributes: { function_name: 'make-pick' }, unit: 'millisecond' }
    )
  })
})

describe('trackGauge', () => {
  it('calls Sentry.metrics.gauge with prefixed name and value', () => {
    trackGauge('players.available', 42, 'none')
    expect(Sentry.metrics.gauge).toHaveBeenCalledWith('draft_room.players.available', 42, {
      attributes: undefined,
      unit: 'none',
    })
  })

  it('handles optional unit parameter', () => {
    trackGauge('some.gauge', 10)
    expect(Sentry.metrics.gauge).toHaveBeenCalledWith('draft_room.some.gauge', 10, {
      attributes: undefined,
      unit: undefined,
    })
  })
})

describe('startTimer', () => {
  it('returns a function that measures elapsed time', () => {
    const elapsed = startTimer()

    // Just verify it returns a non-negative number
    const ms = elapsed()
    expect(typeof ms).toBe('number')
    expect(ms).toBeGreaterThanOrEqual(0)
  })

  it('returns integer milliseconds', () => {
    const elapsed = startTimer()
    const ms = elapsed()
    expect(Number.isInteger(ms)).toBe(true)
  })

  it('can be called multiple times and returns increasing values', async () => {
    const elapsed = startTimer()
    const first = elapsed()

    // Wait a tiny bit so the second call is guaranteed to be >= first
    await new Promise((resolve) => setTimeout(resolve, 5))
    const second = elapsed()

    expect(second).toBeGreaterThanOrEqual(first)
  })
})
