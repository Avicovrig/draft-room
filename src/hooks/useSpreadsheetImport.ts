import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { trackCount, trackDistribution } from '@/lib/metrics'
import { PLAYER_COLUMNS } from '@/lib/queryColumns'
import type { SpreadsheetData, ParsedPlayer, ImportResult } from '@/lib/spreadsheetTypes'

// Re-export pure functions for existing consumers
export { suggestMappings, transformData } from '@/lib/spreadsheetParsing'

export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          // Escaped quote
          currentField += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        currentField += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      currentRow.push(currentField.trim())
      currentField = ''
    } else if (char === '\n') {
      currentRow.push(currentField.trim())
      if (currentRow.some((cell) => cell !== '')) {
        rows.push(currentRow)
      }
      currentRow = []
      currentField = ''
    } else if (char === '\r') {
      // Skip carriage returns (Windows line endings)
    } else {
      currentField += char
    }
  }

  // Flush last field/row
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.some((cell) => cell !== '')) {
      rows.push(currentRow)
    }
  }

  return rows
}

export function parseFile(file: File): Promise<SpreadsheetData> {
  const isCSV = file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = async (e) => {
      try {
        let jsonData: string[][]

        if (isCSV) {
          const text = e.target?.result
          if (typeof text !== 'string') {
            reject(new Error('Failed to read file data'))
            return
          }
          jsonData = parseCSV(text)
        } else {
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

          jsonData = []
          worksheet.eachRow((row) => {
            const rowValues = row.values as (string | number | boolean | null | undefined)[]
            // ExcelJS row.values is 1-indexed (index 0 is undefined), so slice(1)
            const cells = rowValues.slice(1).map((cell) => String(cell ?? '').trim())
            jsonData.push(cells)
          })
        }

        if (jsonData.length === 0) {
          reject(new Error('The file appears to be empty'))
          return
        }

        const headers = jsonData[0].map((h) => String(h).trim())
        const rows = jsonData.slice(1).map((row) => row.map((cell) => String(cell ?? '').trim()))

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

    if (isCSV) {
      reader.readAsText(file)
    } else {
      reader.readAsArrayBuffer(file)
    }
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
        .select(PLAYER_COLUMNS)

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

      const errors: string[] = []

      if (customFieldsToInsert.length > 0) {
        const { error: customFieldsError } = await supabase
          .from('player_custom_fields')
          .insert(customFieldsToInsert)

        if (customFieldsError) {
          // Don't fail the whole import — players were created successfully.
          // Surface the error so the user knows custom fields need manual attention.
          errors.push(`Custom fields failed to import: ${customFieldsError.message}`)
        }
      }

      return {
        success: true,
        playersCreated: createdPlayers.length,
        playersSkipped: skippedCount,
        errors,
      }
    },
    onSuccess: (result) => {
      trackCount('players.imported')
      trackDistribution('players.imported.count', result.playersCreated, 'none')
      queryClient.invalidateQueries({ queryKey: ['league', leagueId] })
    },
  })
}
