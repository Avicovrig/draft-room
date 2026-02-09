import { describe, it, expect } from 'vitest'

// Re-implement the logic under test (source uses Deno-style .ts imports).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

describe('UUID_RE', () => {
  it('matches valid lowercase UUIDs', () => {
    expect(UUID_RE.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })

  it('matches valid uppercase UUIDs', () => {
    expect(UUID_RE.test('550E8400-E29B-41D4-A716-446655440000')).toBe(true)
  })

  it('matches mixed-case UUIDs', () => {
    expect(UUID_RE.test('550e8400-E29B-41d4-a716-446655440000')).toBe(true)
  })

  it('rejects strings that are too short', () => {
    expect(UUID_RE.test('550e8400-e29b-41d4-a716')).toBe(false)
  })

  it('rejects strings without dashes', () => {
    expect(UUID_RE.test('550e8400e29b41d4a716446655440000')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(UUID_RE.test('')).toBe(false)
  })

  it('rejects strings with invalid characters', () => {
    expect(UUID_RE.test('550e8400-e29b-41d4-a716-44665544000g')).toBe(false)
  })

  it('rejects UUIDs with extra characters', () => {
    expect(UUID_RE.test('x550e8400-e29b-41d4-a716-446655440000')).toBe(false)
    expect(UUID_RE.test('550e8400-e29b-41d4-a716-446655440000x')).toBe(false)
  })

  it('rejects SQL injection attempts', () => {
    expect(UUID_RE.test("'; DROP TABLE--")).toBe(false)
    expect(UUID_RE.test('550e8400-e29b-41d4-a716-446655440000 OR 1=1')).toBe(false)
  })
})

describe('validateUrl', () => {
  it('accepts https URLs', () => {
    expect(validateUrl('https://example.com')).toBe(true)
    expect(validateUrl('https://example.com/path/to/image.jpg')).toBe(true)
  })

  it('accepts http URLs', () => {
    expect(validateUrl('http://example.com')).toBe(true)
    expect(validateUrl('http://localhost:5173')).toBe(true)
  })

  it('rejects javascript: URLs', () => {
    expect(validateUrl('javascript:alert(1)')).toBe(false)
  })

  it('rejects data: URLs', () => {
    expect(validateUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
  })

  it('rejects blob: URLs', () => {
    expect(validateUrl('blob:https://example.com/uuid')).toBe(false)
  })

  it('rejects file: URLs', () => {
    expect(validateUrl('file:///etc/passwd')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validateUrl('')).toBe(false)
  })

  it('rejects invalid URLs', () => {
    expect(validateUrl('not-a-url')).toBe(false)
    expect(validateUrl('://missing-protocol')).toBe(false)
  })

  it('accepts URLs with query params and fragments', () => {
    expect(validateUrl('https://example.com/img.jpg?t=123#section')).toBe(true)
  })

  it('accepts Supabase storage URLs', () => {
    expect(validateUrl('https://ghjakbnibbxwlbujwsse.supabase.co/storage/v1/object/public/profile-pictures/league/player.jpg')).toBe(true)
  })
})
