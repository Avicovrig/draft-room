import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { trackCount } from '@/lib/metrics'
import type { CaptainDraftQueue, LeagueFullPublic, PlayerPublic } from '@/lib/types'

export interface QueuedPlayer extends CaptainDraftQueue {
  player: PlayerPublic
}

export function useDraftQueue(captainId: string | undefined) {
  return useQuery({
    queryKey: ['draft-queue', captainId],
    queryFn: async () => {
      if (!captainId) return []

      const { data, error } = await supabase
        .from('captain_draft_queues')
        .select(
          `
          *,
          player:players(id, league_id, name, drafted_by_captain_id, draft_pick_number, bio, profile_picture_url, created_at)
        `
        )
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
  leagueId: string
  captainToken?: string
}

export function useAddToQueue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ captainId, playerId, leagueId, captainToken }: AddToQueueInput) => {
      const response = await supabase.functions.invoke('manage-draft-queue', {
        body: {
          action: 'add',
          captainId,
          playerId,
          leagueId,
          captainToken,
        },
      })

      if (response.error) {
        throw new Error(response.error.message || 'Failed to add to queue')
      }
      if (response.data?.error) {
        throw new Error(response.data.error)
      }

      return response.data.entry as CaptainDraftQueue
    },
    onSuccess: (_, variables) => {
      trackCount('draft_queue.player_added')
      queryClient.invalidateQueries({ queryKey: ['draft-queue', variables.captainId] })
    },
  })
}

interface RemoveFromQueueInput {
  captainId: string
  queueEntryId: string
  leagueId: string
  captainToken?: string
}

export function useRemoveFromQueue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      queueEntryId,
      captainId,
      leagueId,
      captainToken,
    }: RemoveFromQueueInput) => {
      const response = await supabase.functions.invoke('manage-draft-queue', {
        body: {
          action: 'remove',
          captainId,
          queueEntryId,
          leagueId,
          captainToken,
        },
      })

      if (response.error) {
        throw new Error(response.error.message || 'Failed to remove from queue')
      }
      if (response.data?.error) {
        throw new Error(response.data.error)
      }
    },
    onSuccess: (_, variables) => {
      trackCount('draft_queue.player_removed')
      queryClient.invalidateQueries({ queryKey: ['draft-queue', variables.captainId] })
    },
  })
}

interface MoveInQueueInput {
  captainId: string
  queueEntryId: string
  newPosition: number
  leagueId: string
  captainToken?: string
}

export function useMoveInQueue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ captainId, leagueId, captainToken }: MoveInQueueInput) => {
      // Read current queue from cache for reorder
      const cached = queryClient.getQueryData<QueuedPlayer[]>(['draft-queue', captainId])
      if (!cached || cached.length === 0) return

      // The optimistic update in onMutate already reordered the cache.
      // Send the reordered entry IDs to the server.
      const entryIds = cached.map((q) => q.id)

      const response = await supabase.functions.invoke('manage-draft-queue', {
        body: {
          action: 'reorder',
          captainId,
          entryIds,
          leagueId,
          captainToken,
        },
      })

      if (response.error) {
        throw new Error(response.error.message || 'Failed to reorder queue')
      }
      if (response.data?.error) {
        throw new Error(response.data.error)
      }
    },
    onMutate: async ({ captainId, queueEntryId, newPosition }) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['draft-queue', captainId] })

      // Snapshot previous value
      const previous = queryClient.getQueryData<QueuedPlayer[]>(['draft-queue', captainId])

      // Optimistically reorder the cache
      if (previous) {
        const updated = [...previous]
        const currentIndex = updated.findIndex((q) => q.id === queueEntryId)
        if (currentIndex !== -1) {
          const [item] = updated.splice(currentIndex, 1)
          updated.splice(newPosition, 0, item)
          // Update position values to match new order (immutable — don't mutate cached objects)
          for (let i = 0; i < updated.length; i++) {
            updated[i] = { ...updated[i], position: i }
          }
          queryClient.setQueryData(['draft-queue', captainId], updated)
        }
      }

      return { previous }
    },
    onError: (_err, variables, context) => {
      // Roll back to previous state on error
      if (context?.previous) {
        queryClient.setQueryData(['draft-queue', variables.captainId], context.previous)
      }
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ['draft-queue', variables.captainId] })
    },
  })
}

interface ToggleAutoPickInput {
  captainId: string
  enabled: boolean
  leagueId: string
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

      trackCount('draft.auto_pick_toggled', { enabled })
      return response.data
    },
    onMutate: async ({ captainId, enabled, leagueId }) => {
      await queryClient.cancelQueries({ queryKey: ['league', leagueId] })
      const previous = queryClient.getQueryData<LeagueFullPublic>(['league', leagueId])

      if (previous) {
        queryClient.setQueryData<LeagueFullPublic>(['league', leagueId], {
          ...previous,
          captains: previous.captains.map((c) =>
            c.id === captainId ? { ...c, auto_pick_enabled: enabled } : c
          ),
        })
      }

      return { previous }
    },
    onError: (_err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['league', variables.leagueId], context.previous)
      }
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ['league', variables.leagueId] })
    },
  })
}
