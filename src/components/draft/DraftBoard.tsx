import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Maximize2, Minimize2 } from 'lucide-react'
import { PickTimer } from './PickTimer'
import { PlayerPool } from './PlayerPool'
import { TeamRoster } from './TeamRoster'
import { DraftControls } from './DraftControls'
import { DraftQueue } from './DraftQueue'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { getCurrentRound } from '@/lib/draft'
import { supabase } from '@/lib/supabase'
import { playSound, resumeAudioContext } from '@/lib/sounds'
import { useDraftQueue, useAddToQueue } from '@/hooks/useDraftQueue'
import type { LeagueFull, Captain, PlayerCustomField } from '@/lib/types'

interface DraftBoardProps {
  league: LeagueFull
  currentCaptain: Captain | undefined
  availablePlayers: LeagueFull['players']
  customFieldsMap?: Record<string, PlayerCustomField[]>
  canPick: boolean
  isManager: boolean
  viewingAsCaptain?: Captain
  captainToken?: string
  onStartDraft: () => Promise<void>
  onPauseDraft: () => Promise<void>
  onResumeDraft: () => Promise<void>
  onRestartDraft: () => Promise<void>
  onMakePick: (playerId: string, captainId: string, captainToken?: string) => Promise<void>
}

export function DraftBoard({
  league,
  currentCaptain,
  availablePlayers,
  customFieldsMap = {},
  canPick,
  isManager,
  viewingAsCaptain,
  captainToken,
  onStartDraft,
  onPauseDraft,
  onResumeDraft,
  onRestartDraft,
  onMakePick,
}: DraftBoardProps) {
  const [isPicking, setIsPicking] = useState(false)
  const [isPlayerPoolExpanded, setIsPlayerPoolExpanded] = useState(false)
  const isAutoPickingRef = useRef(false)
  const queryClient = useQueryClient()
  const { addToast } = useToast()

  // Draft queue hooks (only for captain view)
  const { data: queueData = [] } = useDraftQueue(viewingAsCaptain?.id)
  const addToQueue = useAddToQueue()

  // Set of player IDs in the captain's queue
  const queuedPlayerIds = useMemo(
    () => new Set(queueData.map((q) => q.player_id)),
    [queueData]
  )

  function handleAddToQueue(playerId: string) {
    if (!viewingAsCaptain) return
    addToQueue.mutate(
      { captainId: viewingAsCaptain.id, playerId },
      {
        onSuccess: () => {
          addToast('Added to queue', 'success')
        },
        onError: (error) => {
          addToast(error instanceof Error ? error.message : 'Failed to add to queue', 'error')
        },
      }
    )
  }

  const isActive = league.status === 'in_progress'
  const currentRound = getCurrentRound(league.current_pick_index, league.captains.length)
  const totalRounds = Math.ceil(
    (availablePlayers.length + league.draft_picks.length) / league.captains.length
  )

  const canStartDraft =
    league.status === 'not_started' &&
    league.captains.length >= 2 &&
    league.players.length >= league.captains.length

  const isMyTurn = canPick && currentCaptain?.id === viewingAsCaptain?.id
  const prevPickIndexRef = useRef(league.current_pick_index)
  const prevIsMyTurnRef = useRef(isMyTurn)

  // Play sound when a pick is made (pick index changes)
  useEffect(() => {
    if (league.current_pick_index !== prevPickIndexRef.current && league.current_pick_index > 0) {
      resumeAudioContext()
      playSound('pickMade')
    }
    prevPickIndexRef.current = league.current_pick_index
  }, [league.current_pick_index])

  // Play sound when it becomes your turn
  useEffect(() => {
    if (isMyTurn && !prevIsMyTurnRef.current && league.status === 'in_progress') {
      resumeAudioContext()
      playSound('yourTurn')
    }
    prevIsMyTurnRef.current = isMyTurn
  }, [isMyTurn, league.status])

  async function handlePick(playerId: string) {
    if (!currentCaptain) return

    setIsPicking(true)
    try {
      await onMakePick(playerId, currentCaptain.id, captainToken)
      playSound('pickMade')
    } catch (error) {
      console.error('Pick failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to make pick. Please try again.'
      addToast(errorMessage, 'error')
    } finally {
      setIsPicking(false)
    }
  }

  const handleTimerExpire = useCallback(async () => {
    // Only the manager should trigger auto-pick to prevent race conditions
    // This ensures a single source of truth for auto-picks
    if (!isManager) return
    if (!currentCaptain || availablePlayers.length === 0) return

    // Prevent multiple simultaneous auto-pick calls
    if (isAutoPickingRef.current) {
      console.log('[DraftBoard] Auto-pick already in progress, skipping')
      return
    }

    isAutoPickingRef.current = true
    console.log('[DraftBoard] Triggering auto-pick for pick index:', league.current_pick_index)

    try {
      // Call the edge function for auto-pick with idempotency key
      const response = await supabase.functions.invoke('auto-pick', {
        body: {
          leagueId: league.id,
          expectedPickIndex: league.current_pick_index,
        },
      })

      if (response.error) {
        console.error('Auto-pick failed:', response.error)
        addToast('Auto-pick failed. Please make a manual selection.', 'error')
      } else if (response.data?.error) {
        // Handle application-level errors from the edge function
        console.error('Auto-pick error:', response.data.error)
        // Don't show toast for "pick already made" - this is expected in race conditions
        if (response.data.error !== 'Pick already made') {
          addToast(`Auto-pick failed: ${response.data.error}`, 'error')
        }
      } else if (response.data?.success) {
        console.log('[DraftBoard] Auto-pick success:', response.data.pick)
        addToast(
          `Auto-picked ${response.data.pick.player} for ${response.data.pick.captain}`,
          'info'
        )
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['league', league.id] })
      }
    } catch (error) {
      console.error('Auto-pick error:', error)
      addToast('Auto-pick failed due to a network error.', 'error')
    } finally {
      isAutoPickingRef.current = false
    }
  }, [isManager, currentCaptain, availablePlayers.length, league.id, league.current_pick_index, addToast, queryClient])

  return (
    <div className="space-y-6">
      {/* Draft Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">
            {league.status === 'completed'
              ? 'Draft Complete'
              : league.status === 'not_started'
              ? 'Ready to Draft'
              : `Round ${currentRound} of ${totalRounds}`}
          </h2>
          {isActive && currentCaptain && (
            <p className="text-muted-foreground">
              {isMyTurn ? (
                <span className="font-medium text-primary">Your turn to pick!</span>
              ) : (
                <>
                  <span className="font-medium">{currentCaptain.name}</span> is picking...
                </>
              )}
            </p>
          )}
        </div>

        <div className="text-right">
          <div className="text-sm text-muted-foreground">
            Pick {league.current_pick_index + 1} of{' '}
            {availablePlayers.length + league.draft_picks.length}
          </div>
          <div className="text-sm text-muted-foreground">
            {availablePlayers.length} players remaining
          </div>
        </div>
      </div>

      {/* Timer, Player Pool, and Queue */}
      <div className={`grid gap-6 ${viewingAsCaptain ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Timer</CardTitle>
          </CardHeader>
          <CardContent>
            <PickTimer
              currentPickStartedAt={league.current_pick_started_at}
              timeLimitSeconds={league.time_limit_seconds}
              isActive={isActive}
              onExpire={handleTimerExpire}
            />
          </CardContent>
        </Card>

        <Card className={viewingAsCaptain ? 'lg:col-span-2' : 'lg:col-span-2'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>
              {canPick ? 'Select a Player' : 'Available Players'}
            </CardTitle>
            <button
              type="button"
              onClick={() => setIsPlayerPoolExpanded(true)}
              className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
              title="Expand player list"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </CardHeader>
          <CardContent className="h-[400px] sm:h-[300px]">
            <PlayerPool
              players={availablePlayers}
              customFieldsMap={customFieldsMap}
              canPick={canPick && isActive}
              onPick={handlePick}
              isPicking={isPicking}
              onAddToQueue={viewingAsCaptain ? handleAddToQueue : undefined}
              queuedPlayerIds={queuedPlayerIds}
              isAddingToQueue={addToQueue.isPending}
            />
          </CardContent>
        </Card>

        {/* Draft Queue (Captain view only) */}
        {viewingAsCaptain && (
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>My Queue</CardTitle>
            </CardHeader>
            <CardContent className="h-[400px] sm:h-[300px]">
              <DraftQueue
                captain={viewingAsCaptain}
                availablePlayers={availablePlayers}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Manager Controls */}
      {isManager && (
        <Card>
          <CardHeader>
            <CardTitle>Draft Controls</CardTitle>
          </CardHeader>
          <CardContent>
            <DraftControls
              status={league.status}
              canStart={canStartDraft}
              onStart={onStartDraft}
              onPause={onPauseDraft}
              onResume={onResumeDraft}
              onRestart={onRestartDraft}
            />
          </CardContent>
        </Card>
      )}

      {/* Team Rosters */}
      <Card>
        <CardHeader>
          <CardTitle>Teams</CardTitle>
        </CardHeader>
        <CardContent>
          <TeamRoster
            captains={league.captains}
            players={league.players}
            currentCaptainId={currentCaptain?.id}
            highlightCaptainId={viewingAsCaptain?.id}
          />
        </CardContent>
      </Card>

      {/* Expanded Player Pool Modal */}
      {isPlayerPoolExpanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="flex h-[90vh] w-full max-w-4xl flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 flex-shrink-0">
              <CardTitle>
                {canPick ? 'Select a Player' : 'Available Players'}
              </CardTitle>
              <button
                type="button"
                onClick={() => setIsPlayerPoolExpanded(false)}
                className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
                title="Collapse player list"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <PlayerPool
                players={availablePlayers}
                customFieldsMap={customFieldsMap}
                canPick={canPick && isActive}
                onPick={(playerId) => {
                  handlePick(playerId)
                  setIsPlayerPoolExpanded(false)
                }}
                isPicking={isPicking}
                showExpandedDetails={true}
                onAddToQueue={viewingAsCaptain ? handleAddToQueue : undefined}
                queuedPlayerIds={queuedPlayerIds}
                isAddingToQueue={addToQueue.isPending}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
