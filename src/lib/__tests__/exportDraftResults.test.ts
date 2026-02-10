import { describe, it, expect } from 'vitest'
import { formatPickTime } from '../exportDraftResults'

describe('formatPickTime', () => {
  it('formats seconds under a minute', () => {
    expect(formatPickTime(30)).toBe('30s')
    expect(formatPickTime(1)).toBe('1s')
    expect(formatPickTime(59)).toBe('59s')
  })

  it('formats exactly one minute', () => {
    expect(formatPickTime(60)).toBe('1m')
  })

  it('formats minutes with remaining seconds', () => {
    expect(formatPickTime(90)).toBe('1m 30s')
    expect(formatPickTime(125)).toBe('2m 5s')
  })

  it('formats minutes without remaining seconds', () => {
    expect(formatPickTime(120)).toBe('2m')
    expect(formatPickTime(180)).toBe('3m')
  })

  it('rounds fractional seconds', () => {
    expect(formatPickTime(30.4)).toBe('30s')
    expect(formatPickTime(30.6)).toBe('31s')
  })

  it('handles zero', () => {
    expect(formatPickTime(0)).toBe('0s')
  })

  it('rounds remaining seconds in minutes', () => {
    expect(formatPickTime(61.7)).toBe('1m 2s')
  })
})
