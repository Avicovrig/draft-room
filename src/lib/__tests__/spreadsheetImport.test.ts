import { describe, it, expect } from 'vitest'
import { suggestMappings, transformData } from '../spreadsheetParsing'
import type { SpreadsheetData } from '../spreadsheetTypes'
import type { LeagueFieldSchema } from '../types'

function makeSchema(overrides: Partial<LeagueFieldSchema> & { id: string; field_name: string }): LeagueFieldSchema {
  return {
    league_id: 'league-1',
    field_type: 'text',
    field_order: 0,
    field_options: null,
    is_required: false,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('suggestMappings', () => {
  it('maps "Name" header to standard name field', () => {
    const mappings = suggestMappings(['Name'])
    expect(mappings['Name']).toEqual({ type: 'standard', field: 'name' })
  })

  it('maps "Player Name" header to standard name field', () => {
    const mappings = suggestMappings(['Player Name'])
    expect(mappings['Player Name']).toEqual({ type: 'standard', field: 'name' })
  })

  it('maps "Bio" header to standard bio field', () => {
    const mappings = suggestMappings(['Bio'])
    expect(mappings['Bio']).toEqual({ type: 'standard', field: 'bio' })
  })

  it('maps "Description" and "About" to bio', () => {
    expect(suggestMappings(['Description'])['Description']).toEqual({ type: 'standard', field: 'bio' })
    expect(suggestMappings(['About'])['About']).toEqual({ type: 'standard', field: 'bio' })
  })

  it('maps unknown headers as custom fields', () => {
    const mappings = suggestMappings(['Name', 'Skill Level'])
    expect(mappings['Skill Level']).toEqual({ type: 'custom', fieldName: 'Skill Level' })
  })

  it('maps empty headers as skip', () => {
    const mappings = suggestMappings(['Name', ''])
    expect(mappings['']).toEqual({ type: 'skip' })
  })

  it('does not duplicate standard field assignments', () => {
    const mappings = suggestMappings(['Name', 'Player'])
    // First match gets "name", second should be custom
    expect(mappings['Name']).toEqual({ type: 'standard', field: 'name' })
    expect(mappings['Player']).toEqual({ type: 'custom', fieldName: 'Player' })
  })

  it('matches field schemas by name (case-insensitive)', () => {
    const schemas = [makeSchema({ id: 's1', field_name: 'Position' })]
    const mappings = suggestMappings(['Name', 'position'], schemas)
    expect(mappings['position']).toEqual({ type: 'schema', schemaId: 's1', fieldName: 'Position' })
  })

  it('strips required marker (*) when matching schemas', () => {
    const schemas = [makeSchema({ id: 's1', field_name: 'Position', is_required: true })]
    const mappings = suggestMappings(['Position *'], schemas)
    expect(mappings['Position *']).toEqual({ type: 'schema', schemaId: 's1', fieldName: 'Position' })
  })

  it('does not reuse the same schema for multiple headers', () => {
    const schemas = [makeSchema({ id: 's1', field_name: 'Position' })]
    const mappings = suggestMappings(['Position', 'position'], schemas)
    expect(mappings['Position']).toEqual({ type: 'schema', schemaId: 's1', fieldName: 'Position' })
    expect(mappings['position']).toEqual({ type: 'custom', fieldName: 'position' })
  })
})

describe('transformData', () => {
  const baseData: SpreadsheetData = {
    headers: ['Name', 'Bio', 'Skill'],
    rows: [
      ['Alice', 'Great player', 'High'],
      ['Bob', '', 'Medium'],
      ['', 'No name', 'Low'],
    ],
    fileName: 'test.xlsx',
  }

  const baseMappings = {
    'Name': { type: 'standard' as const, field: 'name' as const },
    'Bio': { type: 'standard' as const, field: 'bio' as const },
    'Skill': { type: 'custom' as const, fieldName: 'Skill' },
  }

  it('transforms rows into parsed players', () => {
    const players = transformData(baseData, baseMappings, true)
    expect(players).toHaveLength(3)
    expect(players[0].name).toBe('Alice')
    expect(players[0].bio).toBe('Great player')
    expect(players[0].customFields).toEqual([{ field_name: 'Skill', field_value: 'High' }])
  })

  it('marks players without a name as invalid', () => {
    const players = transformData(baseData, baseMappings, true)
    const noNamePlayer = players[2]
    expect(noNamePlayer.isValid).toBe(false)
    expect(noNamePlayer.isSelected).toBe(false)
    expect(noNamePlayer.errors).toContain('Name is required')
  })

  it('marks valid players as selected by default', () => {
    const players = transformData(baseData, baseMappings, true)
    expect(players[0].isSelected).toBe(true)
    expect(players[0].isValid).toBe(true)
  })

  it('computes correct row numbers (1-based, header-aware)', () => {
    const players = transformData(baseData, baseMappings, true)
    // skipFirstRow=true: rows start at data row 2 (header is row 1)
    expect(players[0].rowNumber).toBe(2)
    expect(players[1].rowNumber).toBe(3)
    expect(players[2].rowNumber).toBe(4)
  })

  it('includes header row as data when skipFirstRow=false', () => {
    const players = transformData(baseData, baseMappings, false)
    // Header row treated as data + 3 data rows = 4 players
    expect(players).toHaveLength(4)
    expect(players[0].name).toBe('Name') // header becomes data
    expect(players[0].rowNumber).toBe(1)
  })

  it('skips columns mapped as skip', () => {
    const mappings = {
      'Name': { type: 'standard' as const, field: 'name' as const },
      'Bio': { type: 'skip' as const },
      'Skill': { type: 'skip' as const },
    }
    const players = transformData(baseData, mappings, true)
    expect(players[0].bio).toBeUndefined()
    expect(players[0].customFields).toEqual([])
  })

  it('skips empty custom field values', () => {
    const players = transformData(baseData, baseMappings, true)
    // Bob has empty bio but non-empty Skill
    const bob = players[1]
    expect(bob.bio).toBeUndefined() // empty string -> undefined
    expect(bob.customFields).toEqual([{ field_name: 'Skill', field_value: 'Medium' }])
  })

  it('maps schema fields with schema_id', () => {
    const schemas = [makeSchema({ id: 's1', field_name: 'Skill', field_type: 'text' })]
    const mappings = {
      'Name': { type: 'standard' as const, field: 'name' as const },
      'Bio': { type: 'skip' as const },
      'Skill': { type: 'schema' as const, schemaId: 's1', fieldName: 'Skill' },
    }
    const players = transformData(baseData, mappings, true, schemas)
    expect(players[0].customFields[0]).toEqual({
      field_name: 'Skill',
      field_value: 'High',
      schema_id: 's1',
    })
  })

  it('normalizes checkbox values for schema fields', () => {
    const schemas = [makeSchema({ id: 's1', field_name: 'Active', field_type: 'checkbox' })]
    const data: SpreadsheetData = {
      headers: ['Name', 'Active'],
      rows: [['Alice', 'Yes'], ['Bob', 'No'], ['Charlie', 'true']],
      fileName: 'test.xlsx',
    }
    const mappings = {
      'Name': { type: 'standard' as const, field: 'name' as const },
      'Active': { type: 'schema' as const, schemaId: 's1', fieldName: 'Active' },
    }
    const players = transformData(data, mappings, true, schemas)
    expect(players[0].customFields[0].field_value).toBe('true')
    expect(players[1].customFields[0].field_value).toBe('false')
    expect(players[2].customFields[0].field_value).toBe('true')
  })

  it('normalizes number values with units for schema fields', () => {
    const schemas = [makeSchema({ id: 's1', field_name: 'Height', field_type: 'number', field_options: { unit: 'cm' } })]
    const data: SpreadsheetData = {
      headers: ['Name', 'Height'],
      rows: [['Alice', '170 cm']],
      fileName: 'test.xlsx',
    }
    const mappings = {
      'Name': { type: 'standard' as const, field: 'name' as const },
      'Height': { type: 'schema' as const, schemaId: 's1', fieldName: 'Height' },
    }
    const players = transformData(data, mappings, true, schemas)
    expect(players[0].customFields[0].field_value).toBe('170')
  })
})
