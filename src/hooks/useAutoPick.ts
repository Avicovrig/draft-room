import { useState, useCallback, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'
import { trackCount, trackDistribution, startTimer } from '@/lib/metrics'
import type { CaptainPublic } from '@/lib/types'

interface UseAutoPickOptions {
  leagueId: string
  leagueStatus: string
  currentPickIndex: number
  currentCaptain: CaptainPublic | undefined
  availablePlayerCount: number
  captainToken?: string
  spectatorToken?: string
}

export function useAutoPick({
  leagueId,
  leagueStatus,
  currentPickIndex,
  currentCaptain,
  availablePlayerCount,
  captainToken,
  spectatorToken,
}: UseAutoPickOptions) {
  const [showAutoPickFlash, setShowAutoPickFlash] = useState(false)
  const isAutoPickingRef = useRef(false)
  // Keep pick index and available count in refs so the auto-pick callback
  // always reads the latest values without triggering re-creation
  const pickIndexRef = useRef(currentPickIndex)
  pickIndexRef.current = currentPickIndex
  const availableCountRef = useRef(availablePlayerCount)
  availableCountRef.current = availablePlayerCount
  const lastAutoPickKeyRef = useRef<string | null>(null)
  const queryClient = useQueryClient()
  const { addToast } = useToast()

  const handleTimerExpire = useCallback(async () => {
    // Any connected client can trigger auto-pick
    // The edge function uses expectedPickIndex for idempotency to prevent duplicate picks
    if (!currentCaptain || availableCountRef.current === 0) return

    // Prevent multiple simultaneous auto-pick calls
    if (isAutoPickingRef.current) return

    isAutoPickingRef.current = true

    try {
      trackCount('draft.auto_pick_triggered')

      // Call the edge function for auto-pick with idempotency key
      const currentIdx = pickIndexRef.current
      const elapsed = startTimer()
      const response = await supabase.functions.invoke('auto-pick', {
        body: {
          leagueId,
          expectedPickIndex: currentIdx,
          captainToken,
          spectatorToken,
        },
      })

      if (response.error) {
        // Only show error if it's not a race condition (multiple clients calling simultaneously)
        if (response.error.message?.includes('Pick already made')) {
          trackCount('draft.auto_pick_race_condition')
        } else {
          trackCount('draft.auto_pick_error')
          addToast('Auto-pick failed. Please make a manual selection.', 'error')
        }
      } else if (response.data?.error) {
        // Don't show toast for expected race condition errors
        const expectedErrors = [
          'Pick already made',
          'Timer has not expired yet',
          'Draft is not in progress',
          'Draft state changed concurrently',
        ]
        if (expectedErrors.includes(response.data.error)) {
          trackCount('draft.auto_pick_race_condition')
        } else {
          trackCount('draft.auto_pick_error')
          addToast(`Auto-pick failed: ${response.data.error}`, 'error')
        }
      } else if (response.data?.success) {
        trackCount('draft.auto_pick_success')
        trackDistribution('edge_function.latency', elapsed(), 'millisecond', {
          function_name: 'auto-pick',
        })
        addToast(
          `Auto-picked ${response.data.pick.player} for ${response.data.pick.captain}`,
          'info'
        )
        // Brief flash animation
        setShowAutoPickFlash(true)
        setTimeout(() => setShowAutoPickFlash(false), 1500)
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['league', leagueId] })
      }
    } catch {
      trackCount('draft.auto_pick_error')
      addToast('Auto-pick failed due to a network error.', 'error')
    } finally {
      isAutoPickingRef.current = false
    }
  }, [currentCaptain, leagueId, captainToken, spectatorToken, addToast, queryClient])

  // Trigger immediate auto-pick if current captain has auto_pick_enabled
  // This runs when:
  // 1. Pick index changes (new turn) and new captain has auto-pick enabled
  // 2. Current captain enables auto-pick during their turn
  // Any connected client (manager, captain, or spectator) can trigger this.
  // The edge function validates auth via captain token, spectator token, or manager JWT.
  useEffect(() => {
    // Only when draft is in progress
    if (leagueStatus !== 'in_progress') return
    // Only if there's a current captain with auto-pick enabled
    if (!currentCaptain?.auto_pick_enabled) return
    // Only if there are players available
    if (availablePlayerCount === 0) return

    // Create a unique key combining pick index, captain, and auto-pick state
    // Including auto_pick_enabled ensures we trigger when captain enables it mid-turn
    const autoPickKey = `${currentPickIndex}-${currentCaptain.id}-${currentCaptain.auto_pick_enabled}`

    // Prevent duplicate calls for the same key
    if (lastAutoPickKeyRef.current === autoPickKey) return

    // Mark this key as being processed
    lastAutoPickKeyRef.current = autoPickKey

    // Small delay to allow UI to update and prevent race conditions
    const timeoutId = setTimeout(() => {
      handleTimerExpire()
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [
    leagueStatus,
    currentPickIndex,
    currentCaptain?.id,
    currentCaptain?.auto_pick_enabled,
    availablePlayerCount,
    handleTimerExpire,
  ])

  return { handleTimerExpire, showAutoPickFlash }
}
