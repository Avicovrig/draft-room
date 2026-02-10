import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  SpreadsheetData,
  PlayerFieldMapping,
  ParsedPlayer,
  ImportResult,
  StandardPlayerField,
} from '@/lib/spreadsheetTypes'
import type { LeagueFieldSchema } from '@/lib/types'

const STANDARD_FIELDS: StandardPlayerField[] = ['name', 'bio']

// Auto-detection patterns for column headers
const FIELD_PATTERNS: Record<StandardPlayerField, RegExp[]> = {
  name: [/^name$/i, /^player$/i, /player\s*name/i, /full\s*name/i],
  bio: [/^bio$/i, /^about$/i, /^description$/i],
}

export function parseFile(file: File): Promise<SpreadsheetData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = async (e) => {
      try {
        const ExcelJS = await import('exceljs')
        const data = e.target?.result
        if (!data || !(data instanceof ArrayBuffer)) {
          reject(new Error('Failed to read file data'))
          return
        }

        const workbook = new ExcelJS.default.Workbook()
        await workbook.xlsx.load(data)
        const worksheet = workbook.worksheets[0]

        if (!worksheet || worksheet.rowCount === 0) {
          reject(new Error('The file appears to be empty'))
          return
        }

        // Convert worksheet to array of string arrays
        const jsonData: string[][] = []
        worksheet.eachRow((row) => {
          const rowValues = row.values as (string | number | boolean | null | undefined)[]
          // ExcelJS row.values is 1-indexed (index 0 is undefined), so slice(1)
          const cells = rowValues.slice(1).map((cell) => String(cell ?? '').trim())
          jsonData.push(cells)
        })

        if (jsonData.length === 0) {
          reject(new Error('The file appears to be empty'))
          return
        }

        // First row as headers, rest as data rows
        const headers = jsonData[0].map((h) => String(h).trim())
        const rows = jsonData.slice(1).map((row) =>
          row.map((cell) => String(cell ?? '').trim())
        )

        resolve({
          headers,
          rows,
          fileName: file.name,
        })
      } catch {
        reject(new Error('Could not parse file. Please check the format.'))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsArrayBuffer(file)
  })
}

export function suggestMappings(headers: string[], fieldSchemas: LeagueFieldSchema[] = []): Record<string, PlayerFieldMapping> {
  const mappings: Record<string, PlayerFieldMapping> = {}
  const usedFields = new Set<StandardPlayerField>()
  const usedSchemaIds = new Set<string>()

  for (const header of headers) {
    if (!header) {
      mappings[header] = { type: 'skip' }
      continue
    }

    // Try to match against known standard field patterns
    let matched = false
    for (const field of STANDARD_FIELDS) {
      if (usedFields.has(field)) continue

      const patterns = FIELD_PATTERNS[field]
      if (patterns.some((pattern) => pattern.test(header))) {
        mappings[header] = { type: 'standard', field }
        usedFields.add(field)
        matched = true
        break
      }
    }

    // Try to match against league field schemas (case-insensitive)
    if (!matched) {
      const headerLower = header.toLowerCase().replace(/\s*\*\s*$/, '').trim()
      const matchingSchema = fieldSchemas.find(
        (s) => !usedSchemaIds.has(s.id) && s.field_name.toLowerCase() === headerLower
      )
      if (matchingSchema) {
        mappings[header] = { type: 'schema', schemaId: matchingSchema.id, fieldName: matchingSchema.field_name }
        usedSchemaIds.add(matchingSchema.id)
        matched = true
      }
    }

    // If no match, treat as custom field
    if (!matched) {
      mappings[header] = { type: 'custom', fieldName: header }
    }
  }

  return mappings
}

function normalizeImportValue(value: string, schema: LeagueFieldSchema): string {
  switch (schema.field_type) {
    case 'checkbox': {
      const lower = value.toLowerCase().trim()
      if (['yes', 'true', '1'].includes(lower)) return 'true'
      if (['no', 'false', '0'].includes(lower)) return 'false'
      return value
    }
    case 'number': {
      // Strip unit suffix if present
      const unit = schema.field_options?.unit as string | undefined
      if (unit) {
        const stripped = value.replace(new RegExp(`\\s*${unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'), '')
        if (stripped !== value && !isNaN(Number(stripped))) return stripped
      }
      return value
    }
    case 'date': {
      const date = new Date(value)
      if (isNaN(date.getTime())) return value
      return schema.field_options?.includeTime
        ? date.toISOString().slice(0, 16)
        : date.toISOString().slice(0, 10)
    }
    default:
      return value
  }
}

export function transformData(
  data: SpreadsheetData,
  mappings: Record<string, PlayerFieldMapping>,
  skipFirstRow: boolean,
  fieldSchemas: LeagueFieldSchema[] = []
): ParsedPlayer[] {
  const rows = skipFirstRow ? data.rows : [data.headers, ...data.rows]
  const headers = data.headers
  const schemaMap = new Map(fieldSchemas.map((s) => [s.id, s]))

  return rows.map((row, index) => {
    const player: ParsedPlayer = {
      rowNumber: skipFirstRow ? index + 2 : index + 1, // 1-based, accounting for header
      name: '',
      customFields: [],
      isValid: true,
      errors: [],
      isSelected: true,
    }

    // Process each column
    headers.forEach((header, colIndex) => {
      const mapping = mappings[header]
      const value = row[colIndex] || ''

      if (!mapping || mapping.type === 'skip') {
        return
      }

      if (mapping.type === 'standard') {
        switch (mapping.field) {
          case 'name':
            player.name = value
            break
          case 'bio':
            player.bio = value || undefined
            break
        }
      } else if (mapping.type === 'schema' && value) {
        const schema = schemaMap.get(mapping.schemaId)
        const normalizedValue = schema ? normalizeImportValue(value, schema) : value
        player.customFields.push({
          field_name: mapping.fieldName,
          field_value: normalizedValue,
          schema_id: mapping.schemaId,
        })
      } else if (mapping.type === 'custom' && value) {
        player.customFields.push({
          field_name: mapping.fieldName,
          field_value: value,
        })
      }
    })

    // Validate - name is required
    if (!player.name.trim()) {
      player.isValid = false
      player.isSelected = false
      player.errors.push('Name is required')
    }

    return player
  })
}

interface UseImportPlayersOptions {
  leagueId: string
}

export function useImportPlayers({ leagueId }: UseImportPlayersOptions) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (players: ParsedPlayer[]): Promise<ImportResult> => {
      const validPlayers = players.filter((p) => p.isValid && p.isSelected)
      const skippedCount = players.filter((p) => !p.isValid || !p.isSelected).length

      if (validPlayers.length === 0) {
        return {
          success: true,
          playersCreated: 0,
          playersSkipped: skippedCount,
          errors: [],
        }
      }

      // Create all players with their profile data
      const playersToInsert = validPlayers.map((p) => ({
        league_id: leagueId,
        name: p.name,
        bio: p.bio || null,
      }))

      const { data: createdPlayers, error: insertError } = await supabase
        .from('players')
        .insert(playersToInsert)
        .select()

      if (insertError) {
        throw new Error(`Failed to create players: ${insertError.message}`)
      }

      if (!createdPlayers) {
        throw new Error('No players were created')
      }

      // Create custom fields for each player
      const customFieldsToInsert: Array<{
        player_id: string
        field_name: string
        field_value: string
        field_order: number
        schema_id?: string | null
      }> = []

      createdPlayers.forEach((createdPlayer, index) => {
        const sourcePlayer = validPlayers[index]
        sourcePlayer.customFields.forEach((cf, fieldIndex) => {
          customFieldsToInsert.push({
            player_id: createdPlayer.id,
            field_name: cf.field_name,
            field_value: cf.field_value,
            field_order: fieldIndex,
            schema_id: cf.schema_id || null,
          })
        })
      })

      if (customFieldsToInsert.length > 0) {
        const { error: customFieldsError } = await supabase
          .from('player_custom_fields')
          .insert(customFieldsToInsert)

        if (customFieldsError) {
          // Don't fail the whole import for custom fields — they can be added manually
        }
      }

      return {
        success: true,
        playersCreated: createdPlayers.length,
        playersSkipped: skippedCount,
        errors: [],
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['league', leagueId] })
    },
  })
}
