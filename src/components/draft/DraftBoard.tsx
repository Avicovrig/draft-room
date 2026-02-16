import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { Bell, Maximize2, Minimize2, WifiOff, X } from 'lucide-react'
import { useModalFocus } from '@/hooks/useModalFocus'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useAutoPick } from '@/hooks/useAutoPick'
import { KeyboardShortcutsModal } from '@/components/ui/KeyboardShortcutsModal'
import { FilterPills } from '@/components/ui/FilterPills'
import { PlayerPool, type SortOption } from './PlayerPool'
import { SORTABLE_FIELD_TYPES } from '@/lib/playerFilters'
import { TeamRoster } from './TeamRoster'
import { DraftCommandBar } from './DraftCommandBar'
import { DraftQueue } from './DraftQueue'
import { ScheduledCountdown } from './ScheduledCountdown'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { getCurrentRound } from '@/lib/draft'
import { playSound, resumeAudioContext } from '@/lib/sounds'
import { trackCount } from '@/lib/metrics'
import { useDraftQueue, useAddToQueue } from '@/hooks/useDraftQueue'
import { useDraftNotes } from '@/hooks/useDraftNotes'
import { useAuth } from '@/context/AuthContext'
import type {
  LeagueFullPublic,
  CaptainPublic,
  PlayerCustomField,
  LeagueFieldSchema,
} from '@/lib/types'

interface PersistedPoolState {
  search: string
  sortBy: SortOption
  sortDirection: 'asc' | 'desc'
  filters: Record<string, string>
}

interface DraftBoardProps {
  league: LeagueFullPublic
  currentCaptain: CaptainPublic | undefined
  availablePlayers: LeagueFullPublic['players']
  pickOrder: string[]
  dataUpdatedAt: number
  customFieldsMap?: Record<string, PlayerCustomField[]>
  canPick: boolean
  isManager: boolean
  viewingAsCaptain?: CaptainPublic
  captainToken?: string
  spectatorToken?: string
  onStartDraft: () => Promise<void>
  onPauseDraft: () => Promise<void>
  onResumeDraft: () => Promise<void>
  onRestartDraft: () => Promise<void>
  onUndoLastPick: () => Promise<void>
  fieldSchemas?: LeagueFieldSchema[]
  onMakePick: (playerId: string, captainId: string, captainToken?: string) => Promise<void>
}

type PanelTab = 'pool' | 'queue'

export function DraftBoard({
  league,
  currentCaptain,
  availablePlayers,
  pickOrder,
  dataUpdatedAt,
  customFieldsMap = {},
  canPick,
  isManager,
  viewingAsCaptain,
  captainToken,
  spectatorToken,
  onStartDraft,
  onPauseDraft,
  onResumeDraft,
  onRestartDraft,
  onUndoLastPick,
  fieldSchemas = [],
  onMakePick,
}: DraftBoardProps) {
  const [isPicking, setIsPicking] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedPanel, setExpandedPanel] = useState<PanelTab>('pool')

  // Panel toggle state (captain view only), persisted to sessionStorage
  const panelStorageKey = `draft-panel:${league.id}`
  const [activePanel, setActivePanelRaw] = useState<PanelTab>(() => {
    try {
      const saved = sessionStorage.getItem(panelStorageKey)
      if (saved === 'pool' || saved === 'queue') return saved
    } catch {
      /* private browsing */
    }
    return 'pool'
  })
  const setActivePanel = useCallback(
    (tab: PanelTab) => {
      setActivePanelRaw(tab)
      try {
        sessionStorage.setItem(panelStorageKey, tab)
      } catch {
        /* private browsing */
      }
    },
    [panelStorageKey]
  )

  // SessionStorage-backed pool state
  const storageKey = `draft-pool-state:${league.id}`
  const [poolSearch, setPoolSearch] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey)
      if (saved) return (JSON.parse(saved) as PersistedPoolState).search ?? ''
    } catch {
      /* private browsing */
    }
    return ''
  })
  const [poolSortBy, setPoolSortByRaw] = useState<SortOption>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey)
      if (saved) return (JSON.parse(saved) as PersistedPoolState).sortBy ?? 'default'
    } catch {
      /* private browsing */
    }
    return 'default'
  })
  const [poolSortDirection, setPoolSortDirection] = useState<'asc' | 'desc'>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey)
      if (saved) return (JSON.parse(saved) as PersistedPoolState).sortDirection ?? 'asc'
    } catch {
      /* private browsing */
    }
    return 'asc'
  })
  const [poolFilters, setPoolFilters] = useState<Record<string, string>>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey)
      if (saved) return (JSON.parse(saved) as PersistedPoolState).filters ?? {}
    } catch {
      /* private browsing */
    }
    return {}
  })

  // Reset direction to asc when switching away from field sort
  const setPoolSortBy = useCallback((sort: SortOption) => {
    setPoolSortByRaw(sort)
    if (!sort.startsWith('field:')) {
      setPoolSortDirection('asc')
    }
  }, [])

  // Persist pool state to sessionStorage
  useEffect(() => {
    try {
      const state: PersistedPoolState = {
        search: poolSearch,
        sortBy: poolSortBy,
        sortDirection: poolSortDirection,
        filters: poolFilters,
      }
      sessionStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      /* private browsing */
    }
  }, [storageKey, poolSearch, poolSortBy, poolSortDirection, poolFilters])

  // Clean up stale filters/sort when field schemas change
  useEffect(() => {
    if (fieldSchemas.length === 0) return
    const schemaIds = new Set(fieldSchemas.map((s) => s.id))

    // Remove filter keys referencing deleted schemas
    setPoolFilters((prev) => {
      const cleaned: Record<string, string> = {}
      let changed = false
      for (const [key, val] of Object.entries(prev)) {
        if (schemaIds.has(key)) {
          cleaned[key] = val
        } else {
          changed = true
        }
      }
      return changed ? cleaned : prev
    })

    // Reset sort if it points to a removed or non-sortable field
    if (poolSortBy.startsWith('field:')) {
      const schemaId = poolSortBy.slice(6)
      const schema = fieldSchemas.find((s) => s.id === schemaId)
      if (!schema || !SORTABLE_FIELD_TYPES.has(schema.field_type)) {
        setPoolSortByRaw('default')
        setPoolSortDirection('asc')
      }
    }
  }, [fieldSchemas, poolSortBy])

  const handleFilterChange = useCallback((schemaId: string, value: string) => {
    setPoolFilters((prev) => {
      if (value) {
        return { ...prev, [schemaId]: value }
      }
      const { [schemaId]: _, ...rest } = prev
      return rest
    })
  }, [])
  const handleClearFilters = useCallback(() => setPoolFilters({}), [])
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showRefreshHint, setShowRefreshHint] = useState(false)
  const [notificationDismissed, setNotificationDismissed] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { addToast } = useToast()

  // Auto-pick logic (timer expiry + auto-pick trigger)
  // Any connected client (manager, captain, or spectator) can trigger auto-pick.
  // The edge function validates timer expiry server-side and uses expectedPickIndex for idempotency.
  const { handleTimerExpire, showAutoPickFlash } = useAutoPick({
    leagueId: league.id,
    leagueStatus: league.status,
    currentPickIndex: league.current_pick_index,
    currentCaptain,
    availablePlayerCount: availablePlayers.length,
    captainToken,
    spectatorToken,
  })
  const { user } = useAuth()

  // Draft notes (localStorage-backed, private per captain/manager)
  const notesOwnerId = viewingAsCaptain?.id ?? (isManager ? user?.id : undefined)
  const { notes, setNote } = useDraftNotes(league.id, notesOwnerId)

  // Draft queue hooks (only for captain view)
  const { data: queueData = [] } = useDraftQueue(viewingAsCaptain?.id)
  const addToQueue = useAddToQueue()

  // Set of player IDs in the captain's queue
  const queuedPlayerIds = useMemo(() => new Set(queueData.map((q) => q.player_id)), [queueData])

  // Count of available queue entries (for tab label)
  const availableQueueCount = useMemo(() => {
    const availableIds = new Set(availablePlayers.map((p) => p.id))
    return queueData.filter((q) => availableIds.has(q.player_id)).length
  }, [queueData, availablePlayers])

  function handleAddToQueue(playerId: string) {
    if (!viewingAsCaptain) return
    addToQueue.mutate(
      { captainId: viewingAsCaptain.id, playerId, leagueId: league.id, captainToken },
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

  // Show refresh hint only when data is actually stale.
  // During active draft, no data changes are expected while the pick timer counts down,
  // so use timer duration + 10s as the threshold to avoid false "connection" warnings.
  useEffect(() => {
    if (league.status !== 'in_progress') {
      setShowRefreshHint(false)
      return
    }
    const staleMs =
      league.time_limit_seconds > 0
        ? Math.max((league.time_limit_seconds + 10) * 1000, 15000)
        : 15000
    let wasStale = false
    const checkStaleness = () => {
      const isStale = Date.now() - dataUpdatedAt > staleMs
      if (isStale && !wasStale) {
        trackCount('realtime.stale_data_warning')
      }
      wasStale = isStale
      setShowRefreshHint(isStale)
    }
    checkStaleness()
    const interval = setInterval(checkStaleness, 5000)
    return () => clearInterval(interval)
  }, [league.status, league.time_limit_seconds, dataUpdatedAt])

  const isActive = league.status === 'in_progress'
  const currentRound = getCurrentRound(league.current_pick_index, league.captains.length)
  const totalRounds = Math.ceil(
    (availablePlayers.length + league.draft_picks.length) / league.captains.length
  )

  // Keyboard shortcuts
  const shortcutHandlers = useMemo(
    () => ({
      '?': () => setShowShortcuts(true),
      '/': () => searchInputRef.current?.focus(),
    }),
    []
  )
  useKeyboardShortcuts(shortcutHandlers)

  const totalPickSlots = availablePlayers.length + league.draft_picks.length
  const progressPercent =
    totalPickSlots > 0 ? (league.draft_picks.length / totalPickSlots) * 100 : 0

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
    return league.captains.find((c) => c.id === nextId)
  }, [isActive, league.current_pick_index, pickOrder, league.captains])

  const prevPickIndexRef = useRef(league.current_pick_index)
  const prevIsMyTurnRef = useRef(isMyTurn)
  const [pickAnnouncement, setPickAnnouncement] = useState('')

  // Play sound and announce when a pick is made (pick index changes)
  useEffect(() => {
    if (league.current_pick_index !== prevPickIndexRef.current && league.current_pick_index > 0) {
      resumeAudioContext()
      playSound('pickMade')

      // Announce the pick for screen readers
      const lastPick = league.draft_picks[league.draft_picks.length - 1]
      if (lastPick) {
        const captain = league.captains.find((c) => c.id === lastPick.captain_id)
        const player = league.players.find((p) => p.id === lastPick.player_id)
        if (captain && player) {
          setPickAnnouncement(
            `Pick ${lastPick.pick_number}: ${captain.team_name || captain.name} selected ${player.name}`
          )
        }
      }
    }
    prevPickIndexRef.current = league.current_pick_index
  }, [league.current_pick_index, league.draft_picks, league.captains, league.players])

  // Play sound and send browser notification when it becomes your turn
  useEffect(() => {
    if (isMyTurn && !prevIsMyTurnRef.current && league.status === 'in_progress') {
      resumeAudioContext()
      playSound('yourTurn')

      // Send browser notification if permitted
      if (
        viewingAsCaptain &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        new Notification(league.name, { body: "It's your turn to pick!", icon: '/favicon.ico' })
      }
    }
    prevIsMyTurnRef.current = isMyTurn
  }, [isMyTurn, league.status, league.name, viewingAsCaptain])

  const showNotificationBanner =
    !!viewingAsCaptain && notificationPermission === 'default' && !notificationDismissed

  async function handleEnableNotifications() {
    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
  }

  async function handlePick(playerId: string) {
    if (!currentCaptain) return

    setIsPicking(true)
    try {
      await onMakePick(playerId, currentCaptain.id, captainToken)
      // Sound is played by the useEffect watching league.current_pick_index,
      // which fires for all pick types (manual, auto, other captains).
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to make pick. Please try again.'
      addToast(errorMessage, 'error')
    } finally {
      setIsPicking(false)
    }
  }

  // Panel tab options for captain view
  const panelOptions = useMemo(
    () => [
      {
        value: 'pool' as PanelTab,
        label: canPick ? 'Select a Player' : 'Available Players',
      },
      {
        value: 'queue' as PanelTab,
        label: `My Queue${availableQueueCount > 0 ? ` (${availableQueueCount})` : ''}`,
      },
    ],
    [canPick, availableQueueCount]
  )

  return (
    <div className="space-y-4">
      {/* Screen reader announcements for draft picks */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {pickAnnouncement}
      </div>

      {/* Top section: Status header + Command bar */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold">
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
                  <span className="font-medium">
                    {currentCaptain.team_name || currentCaptain.name}
                  </span>{' '}
                  is picking...
                  {picksUntilMyTurn !== null && (
                    <span className="ml-2 text-sm">
                      (
                      {picksUntilMyTurn === 1
                        ? 'You pick next'
                        : `${picksUntilMyTurn} picks until your turn`}
                      )
                    </span>
                  )}
                </>
              )}
            </p>
          )}
          {isActive && onDeckCaptain && (
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-sm text-muted-foreground">
              On deck:{' '}
              <span className="font-medium">{onDeckCaptain.team_name || onDeckCaptain.name}</span>
              {viewingAsCaptain?.id === onDeckCaptain.id && (
                <span className="font-medium text-primary">(you)</span>
              )}
            </p>
          )}
          {league.status === 'not_started' && league.scheduled_start_at && (
            <ScheduledCountdown scheduledTime={league.scheduled_start_at} className="mt-1" />
          )}
          <div className="mt-1 text-sm text-muted-foreground">
            Pick {league.current_pick_index + 1} of{' '}
            {availablePlayers.length + league.draft_picks.length}
            <span className="mx-1.5">&middot;</span>
            {availablePlayers.length} remaining
          </div>
        </div>

        {/* Command bar: compact timer + manager controls */}
        <DraftCommandBar
          league={league}
          currentCaptain={currentCaptain}
          availablePlayerCount={availablePlayers.length}
          canStartDraft={canStartDraft}
          isManager={isManager}
          showAutoPickFlash={showAutoPickFlash}
          onStartDraft={onStartDraft}
          onPauseDraft={onPauseDraft}
          onResumeDraft={onResumeDraft}
          onRestartDraft={onRestartDraft}
          onUndoLastPick={onUndoLastPick}
          onTimerExpire={handleTimerExpire}
        />
      </div>

      {/* Stale data banner — only shown when both realtime and polling fail */}
      {showRefreshHint && isActive && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400">
          <WifiOff className="h-4 w-4 flex-shrink-0" />
          <span>Data may be outdated. Check your connection.</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="ml-auto font-medium underline"
          >
            Refresh
          </button>
        </div>
      )}

      {/* Notification permission banner */}
      {showNotificationBanner && (
        <div className="flex items-center gap-2 rounded-md border border-primary/50 bg-primary/10 px-3 py-2 text-sm">
          <Bell className="h-4 w-4 flex-shrink-0 text-primary" />
          <span>Enable notifications to know when it's your turn.</span>
          <button
            type="button"
            onClick={handleEnableNotifications}
            className="ml-auto font-medium text-primary hover:underline whitespace-nowrap"
          >
            Enable
          </button>
          <button
            type="button"
            onClick={() => setNotificationDismissed(true)}
            className="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Draft Progress Bar */}
      {league.status !== 'not_started' && (
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Main content: Teams sidebar (left) + Player pool/queue (right) */}
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
        {/* Teams sidebar — desktop: left, fixed width, scrollable */}
        <div className="order-2 lg:order-1 lg:w-80 lg:shrink-0">
          <Card className="lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto">
            <CardHeader className="py-3 lg:sticky lg:top-0 lg:z-10 lg:bg-card">
              <CardTitle>Teams</CardTitle>
            </CardHeader>
            <CardContent>
              <TeamRoster
                captains={league.captains}
                players={league.players}
                currentCaptainId={currentCaptain?.id}
                highlightCaptainId={viewingAsCaptain?.id}
                customFieldsMap={customFieldsMap}
                isManager={isManager}
                leagueId={league.id}
                layout="stack"
              />
            </CardContent>
          </Card>
        </div>

        {/* Player pool/queue — takes remaining space */}
        <div className="order-1 lg:order-2 flex-1 min-w-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              {viewingAsCaptain ? (
                <FilterPills
                  options={panelOptions}
                  selected={activePanel}
                  onChange={setActivePanel}
                  ariaLabel="Player pool or draft queue"
                />
              ) : (
                <CardTitle>{canPick ? 'Select a Player' : 'Available Players'}</CardTitle>
              )}
              <button
                type="button"
                onClick={() => {
                  setExpandedPanel(viewingAsCaptain ? activePanel : 'pool')
                  setIsExpanded(true)
                }}
                className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
                title="Expand view"
                aria-label="Expand view"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="h-[500px] lg:h-[calc(100vh-14rem)]">
              {activePanel === 'pool' || !viewingAsCaptain ? (
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
                  sortDirection={poolSortDirection}
                  onSortDirectionChange={setPoolSortDirection}
                  searchInputRef={searchInputRef}
                  notes={notesOwnerId ? notes : undefined}
                  onNoteChange={notesOwnerId ? setNote : undefined}
                  fieldSchemas={fieldSchemas}
                  filters={poolFilters}
                  onFilterChange={handleFilterChange}
                  onClearFilters={handleClearFilters}
                />
              ) : (
                <DraftQueue
                  captain={viewingAsCaptain}
                  availablePlayers={availablePlayers}
                  leagueId={league.id}
                  captainToken={captainToken}
                  customFieldsMap={customFieldsMap}
                  fieldSchemas={fieldSchemas}
                  notes={notesOwnerId ? notes : undefined}
                  onNoteChange={notesOwnerId ? setNote : undefined}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}

      {/* Expanded Pool / Queue Modal */}
      {isExpanded && (
        <ExpandedModal onClose={() => setIsExpanded(false)}>
          <Card className="flex h-[90vh] w-full max-w-4xl flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 flex-shrink-0">
              {viewingAsCaptain ? (
                <FilterPills
                  options={panelOptions}
                  selected={expandedPanel}
                  onChange={setExpandedPanel}
                  ariaLabel="Player pool or draft queue"
                />
              ) : (
                <CardTitle>{canPick ? 'Select a Player' : 'Available Players'}</CardTitle>
              )}
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
                title="Collapse"
                aria-label="Collapse"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              {expandedPanel === 'pool' || !viewingAsCaptain ? (
                <PlayerPool
                  players={availablePlayers}
                  customFieldsMap={customFieldsMap}
                  canPick={canPick && isActive}
                  onPick={(playerId) => {
                    handlePick(playerId)
                    setIsExpanded(false)
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
                  sortDirection={poolSortDirection}
                  onSortDirectionChange={setPoolSortDirection}
                  notes={notesOwnerId ? notes : undefined}
                  onNoteChange={notesOwnerId ? setNote : undefined}
                  fieldSchemas={fieldSchemas}
                  filters={poolFilters}
                  onFilterChange={handleFilterChange}
                  onClearFilters={handleClearFilters}
                />
              ) : (
                <DraftQueue
                  captain={viewingAsCaptain}
                  availablePlayers={availablePlayers}
                  leagueId={league.id}
                  captainToken={captainToken}
                  customFieldsMap={customFieldsMap}
                  fieldSchemas={fieldSchemas}
                  notes={notesOwnerId ? notes : undefined}
                  onNoteChange={notesOwnerId ? setNote : undefined}
                  showExpandedDetails={true}
                />
              )}
            </CardContent>
          </Card>
        </ExpandedModal>
      )}
    </div>
  )
}

function ExpandedModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
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
