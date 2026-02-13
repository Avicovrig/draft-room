import { describe, it, expect } from 'vitest'
import {
  parseNumberFilter,
  matchesNumberFilter,
  parseDateFilter,
  matchesDateFilter,
  isFilterActive,
  SORTABLE_FIELD_TYPES,
} from '../playerFilters'

// ── SORTABLE_FIELD_TYPES ─────────────────────────────────────────────

describe('SORTABLE_FIELD_TYPES', () => {
  it('includes number, date, dropdown, checkbox', () => {
    expect(SORTABLE_FIELD_TYPES.has('number')).toBe(true)
    expect(SORTABLE_FIELD_TYPES.has('date')).toBe(true)
    expect(SORTABLE_FIELD_TYPES.has('dropdown')).toBe(true)
    expect(SORTABLE_FIELD_TYPES.has('checkbox')).toBe(true)
  })

  it('excludes text', () => {
    expect(SORTABLE_FIELD_TYPES.has('text')).toBe(false)
  })
})

// ── Number filters ───────────────────────────────────────────────────

describe('parseNumberFilter', () => {
  it('parses eq operator', () => {
    expect(parseNumberFilter('eq:5')).toEqual({ op: 'eq', value: 5 })
  })

  it('parses gt operator', () => {
    expect(parseNumberFilter('gt:180')).toEqual({ op: 'gt', value: 180 })
  })

  it('parses lt operator', () => {
    expect(parseNumberFilter('lt:10')).toEqual({ op: 'lt', value: 10 })
  })

  it('parses range operator', () => {
    expect(parseNumberFilter('range:5|10')).toEqual({ op: 'range', value: 5, value2: 10 })
  })

  it('handles decimals', () => {
    expect(parseNumberFilter('eq:5.5')).toEqual({ op: 'eq', value: 5.5 })
    expect(parseNumberFilter('range:1.5|3.7')).toEqual({ op: 'range', value: 1.5, value2: 3.7 })
  })

  it('handles negative numbers', () => {
    expect(parseNumberFilter('gt:-5')).toEqual({ op: 'gt', value: -5 })
  })

  it('returns null for empty value after colon', () => {
    expect(parseNumberFilter('gt:')).toBeNull()
    expect(parseNumberFilter('eq:')).toBeNull()
  })

  it('returns null for no colon', () => {
    expect(parseNumberFilter('hello')).toBeNull()
  })

  it('returns null for unknown operator', () => {
    expect(parseNumberFilter('gte:5')).toBeNull()
  })

  it('returns null for non-numeric value', () => {
    expect(parseNumberFilter('eq:abc')).toBeNull()
  })

  it('returns null for incomplete range', () => {
    expect(parseNumberFilter('range:5|')).toBeNull()
    expect(parseNumberFilter('range:|10')).toBeNull()
    expect(parseNumberFilter('range:abc|10')).toBeNull()
  })
})

describe('matchesNumberFilter', () => {
  it('matches eq', () => {
    expect(matchesNumberFilter('5', 'eq:5')).toBe(true)
    expect(matchesNumberFilter('6', 'eq:5')).toBe(false)
  })

  it('matches gt', () => {
    expect(matchesNumberFilter('181', 'gt:180')).toBe(true)
    expect(matchesNumberFilter('180', 'gt:180')).toBe(false)
    expect(matchesNumberFilter('179', 'gt:180')).toBe(false)
  })

  it('matches lt', () => {
    expect(matchesNumberFilter('9', 'lt:10')).toBe(true)
    expect(matchesNumberFilter('10', 'lt:10')).toBe(false)
    expect(matchesNumberFilter('11', 'lt:10')).toBe(false)
  })

  it('matches range (inclusive)', () => {
    expect(matchesNumberFilter('5', 'range:5|10')).toBe(true)
    expect(matchesNumberFilter('7', 'range:5|10')).toBe(true)
    expect(matchesNumberFilter('10', 'range:5|10')).toBe(true)
    expect(matchesNumberFilter('4', 'range:5|10')).toBe(false)
    expect(matchesNumberFilter('11', 'range:5|10')).toBe(false)
  })

  it('returns false for null/empty field value', () => {
    expect(matchesNumberFilter(null, 'eq:5')).toBe(false)
    expect(matchesNumberFilter(undefined, 'eq:5')).toBe(false)
    expect(matchesNumberFilter('', 'eq:5')).toBe(false)
    expect(matchesNumberFilter('  ', 'eq:5')).toBe(false)
  })

  it('returns false for non-numeric field value', () => {
    expect(matchesNumberFilter('abc', 'eq:5')).toBe(false)
  })

  it('returns true for unparseable filter (does not exclude)', () => {
    expect(matchesNumberFilter('5', 'gt:')).toBe(true)
    expect(matchesNumberFilter('5', 'bad')).toBe(true)
  })
})

// ── Date filters ─────────────────────────────────────────────────────

describe('parseDateFilter', () => {
  it('parses after operator', () => {
    expect(parseDateFilter('after:2024-01-01')).toEqual({ op: 'after', value: '2024-01-01' })
  })

  it('parses before operator', () => {
    expect(parseDateFilter('before:2024-06-30')).toEqual({ op: 'before', value: '2024-06-30' })
  })

  it('parses range operator', () => {
    expect(parseDateFilter('range:2024-01-01|2024-06-30')).toEqual({
      op: 'range',
      value: '2024-01-01',
      value2: '2024-06-30',
    })
  })

  it('parses datetime-local values', () => {
    expect(parseDateFilter('range:2024-01-01T10:00|2024-06-30T18:00')).toEqual({
      op: 'range',
      value: '2024-01-01T10:00',
      value2: '2024-06-30T18:00',
    })
  })

  it('returns null for empty value after colon', () => {
    expect(parseDateFilter('after:')).toBeNull()
  })

  it('returns null for no colon', () => {
    expect(parseDateFilter('2024-01-01')).toBeNull()
  })

  it('returns null for unknown operator', () => {
    expect(parseDateFilter('on:2024-01-01')).toBeNull()
  })

  it('returns null for invalid dates', () => {
    expect(parseDateFilter('after:not-a-date')).toBeNull()
    expect(parseDateFilter('range:2024-01-01|not-a-date')).toBeNull()
  })

  it('returns null for incomplete range', () => {
    expect(parseDateFilter('range:2024-01-01|')).toBeNull()
    expect(parseDateFilter('range:|2024-06-30')).toBeNull()
  })
})

describe('matchesDateFilter', () => {
  it('matches after', () => {
    expect(matchesDateFilter('2024-06-15', 'after:2024-01-01')).toBe(true)
    expect(matchesDateFilter('2023-12-31', 'after:2024-01-01')).toBe(false)
    // same day — "after" is exclusive
    expect(matchesDateFilter('2024-01-01', 'after:2024-01-01')).toBe(false)
  })

  it('matches before', () => {
    expect(matchesDateFilter('2023-12-31', 'before:2024-01-01')).toBe(true)
    expect(matchesDateFilter('2024-06-15', 'before:2024-01-01')).toBe(false)
    // same day — "before" is exclusive
    expect(matchesDateFilter('2024-01-01', 'before:2024-01-01')).toBe(false)
  })

  it('matches range (inclusive)', () => {
    expect(matchesDateFilter('2024-01-01', 'range:2024-01-01|2024-06-30')).toBe(true)
    expect(matchesDateFilter('2024-03-15', 'range:2024-01-01|2024-06-30')).toBe(true)
    expect(matchesDateFilter('2024-06-30', 'range:2024-01-01|2024-06-30')).toBe(true)
    expect(matchesDateFilter('2023-12-31', 'range:2024-01-01|2024-06-30')).toBe(false)
    expect(matchesDateFilter('2024-07-01', 'range:2024-01-01|2024-06-30')).toBe(false)
  })

  it('matches datetime-local values', () => {
    expect(matchesDateFilter('2024-03-15T12:00', 'after:2024-01-01T10:00')).toBe(true)
    expect(matchesDateFilter('2024-01-01T09:00', 'after:2024-01-01T10:00')).toBe(false)
  })

  it('returns false for null/empty field value', () => {
    expect(matchesDateFilter(null, 'after:2024-01-01')).toBe(false)
    expect(matchesDateFilter(undefined, 'after:2024-01-01')).toBe(false)
    expect(matchesDateFilter('', 'after:2024-01-01')).toBe(false)
  })

  it('returns false for invalid date field value', () => {
    expect(matchesDateFilter('not-a-date', 'after:2024-01-01')).toBe(false)
  })

  it('returns true for unparseable filter (does not exclude)', () => {
    expect(matchesDateFilter('2024-06-15', 'after:')).toBe(true)
    expect(matchesDateFilter('2024-06-15', 'bad')).toBe(true)
  })
})

// ── isFilterActive ───────────────────────────────────────────────────

describe('isFilterActive', () => {
  it('returns false for empty strings', () => {
    expect(isFilterActive('number', '')).toBe(false)
    expect(isFilterActive('text', '')).toBe(false)
    expect(isFilterActive('date', '  ')).toBe(false)
  })

  it('returns true for complete number filters', () => {
    expect(isFilterActive('number', 'eq:5')).toBe(true)
    expect(isFilterActive('number', 'gt:180')).toBe(true)
    expect(isFilterActive('number', 'range:5|10')).toBe(true)
  })

  it('returns false for incomplete number filters', () => {
    expect(isFilterActive('number', 'gt:')).toBe(false)
    expect(isFilterActive('number', 'range:5|')).toBe(false)
  })

  it('returns true for complete date filters', () => {
    expect(isFilterActive('date', 'after:2024-01-01')).toBe(true)
    expect(isFilterActive('date', 'range:2024-01-01|2024-06-30')).toBe(true)
  })

  it('returns false for incomplete date filters', () => {
    expect(isFilterActive('date', 'after:')).toBe(false)
    expect(isFilterActive('date', 'range:2024-01-01|')).toBe(false)
  })

  it('returns true for non-empty text/dropdown/checkbox filters', () => {
    expect(isFilterActive('text', 'hello')).toBe(true)
    expect(isFilterActive('dropdown', 'option1')).toBe(true)
    expect(isFilterActive('checkbox', 'true')).toBe(true)
  })
})
