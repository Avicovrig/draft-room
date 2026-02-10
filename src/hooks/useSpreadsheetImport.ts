import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { SpreadsheetData, ParsedPlayer, ImportResult } from '@/lib/spreadsheetTypes'

// Re-export pure functions for existing consumers
export { suggestMappings, transformData } from '@/lib/spreadsheetParsing'

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
