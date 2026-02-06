import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CaptainDraftQueue, Player } from '@/lib/types'

export interface QueuedPlayer extends CaptainDraftQueue {
  player: Player
}

export function useDraftQueue(captainId: string | undefined) {
  return useQuery({
    queryKey: ['draft-queue', captainId],
    queryFn: async () => {
      if (!captainId) return []

      const { data, error } = await supabase
        .from('captain_draft_queues')
        .select(`
          *,
          player:players(*)
        `)
        .eq('captain_id', captainId)
        .order('position', { ascending: true })

      if (error) throw error
      return data as QueuedPlayer[]
    },
    enabled: !!captainId,
  })
}

interface AddToQueueInput {
  captainId: string
  playerId: string
}

export function useAddToQueue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ captainId, playerId }: AddToQueueInput) => {
      // Get current max position
      const { data: existing } = await supabase
        .from('captain_draft_queues')
        .select('position')
        .eq('captain_id', captainId)
        .order('position', { ascending: false })
        .limit(1)

      const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0

      const { data, error } = await supabase
        .from('captain_draft_queues')
        .insert({
          captain_id: captainId,
          player_id: playerId,
          position: nextPosition,
        })
        .select()
        .single()

      if (error) throw error
      return data as CaptainDraftQueue
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['draft-queue', variables.captainId] })
    },
  })
}

interface RemoveFromQueueInput {
  captainId: string
  queueEntryId: string
}

export function useRemoveFromQueue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ queueEntryId }: RemoveFromQueueInput) => {
      const { error } = await supabase
        .from('captain_draft_queues')
        .delete()
        .eq('id', queueEntryId)

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['draft-queue', variables.captainId] })
    },
  })
}

interface MoveInQueueInput {
  captainId: string
  queueEntryId: string
  newPosition: number
}

export function useMoveInQueue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ captainId, queueEntryId, newPosition }: MoveInQueueInput) => {
      // Get current queue
      const { data: queue, error: fetchError } = await supabase
        .from('captain_draft_queues')
        .select('*')
        .eq('captain_id', captainId)
        .order('position', { ascending: true })

      if (fetchError) throw fetchError
      if (!queue) return

      const currentIndex = queue.findIndex((q) => q.id === queueEntryId)
      if (currentIndex === -1) return

      // Reorder array
      const [item] = queue.splice(currentIndex, 1)
      queue.splice(newPosition, 0, item)

      // Two-phase update to avoid unique constraint violations on (captain_id, position):
      // Phase 1: Set all positions to negative temporary values
      for (let i = 0; i < queue.length; i++) {
        const { error } = await supabase
          .from('captain_draft_queues')
          .update({ position: -(i + 1) })
          .eq('id', queue[i].id)
        if (error) throw error
      }

      // Phase 2: Set final positive positions
      for (let i = 0; i < queue.length; i++) {
        const { error } = await supabase
          .from('captain_draft_queues')
          .update({ position: i })
          .eq('id', queue[i].id)
        if (error) throw error
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['draft-queue', variables.captainId] })
    },
  })
}

interface ToggleAutoPickInput {
  captainId: string
  enabled: boolean
  leagueId?: string
  captainToken?: string
}

export function useToggleAutoPick() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ captainId, enabled, captainToken, leagueId }: ToggleAutoPickInput) => {
      // Use edge function to bypass RLS (captains aren't authenticated users)
      const response = await supabase.functions.invoke('toggle-auto-pick', {
        body: {
          captainId,
          enabled,
          captainToken,
          leagueId,
        },
      })

      if (response.error) {
        throw new Error(response.error.message || 'Failed to toggle auto-pick')
      }

      if (response.data?.error) {
        throw new Error(response.data.error)
      }

      return response.data
    },
    onSuccess: (_, variables) => {
      // Invalidate specific league if provided, otherwise all leagues
      if (variables.leagueId) {
        queryClient.invalidateQueries({ queryKey: ['league', variables.leagueId] })
      } else {
        queryClient.invalidateQueries({ queryKey: ['league'] })
      }
    },
  })
}
