import { describe, it, expect } from 'vitest'
import { parseCSV } from '@/lib/spreadsheetParsing'

describe('parseCSV', () => {
  it('parses basic comma-separated rows', () => {
    const result = parseCSV('Name,Bio\nAlice,Great player\nBob,Solid defender')
    expect(result).toEqual([
      ['Name', 'Bio'],
      ['Alice', 'Great player'],
      ['Bob', 'Solid defender'],
    ])
  })

  it('handles Windows-style CRLF line endings', () => {
    const result = parseCSV('Name,Bio\r\nAlice,Great\r\nBob,Good')
    expect(result).toEqual([
      ['Name', 'Bio'],
      ['Alice', 'Great'],
      ['Bob', 'Good'],
    ])
  })

  it('handles quoted fields containing commas', () => {
    const result = parseCSV('Name,Note\nAlice,"Plays offense, defense"\nBob,All-rounder')
    expect(result).toEqual([
      ['Name', 'Note'],
      ['Alice', 'Plays offense, defense'],
      ['Bob', 'All-rounder'],
    ])
  })

  it('handles escaped quotes (double-quote within quoted field)', () => {
    const result = parseCSV('Name,Note\nAlice,"He said ""hello"""\n')
    expect(result).toEqual([
      ['Name', 'Note'],
      ['Alice', 'He said "hello"'],
    ])
  })

  it('trims whitespace from unquoted fields', () => {
    const result = parseCSV('Name , Bio \n Alice , Great player ')
    expect(result).toEqual([
      ['Name', 'Bio'],
      ['Alice', 'Great player'],
    ])
  })

  it('skips blank lines', () => {
    const result = parseCSV('Name,Bio\n\nAlice,Great\n\n')
    expect(result).toEqual([
      ['Name', 'Bio'],
      ['Alice', 'Great'],
    ])
  })

  it('handles trailing newline without extra empty row', () => {
    const result = parseCSV('Name,Bio\nAlice,Great\n')
    expect(result).toEqual([
      ['Name', 'Bio'],
      ['Alice', 'Great'],
    ])
  })

  it('handles single column', () => {
    const result = parseCSV('Name\nAlice\nBob')
    expect(result).toEqual([['Name'], ['Alice'], ['Bob']])
  })

  it('handles empty string input', () => {
    const result = parseCSV('')
    expect(result).toEqual([])
  })

  it('handles empty fields', () => {
    const result = parseCSV('Name,Bio\nAlice,\nBob,Good')
    expect(result).toEqual([
      ['Name', 'Bio'],
      ['Alice', ''],
      ['Bob', 'Good'],
    ])
  })
})
