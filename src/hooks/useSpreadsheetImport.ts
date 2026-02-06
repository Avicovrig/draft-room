import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
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

    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]

        // Convert to array of arrays, with empty cells as empty strings
        const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, {
          header: 1,
          defval: '',
          raw: false, // Convert all values to strings
        })

        if (jsonData.length === 0) {
          reject(new Error('The file appears to be empty'))
          return
        }

        // First row as headers, rest as data rows
        const headers = (jsonData[0] || []).map((h) => String(h).trim())
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

export function transformData(
  data: SpreadsheetData,
  mappings: Record<string, PlayerFieldMapping>,
  skipFirstRow: boolean
): ParsedPlayer[] {
  const rows = skipFirstRow ? data.rows : [data.headers, ...data.rows]
  const headers = data.headers

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
        player.customFields.push({
          field_name: mapping.fieldName,
          field_value: value,
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
          console.error('Failed to create custom fields:', customFieldsError)
          // Don't fail the whole import for custom fields
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
