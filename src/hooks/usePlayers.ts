import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { PlayerPublic } from '@/lib/types'

const PLAYER_COLUMNS = 'id, league_id, name, drafted_by_captain_id, draft_pick_number, bio, profile_picture_url, created_at'

interface CreatePlayerInput {
  league_id: string
  name: string
}

export function useCreatePlayer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreatePlayerInput) => {
      const { data: player, error } = await supabase
        .from('players')
        .insert({
          league_id: data.league_id,
          name: data.name,
        })
        .select(PLAYER_COLUMNS)
        .single()

      if (error) throw error
      return player as PlayerPublic
    },
    onSuccess: (player) => {
      queryClient.invalidateQueries({ queryKey: ['league', player.league_id] })
    },
  })
}

export function useCreatePlayers() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreatePlayerInput[]) => {
      if (data.length === 0) return []

      const { data: players, error } = await supabase
        .from('players')
        .insert(data.map(p => ({ league_id: p.league_id, name: p.name })))
        .select(PLAYER_COLUMNS)

      if (error) throw error
      return players as PlayerPublic[]
    },
    onSuccess: (players) => {
      if (players.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['league', players[0].league_id] })
      }
    },
  })
}

interface UpdatePlayerInput {
  id: string
  name?: string
  drafted_by_captain_id?: string | null
  draft_pick_number?: number | null
}

export function useUpdatePlayer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdatePlayerInput) => {
      const { data: player, error } = await supabase
        .from('players')
        .update(data)
        .eq('id', id)
        .select(PLAYER_COLUMNS)
        .single()

      if (error) throw error
      return player as PlayerPublic
    },
    onSuccess: (player) => {
      queryClient.invalidateQueries({ queryKey: ['league', player.league_id] })
    },
  })
}

export function useDeletePlayer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, leagueId }: { id: string; leagueId: string }) => {
      const { error } = await supabase
        .from('players')
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
