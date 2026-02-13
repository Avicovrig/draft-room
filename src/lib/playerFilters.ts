/** Field types that support sorting (text fields are excluded — name sort covers them). */
export const SORTABLE_FIELD_TYPES = new Set(['number', 'date', 'dropdown', 'checkbox'])

// ── Number filters ───────────────────────────────────────────────────

export interface NumberFilter {
  op: 'eq' | 'gt' | 'lt' | 'range'
  value: number
  value2?: number
}

export function parseNumberFilter(encoded: string): NumberFilter | null {
  const colonIdx = encoded.indexOf(':')
  if (colonIdx === -1) return null
  const op = encoded.slice(0, colonIdx)
  const rest = encoded.slice(colonIdx + 1)
  if (!rest) return null

  if (op === 'range') {
    const [a, b] = rest.split('|')
    const numA = parseFloat(a)
    const numB = parseFloat(b)
    if (isNaN(numA) || isNaN(numB)) return null
    return { op: 'range', value: numA, value2: numB }
  }

  if (op === 'eq' || op === 'gt' || op === 'lt') {
    const num = parseFloat(rest)
    if (isNaN(num)) return null
    return { op, value: num }
  }

  return null
}

export function matchesNumberFilter(
  fieldValue: string | null | undefined,
  encoded: string
): boolean {
  const filter = parseNumberFilter(encoded)
  if (!filter) return true // unparseable → don't exclude
  if (!fieldValue || !fieldValue.trim()) return false

  const num = parseFloat(fieldValue)
  if (isNaN(num)) return false

  switch (filter.op) {
    case 'eq':
      return num === filter.value
    case 'gt':
      return num > filter.value
    case 'lt':
      return num < filter.value
    case 'range':
      return num >= filter.value && num <= filter.value2!
  }
}

// ── Date filters ─────────────────────────────────────────────────────

export interface DateFilter {
  op: 'after' | 'before' | 'range'
  value: string
  value2?: string
}

export function parseDateFilter(encoded: string): DateFilter | null {
  const colonIdx = encoded.indexOf(':')
  if (colonIdx === -1) return null
  const op = encoded.slice(0, colonIdx)
  const rest = encoded.slice(colonIdx + 1)
  if (!rest) return null

  if (op === 'range') {
    const pipeIdx = rest.indexOf('|')
    if (pipeIdx === -1) return null
    const a = rest.slice(0, pipeIdx)
    const b = rest.slice(pipeIdx + 1)
    if (!a || !b) return null
    if (isNaN(new Date(a).getTime()) || isNaN(new Date(b).getTime())) return null
    return { op: 'range', value: a, value2: b }
  }

  if (op === 'after' || op === 'before') {
    if (isNaN(new Date(rest).getTime())) return null
    return { op, value: rest }
  }

  return null
}

export function matchesDateFilter(fieldValue: string | null | undefined, encoded: string): boolean {
  const filter = parseDateFilter(encoded)
  if (!filter) return true // unparseable → don't exclude
  if (!fieldValue || !fieldValue.trim()) return false

  const date = new Date(fieldValue).getTime()
  if (isNaN(date)) return false

  switch (filter.op) {
    case 'after':
      return date > new Date(filter.value).getTime()
    case 'before':
      return date < new Date(filter.value).getTime()
    case 'range': {
      const start = new Date(filter.value).getTime()
      const end = new Date(filter.value2!).getTime()
      return date >= start && date <= end
    }
  }
}

// ── Active filter detection ──────────────────────────────────────────

/**
 * Returns true if the encoded filter value represents a complete, active filter.
 * Incomplete filters (e.g. "gt:" with no value) return false.
 */
export function isFilterActive(fieldType: string, encoded: string): boolean {
  if (!encoded || !encoded.trim()) return false

  switch (fieldType) {
    case 'number':
      return parseNumberFilter(encoded) !== null
    case 'date':
      return parseDateFilter(encoded) !== null
    default:
      // text, dropdown, checkbox — any non-empty value is active
      return encoded.trim().length > 0
  }
}
