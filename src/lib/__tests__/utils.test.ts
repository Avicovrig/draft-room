import { describe, it, expect } from 'vitest'
import { cn, getInitials } from '../utils'

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
