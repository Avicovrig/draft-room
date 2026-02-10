import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { LeaguePublic, LeagueFullPublic, LeagueTokens, DraftType, LeagueStatus } from '@/lib/types'

// Explicit column lists excluding token columns (revoked from anon/authenticated roles)
const LEAGUE_COLUMNS = 'id, manager_id, name, draft_type, time_limit_seconds, status, current_pick_index, current_pick_started_at, scheduled_start_at, allow_player_custom_fields, created_at, updated_at'
const CAPTAIN_COLUMNS = 'id, league_id, name, is_participant, draft_position, player_id, auto_pick_enabled, team_color, team_name, team_photo_url, created_at'
const PLAYER_COLUMNS = 'id, league_id, name, drafted_by_captain_id, draft_pick_number, bio, profile_picture_url, created_at'

export function useLeagues() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['leagues', user?.id],
    queryFn: async () => {
      if (!user) return []

      const { data, error } = await supabase
        .from('leagues')
        .select(LEAGUE_COLUMNS)
        .eq('manager_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as LeaguePublic[]
    },
    enabled: !!user,
  })
}

interface UseLeagueOptions {
  refetchInterval?: number | false
}

export function useLeague(id: string | undefined, options?: UseLeagueOptions) {
  return useQuery({
    queryKey: ['league', id],
    queryFn: async () => {
      if (!id) return null

      const { data, error } = await supabase
        .from('leagues')
        .select(`
          ${LEAGUE_COLUMNS},
          captains (${CAPTAIN_COLUMNS}),
          players (${PLAYER_COLUMNS}),
          draft_picks (id, captain_id, player_id, pick_number, is_auto_pick)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data as LeagueFullPublic
    },
    enabled: !!id,
    refetchInterval: options?.refetchInterval,
  })
}

export function useLeagueTokens(leagueId: string | undefined) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['league-tokens', leagueId],
    queryFn: async () => {
      if (!leagueId) return null

      const { data, error } = await supabase.rpc('get_league_tokens', {
        p_league_id: leagueId,
      })

      if (error) throw error
      return data as LeagueTokens
    },
    enabled: !!leagueId && !!user,
    staleTime: 60 * 60 * 1000,
  })
}

interface CreateLeagueInput {
  name: string
  draft_type?: DraftType
  time_limit_seconds?: number
}

export function useCreateLeague() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (data: CreateLeagueInput) => {
      if (!user) throw new Error('Not authenticated')

      const { data: league, error } = await supabase
        .from('leagues')
        .insert({
          name: data.name,
          manager_id: user.id,
          draft_type: data.draft_type ?? 'snake',
          time_limit_seconds: data.time_limit_seconds ?? 60,
        })
        .select(LEAGUE_COLUMNS)
        .single()

      if (error) throw error
      return league as LeaguePublic
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues'] })
    },
  })
}

interface UpdateLeagueInput {
  id: string
  name?: string
  draft_type?: DraftType
  time_limit_seconds?: number
  status?: LeagueStatus
  current_pick_index?: number
  current_pick_started_at?: string | null
  scheduled_start_at?: string | null
  allow_player_custom_fields?: boolean
}

export function useUpdateLeague() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateLeagueInput) => {
      const { data: league, error } = await supabase
        .from('leagues')
        .update(data)
        .eq('id', id)
        .select(LEAGUE_COLUMNS)
        .single()

      if (error) throw error
      return league as LeaguePublic
    },
    onSuccess: (league) => {
      queryClient.invalidateQueries({ queryKey: ['leagues'] })
      queryClient.invalidateQueries({ queryKey: ['league', league.id] })
    },
  })
}

export function useDeleteLeague() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('leagues')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues'] })
    },
  })
}
