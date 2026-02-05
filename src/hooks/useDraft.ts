import { useEffect, useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useLeague, useUpdateLeague } from './useLeagues'
import { getPickOrder, getCaptainAtPick } from '@/lib/draft'
import type { LeagueFull, Player, Captain } from '@/lib/types'

interface UseDraftReturn {
  league: LeagueFull | null | undefined
  isLoading: boolean
  error: Error | null
  currentCaptain: Captain | undefined
  availablePlayers: Player[]
  pickOrder: string[]
  totalPicks: number
  startDraft: () => Promise<void>
  pauseDraft: () => Promise<void>
  resumeDraft: () => Promise<void>
  restartDraft: () => Promise<void>
  makePick: (playerId: string, captainId: string) => Promise<void>
}

export function useDraft(leagueId: string | undefined): UseDraftReturn {
  const queryClient = useQueryClient()
  const [isSubscribed, setIsSubscribed] = useState(false)

  // Use polling as fallback when subscription isn't connected or draft is active
  // Poll every 2 seconds during active draft for reliability
  const { data: league, isLoading, error } = useLeague(leagueId, {
    refetchInterval: isSubscribed ? false : 2000,
  })

  const updateLeague = useUpdateLeague()

  // Set up real-time subscriptions
  useEffect(() => {
    if (!leagueId) return

    const channel = supabase
      .channel(`draft:${leagueId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leagues',
          filter: `id=eq.${leagueId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['league', leagueId] })
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `league_id=eq.${leagueId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['league', leagueId] })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'draft_picks',
          filter: `league_id=eq.${leagueId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['league', leagueId] })
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'captains',
          filter: `league_id=eq.${leagueId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['league', leagueId] })
        }
      )
      .subscribe((status) => {
        // Silently handle subscription - polling fallback will work if this fails
        setIsSubscribed(status === 'SUBSCRIBED')
      })

    return () => {
      setIsSubscribed(false)
      supabase.removeChannel(channel)
    }
  }, [leagueId, queryClient])

  // Calculate derived values with memoization
  // Get player IDs that are linked to captains (player-captains)
  const captainPlayerIds = useMemo(
    () => new Set(league?.captains.filter((c) => c.player_id).map((c) => c.player_id)),
    [league?.captains]
  )

  // Filter available players: not drafted AND not a captain
  const availablePlayers = useMemo(
    () =>
      league?.players.filter(
        (p) => !p.drafted_by_captain_id && !captainPlayerIds.has(p.id)
      ) ?? [],
    [league?.players, captainPlayerIds]
  )

  const totalPicks = useMemo(
    () => availablePlayers.length + (league?.draft_picks?.length ?? 0),
    [availablePlayers.length, league?.draft_picks?.length]
  )

  const pickOrder = useMemo(
    () => (league ? getPickOrder(league.captains, totalPicks, league.draft_type) : []),
    [league, totalPicks]
  )

  const currentCaptain = useMemo(
    () =>
      league
        ? getCaptainAtPick(league.captains, league.current_pick_index, league.draft_type)
        : undefined,
    [league]
  )

  const startDraft = useCallback(async () => {
    if (!league || league.status !== 'not_started') return

    await updateLeague.mutateAsync({
      id: league.id,
      status: 'in_progress',
      current_pick_index: 0,
      current_pick_started_at: new Date().toISOString(),
    })
  }, [league, updateLeague])

  const pauseDraft = useCallback(async () => {
    if (!league || league.status !== 'in_progress') return

    await updateLeague.mutateAsync({
      id: league.id,
      status: 'paused',
      current_pick_started_at: null,
    })
  }, [league, updateLeague])

  const resumeDraft = useCallback(async () => {
    if (!league || league.status !== 'paused') return

    await updateLeague.mutateAsync({
      id: league.id,
      status: 'in_progress',
      current_pick_started_at: new Date().toISOString(),
    })
  }, [league, updateLeague])

  const restartDraft = useCallback(async () => {
    if (!league || league.status !== 'paused') return

    // Delete all draft picks
    await supabase
      .from('draft_picks')
      .delete()
      .eq('league_id', league.id)

    // Reset all players' draft status
    await supabase
      .from('players')
      .update({ drafted_by_captain_id: null, draft_pick_number: null })
      .eq('league_id', league.id)

    // Reset league status
    await updateLeague.mutateAsync({
      id: league.id,
      status: 'not_started',
      current_pick_index: 0,
      current_pick_started_at: null,
    })
  }, [league, updateLeague])

  const makePick = useCallback(
    async (playerId: string, captainId: string, captainToken?: string) => {
      if (!league || league.status !== 'in_progress') {
        throw new Error('Draft is not active')
      }

      // Use edge function to make pick (bypasses RLS for captain picks)
      let response
      try {
        response = await supabase.functions.invoke('make-pick', {
          body: {
            leagueId: league.id,
            captainId,
            playerId,
            captainToken,
          },
        })
      } catch (networkError) {
        console.error('Network error during pick:', networkError)
        throw new Error('Network error. Check your connection.')
      }

      const { data, error } = response

      if (error) {
        console.error('Pick failed:', error)
        throw new Error(error.message || 'Failed to make pick. Please try again.')
      }

      if (data?.error) {
        throw new Error(data.error)
      }

      if (!data?.success) {
        throw new Error('Unexpected response from server')
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['league', league.id] })
    },
    [league, queryClient]
  )

  return {
    league,
    isLoading,
    error: error as Error | null,
    currentCaptain,
    availablePlayers,
    pickOrder,
    totalPicks,
    startDraft,
    pauseDraft,
    resumeDraft,
    restartDraft,
    makePick,
  }
}

/**
 * Hook to validate captain access token
 */
export function useCaptainByToken(leagueId: string | undefined, token: string | null) {
  const { data: league } = useLeague(leagueId)

  if (!league || !token) return null

  return league.captains.find((c) => c.access_token === token) ?? null
}

/**
 * Hook to validate spectator token
 */
export function useSpectatorAccess(leagueId: string | undefined, token: string | null) {
  const { data: league } = useLeague(leagueId)

  if (!league || !token) return false

  return league.spectator_token === token
}
