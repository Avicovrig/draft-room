import { useEffect, useCallback, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { parseEdgeFunctionError } from '@/lib/edgeFunctionUtils'
import { useLeague, useUpdateLeague } from './useLeagues'
import { getPickOrder, getCaptainAtPick, getAvailablePlayers } from '@/lib/draft'
import type { LeagueFullPublic, PlayerPublic, CaptainPublic, ValidatedCaptain } from '@/lib/types'

interface UseDraftReturn {
  league: LeagueFullPublic | null | undefined
  isLoading: boolean
  error: Error | null
  isSubscribed: boolean
  dataUpdatedAt: number
  currentCaptain: CaptainPublic | undefined
  availablePlayers: PlayerPublic[]
  pickOrder: string[]
  totalPicks: number
  startDraft: () => Promise<void>
  pauseDraft: () => Promise<void>
  resumeDraft: () => Promise<void>
  restartDraft: () => Promise<void>
  undoLastPick: () => Promise<void>
  makePick: (playerId: string, captainId: string, captainToken?: string) => Promise<void>
}

export function useDraft(leagueId: string | undefined): UseDraftReturn {
  const queryClient = useQueryClient()
  const [isSubscribed, setIsSubscribed] = useState(false)

  // Use polling as fallback when subscription isn't connected or draft is active
  // Poll every 2 seconds during active draft for reliability
  const { data: league, isLoading, error, dataUpdatedAt } = useLeague(leagueId, {
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
  const availablePlayers = useMemo(
    () => (league ? getAvailablePlayers(league.players, league.captains) : []),
    [league]
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

    // Proactively refresh session — during long draft sessions, the JWT may have expired
    const { error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) {
      throw new Error('Session expired. Please refresh the page and log in again.')
    }

    const response = await supabase.functions.invoke('restart-draft', {
      body: { leagueId: league.id },
    })

    if (response.error) {
      const message = await parseEdgeFunctionError(response.response, 'Failed to restart draft')
      throw new Error(message)
    }
    if (response.data?.error) {
      throw new Error(response.data.error)
    }

    queryClient.invalidateQueries({ queryKey: ['league', league.id] })
  }, [league, queryClient])

  const undoLastPick = useCallback(async () => {
    if (!league || league.draft_picks.length === 0) return
    if (league.status !== 'in_progress' && league.status !== 'paused') return

    // Proactively refresh session — during long draft sessions, the JWT may have expired
    const { error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) {
      throw new Error('Session expired. Please refresh the page and log in again.')
    }

    const response = await supabase.functions.invoke('undo-pick', {
      body: { leagueId: league.id },
    })

    if (response.error) {
      const message = await parseEdgeFunctionError(response.response, 'Failed to undo pick')
      throw new Error(message)
    }
    if (response.data?.error) {
      throw new Error(response.data.error)
    }

    queryClient.invalidateQueries({ queryKey: ['league', league.id] })
  }, [league, queryClient])

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
      } catch {
        throw new Error('Network error. Check your connection.')
      }

      const { data, error, response: rawResponse } = response

      if (error) {
        const message = await parseEdgeFunctionError(rawResponse, 'Failed to make pick. Please try again.')
        throw new Error(message)
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
    isSubscribed,
    dataUpdatedAt,
    currentCaptain,
    availablePlayers,
    pickOrder,
    totalPicks,
    startDraft,
    pauseDraft,
    resumeDraft,
    restartDraft,
    undoLastPick,
    makePick,
  }
}

/**
 * Hook to validate captain access token via server-side RPC.
 */
export function useCaptainByToken(leagueId: string | undefined, token: string | null) {
  return useQuery({
    queryKey: ['captain-by-token', leagueId, !!token],
    queryFn: async () => {
      if (!leagueId || !token) return null

      const { data, error } = await supabase.rpc('validate_captain_token', {
        p_league_id: leagueId,
        p_token: token,
      })

      if (error) throw error
      return (data as ValidatedCaptain) ?? null
    },
    enabled: !!leagueId && !!token,
  })
}

/**
 * Hook to validate spectator token via server-side RPC.
 */
export function useSpectatorAccess(leagueId: string | undefined, token: string | null) {
  return useQuery({
    queryKey: ['spectator-access', leagueId, !!token],
    queryFn: async () => {
      if (!leagueId || !token) return false

      const { data, error } = await supabase.rpc('validate_spectator_token', {
        p_league_id: leagueId,
        p_token: token,
      })

      if (error) return false
      return data as boolean
    },
    enabled: !!leagueId && !!token,
  })
}
