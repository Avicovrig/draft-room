import { describe, it, expect } from 'vitest'
import { cn, getInitials, shuffleArray } from '../utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    const isHidden = false
    expect(cn('base', isHidden && 'hidden', 'end')).toBe('base end')
  })

  it('deduplicates conflicting Tailwind classes', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })

  it('handles empty inputs', () => {
    expect(cn()).toBe('')
    expect(cn('')).toBe('')
  })

  it('handles undefined and null', () => {
    expect(cn('a', undefined, null, 'b')).toBe('a b')
  })
})

describe('getInitials', () => {
  it('returns first letter of single name', () => {
    expect(getInitials('Alice')).toBe('A')
  })

  it('returns first two letters for two names', () => {
    expect(getInitials('John Smith')).toBe('JS')
  })

  it('truncates to 2 characters for three+ names', () => {
    expect(getInitials('John Michael Smith')).toBe('JM')
  })

  it('returns uppercase', () => {
    expect(getInitials('john smith')).toBe('JS')
  })

  it('handles single character name', () => {
    expect(getInitials('A')).toBe('A')
  })
})

describe('shuffleArray', () => {
  it('returns a new array with the same elements', () => {
    const input = [1, 2, 3, 4, 5]
    const result = shuffleArray(input)
    expect(result).toHaveLength(input.length)
    expect(result.sort()).toEqual([...input].sort())
  })

  it('does not mutate the original array', () => {
    const input = [1, 2, 3, 4, 5]
    const copy = [...input]
    shuffleArray(input)
    expect(input).toEqual(copy)
  })

  it('handles empty array', () => {
    expect(shuffleArray([])).toEqual([])
  })

  it('handles single-element array', () => {
    expect(shuffleArray([42])).toEqual([42])
  })

  it('produces different orderings over many runs', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    const results = new Set<string>()
    for (let i = 0; i < 50; i++) {
      results.add(JSON.stringify(shuffleArray(input)))
    }
    // With 8 elements and 50 runs, we should get multiple distinct orderings
    expect(results.size).toBeGreaterThan(1)
  })
})
