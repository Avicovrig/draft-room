import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Maximize2, Minimize2, WifiOff, Zap } from 'lucide-react'
import { useModalFocus } from '@/hooks/useModalFocus'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { KeyboardShortcutsModal } from '@/components/ui/KeyboardShortcutsModal'
import { PickTimer } from './PickTimer'
import { PlayerPool, type SortOption } from './PlayerPool'
import { TeamRoster } from './TeamRoster'
import { DraftControls } from './DraftControls'
import { DraftQueue } from './DraftQueue'
import { ScheduledCountdown } from './ScheduledCountdown'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { getCurrentRound } from '@/lib/draft'
import { supabase } from '@/lib/supabase'
import { playSound, resumeAudioContext } from '@/lib/sounds'
import { useDraftQueue, useAddToQueue } from '@/hooks/useDraftQueue'
import { useDraftNotes } from '@/hooks/useDraftNotes'
import { useAuth } from '@/context/AuthContext'
import type { LeagueFull, Captain, PlayerCustomField, LeagueFieldSchema } from '@/lib/types'

interface DraftBoardProps {
  league: LeagueFull
  currentCaptain: Captain | undefined
  availablePlayers: LeagueFull['players']
  pickOrder: string[]
  isSubscribed: boolean
  customFieldsMap?: Record<string, PlayerCustomField[]>
  canPick: boolean
  isManager: boolean
  viewingAsCaptain?: Captain
  captainToken?: string
  onStartDraft: () => Promise<void>
  onPauseDraft: () => Promise<void>
  onResumeDraft: () => Promise<void>
  onRestartDraft: () => Promise<void>
  onUndoLastPick: () => Promise<void>
  fieldSchemas?: LeagueFieldSchema[]
  onMakePick: (playerId: string, captainId: string, captainToken?: string) => Promise<void>
}

export function DraftBoard({
  league,
  currentCaptain,
  availablePlayers,
  pickOrder,
  isSubscribed,
  customFieldsMap = {},
  canPick,
  isManager,
  viewingAsCaptain,
  captainToken,
  onStartDraft,
  onPauseDraft,
  onResumeDraft,
  onRestartDraft,
  onUndoLastPick,
  fieldSchemas = [],
  onMakePick,
}: DraftBoardProps) {
  const [isPicking, setIsPicking] = useState(false)
  const [isPlayerPoolExpanded, setIsPlayerPoolExpanded] = useState(false)
  const [poolSearch, setPoolSearch] = useState('')
  const [poolSortBy, setPoolSortBy] = useState<SortOption>('default')
  const [poolFilters, setPoolFilters] = useState<Record<string, string>>({})
  const handleFilterChange = useCallback((schemaId: string, value: string) => {
    setPoolFilters(prev => {
      const next = { ...prev }
      if (value) {
        next[schemaId] = value
      } else {
        delete next[schemaId]
      }
      return next
    })
  }, [])
  const handleClearFilters = useCallback(() => setPoolFilters({}), [])
  const [showAutoPickFlash, setShowAutoPickFlash] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const isAutoPickingRef = useRef(false)
  const queryClient = useQueryClient()
  const { addToast } = useToast()
  const { user } = useAuth()

  // Draft notes (localStorage-backed, private per captain/manager)
  const notesOwnerId = viewingAsCaptain?.id ?? user?.id
  const { notes, setNote } = useDraftNotes(league.id, notesOwnerId)

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

  // Keyboard shortcuts
  const shortcutHandlers = useMemo(() => ({
    '?': () => setShowShortcuts(true),
    '/': () => searchInputRef.current?.focus(),
  }), [])
  useKeyboardShortcuts(shortcutHandlers)

  const totalPickSlots = availablePlayers.length + league.draft_picks.length
  const progressPercent = totalPickSlots > 0 ? (league.draft_picks.length / totalPickSlots) * 100 : 0

  const canStartDraft =
    league.status === 'not_started' &&
    league.captains.length >= 2 &&
    availablePlayers.length >= league.captains.length

  const isMyTurn = canPick && currentCaptain?.id === viewingAsCaptain?.id

  // Calculate picks until captain's next turn
  const picksUntilMyTurn = useMemo(() => {
    if (!viewingAsCaptain || !isActive || isMyTurn) return null
    for (let i = league.current_pick_index + 1; i < pickOrder.length; i++) {
      if (pickOrder[i] === viewingAsCaptain.id) return i - league.current_pick_index
    }
    return null
  }, [viewingAsCaptain, isActive, isMyTurn, league.current_pick_index, pickOrder])
  // Compute the "on deck" captain (next to pick)
  const onDeckCaptain = useMemo(() => {
    if (!isActive) return undefined
    const nextIndex = league.current_pick_index + 1
    if (nextIndex >= pickOrder.length) return undefined
    const nextId = pickOrder[nextIndex]
    return league.captains.find(c => c.id === nextId)
  }, [isActive, league.current_pick_index, pickOrder, league.captains])

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

  // Play sound and send browser notification when it becomes your turn
  useEffect(() => {
    if (isMyTurn && !prevIsMyTurnRef.current && league.status === 'in_progress') {
      resumeAudioContext()
      playSound('yourTurn')

      // Send browser notification if permitted
      if (viewingAsCaptain && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(league.name, { body: "It's your turn to pick!", icon: '/favicon.ico' })
      }
    }
    prevIsMyTurnRef.current = isMyTurn
  }, [isMyTurn, league.status, league.name, viewingAsCaptain])

  // Request notification permission on first render for captain view
  useEffect(() => {
    if (viewingAsCaptain && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [viewingAsCaptain])

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
    // Any connected client can trigger auto-pick
    // The edge function uses expectedPickIndex for idempotency to prevent duplicate picks
    if (!currentCaptain || availablePlayers.length === 0) return

    // Prevent multiple simultaneous auto-pick calls
    if (isAutoPickingRef.current) return

    isAutoPickingRef.current = true

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
        // Only show error if it's not a race condition (multiple clients calling simultaneously)
        if (!response.error.message?.includes('Pick already made')) {
          addToast('Auto-pick failed. Please make a manual selection.', 'error')
        }
      } else if (response.data?.error) {
        // Don't show toast for expected race condition errors
        const expectedErrors = ['Pick already made', 'Timer has not expired yet', 'Draft is not in progress']
        if (!expectedErrors.includes(response.data.error)) {
          addToast(`Auto-pick failed: ${response.data.error}`, 'error')
        }
      } else if (response.data?.success) {
        addToast(
          `Auto-picked ${response.data.pick.player} for ${response.data.pick.captain}`,
          'info'
        )
        // Brief flash animation
        setShowAutoPickFlash(true)
        setTimeout(() => setShowAutoPickFlash(false), 1500)
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['league', league.id] })
      }
    } catch (error) {
      console.error('Auto-pick error:', error)
      addToast('Auto-pick failed due to a network error.', 'error')
    } finally {
      isAutoPickingRef.current = false
    }
  }, [currentCaptain, availablePlayers.length, league.id, league.current_pick_index, addToast, queryClient])

  // Trigger immediate auto-pick if current captain has auto_pick_enabled
  // This runs when:
  // 1. Pick index changes (new turn) and new captain has auto-pick enabled
  // 2. Current captain enables auto-pick during their turn
  // Only managers and captains trigger this - spectators don't make API calls
  const lastAutoPickKeyRef = useRef<string | null>(null)
  useEffect(() => {
    // Only managers and captains should trigger auto-pick
    if (!isManager && !viewingAsCaptain) return
    // Only when draft is in progress
    if (league.status !== 'in_progress') return
    // Only if there's a current captain with auto-pick enabled
    if (!currentCaptain?.auto_pick_enabled) return
    // Only if there are players available
    if (availablePlayers.length === 0) return

    // Create a unique key combining pick index, captain, and auto-pick state
    // Including auto_pick_enabled ensures we trigger when captain enables it mid-turn
    const autoPickKey = `${league.current_pick_index}-${currentCaptain.id}-${currentCaptain.auto_pick_enabled}`

    // Prevent duplicate calls for the same key
    if (lastAutoPickKeyRef.current === autoPickKey) return

    // Mark this key as being processed
    lastAutoPickKeyRef.current = autoPickKey

    // Small delay to allow UI to update and prevent race conditions
    const timeoutId = setTimeout(() => {
      handleTimerExpire()
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [isManager, viewingAsCaptain, league.status, league.current_pick_index, currentCaptain?.id, currentCaptain?.auto_pick_enabled, availablePlayers.length, handleTimerExpire])

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
                  {picksUntilMyTurn !== null && (
                    <span className="ml-2 text-sm">
                      ({picksUntilMyTurn === 1 ? 'You pick next' : `${picksUntilMyTurn} picks until your turn`})
                    </span>
                  )}
                </>
              )}
            </p>
          )}
          {isActive && onDeckCaptain && (
            <p className="text-sm text-muted-foreground">
              On deck: <span className="font-medium">{onDeckCaptain.name}</span>
              {viewingAsCaptain?.id === onDeckCaptain.id && (
                <span className="ml-1 font-medium text-primary">(you)</span>
              )}
            </p>
          )}
          {league.status === 'not_started' && league.scheduled_start_at && (
            <ScheduledCountdown scheduledTime={league.scheduled_start_at} className="mt-1" />
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
          {!isSubscribed && isActive && (
            <div className="mt-1 flex items-center justify-end gap-1 text-xs text-yellow-600 dark:text-yellow-400">
              <WifiOff className="h-3 w-3" />
              Reconnecting...
            </div>
          )}
        </div>
      </div>

      {/* Draft Progress Bar */}
      {league.status !== 'not_started' && (
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Timer, Player Pool, and Queue */}
      <div className={`grid gap-6 ${viewingAsCaptain ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        <Card className="relative lg:col-span-1">
          <CardHeader>
            <CardTitle>Timer</CardTitle>
          </CardHeader>
          <CardContent>
            {showAutoPickFlash && (
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                <Zap className="h-12 w-12 text-yellow-500 animate-scale-in" />
              </div>
            )}
            <PickTimer
              currentPickStartedAt={league.current_pick_started_at}
              timeLimitSeconds={league.time_limit_seconds}
              isActive={isActive}
              onExpire={isManager || viewingAsCaptain ? handleTimerExpire : undefined}
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
              aria-label="Expand player list"
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
              search={poolSearch}
              onSearchChange={setPoolSearch}
              sortBy={poolSortBy}
              onSortChange={setPoolSortBy}
              searchInputRef={searchInputRef}
              notes={notes}
              onNoteChange={setNote}
              fieldSchemas={fieldSchemas}
              filters={poolFilters}
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
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
                leagueId={league.id}
                captainToken={captainToken}
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
              captainCount={league.captains.length}
              playerCount={availablePlayers.length}
              hasPicks={league.draft_picks.length > 0}
              onStart={onStartDraft}
              onPause={onPauseDraft}
              onResume={onResumeDraft}
              onRestart={onRestartDraft}
              onUndo={onUndoLastPick}
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
            customFieldsMap={customFieldsMap}
          />
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}

      {/* Expanded Player Pool Modal */}
      {isPlayerPoolExpanded && (
        <ExpandedPoolModal onClose={() => setIsPlayerPoolExpanded(false)}>
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
                aria-label="Collapse player list"
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
                search={poolSearch}
                onSearchChange={setPoolSearch}
                sortBy={poolSortBy}
                onSortChange={setPoolSortBy}
                notes={notes}
                onNoteChange={setNote}
                fieldSchemas={fieldSchemas}
                filters={poolFilters}
                onFilterChange={handleFilterChange}
                onClearFilters={handleClearFilters}
              />
            </CardContent>
          </Card>
        </ExpandedPoolModal>
      )}
    </div>
  )
}

function ExpandedPoolModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const { overlayProps } = useModalFocus({ onClose })

  return (
    <div
      {...overlayProps}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      {children}
    </div>
  )
}
