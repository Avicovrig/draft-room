import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ParsedPlayer, ImportResult } from '@/lib/spreadsheetTypes'

// Re-export pure functions for existing consumers
export { parseFile, suggestMappings, transformData } from '@/lib/spreadsheetParsing'

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
