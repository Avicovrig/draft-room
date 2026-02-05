import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Captain, Player } from '@/lib/types'

interface CreateCaptainInput {
  league_id: string
  name: string
  is_participant?: boolean
  draft_position: number
  player_id?: string | null
}

export function useCreateCaptain() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateCaptainInput) => {
      const { data: captain, error } = await supabase
        .from('captains')
        .insert({
          league_id: data.league_id,
          name: data.name,
          is_participant: data.is_participant ?? true,
          draft_position: data.draft_position,
          player_id: data.player_id ?? null,
        })
        .select()
        .single()

      if (error) throw error
      return captain as Captain
    },
    onSuccess: (captain) => {
      queryClient.invalidateQueries({ queryKey: ['league', captain.league_id] })
    },
  })
}

interface UpdateCaptainInput {
  id: string
  name?: string
  is_participant?: boolean
  draft_position?: number
}

export function useUpdateCaptain() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateCaptainInput) => {
      const { data: captain, error } = await supabase
        .from('captains')
        .update(data)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return captain as Captain
    },
    onSuccess: (captain) => {
      queryClient.invalidateQueries({ queryKey: ['league', captain.league_id] })
    },
  })
}

export function useDeleteCaptain() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, leagueId }: { id: string; leagueId: string }) => {
      const { error } = await supabase
        .from('captains')
        .delete()
        .eq('id', id)

      if (error) throw error
      return { leagueId }
    },
    onSuccess: ({ leagueId }) => {
      queryClient.invalidateQueries({ queryKey: ['league', leagueId] })
    },
  })
}

export function useReorderCaptains() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ leagueId, captainIds }: { leagueId: string; captainIds: string[] }) => {
      // Two-phase update to avoid unique constraint violations on (league_id, draft_position)
      // Phase 1: Set all positions to negative temporary values
      const tempUpdates = captainIds.map((id, index) =>
        supabase
          .from('captains')
          .update({ draft_position: -(index + 1) })
          .eq('id', id)
      )

      const tempResults = await Promise.all(tempUpdates)
      const tempErrors = tempResults.filter((r) => r.error)
      if (tempErrors.length > 0) throw tempErrors[0].error

      // Phase 2: Set final positive positions
      const finalUpdates = captainIds.map((id, index) =>
        supabase
          .from('captains')
          .update({ draft_position: index + 1 })
          .eq('id', id)
      )

      const finalResults = await Promise.all(finalUpdates)
      const finalErrors = finalResults.filter((r) => r.error)
      if (finalErrors.length > 0) throw finalErrors[0].error

      return { leagueId }
    },
    onSuccess: ({ leagueId }) => {
      queryClient.invalidateQueries({ queryKey: ['league', leagueId] })
    },
  })
}

export function useAssignRandomCaptains() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      leagueId,
      playerIds,
      count,
    }: {
      leagueId: string
      playerIds: string[]
      count: number
    }) => {
      // First, delete existing captains
      await supabase.from('captains').delete().eq('league_id', leagueId)

      // Shuffle and pick random players
      const shuffled = [...playerIds].sort(() => Math.random() - 0.5)
      const selectedIds = shuffled.slice(0, count)

      // Get player names
      const { data: players } = await supabase
        .from('players')
        .select('id, name')
        .in('id', selectedIds)

      if (!players) throw new Error('Failed to fetch players')

      // Create captains from selected players (link to player via player_id)
      const captainsToInsert = selectedIds.map((playerId, index) => {
        const player = (players as Player[]).find((p) => p.id === playerId)
        return {
          league_id: leagueId,
          name: player?.name || `Captain ${index + 1}`,
          is_participant: true,
          draft_position: index + 1,
          player_id: playerId,
        }
      })

      const { data, error } = await supabase
        .from('captains')
        .insert(captainsToInsert)
        .select()

      if (error) throw error
      return data as Captain[]
    },
    onSuccess: (captains) => {
      if (captains.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['league', captains[0].league_id] })
      }
    },
  })
}
