import { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown, X, ListOrdered, User, StickyNote } from 'lucide-react'
import { SortableList, SortableItem, DragHandle } from '@/components/ui/SortableList'
import { Button } from '@/components/ui/Button'
import { PlayerProfileModal } from '@/components/player/PlayerProfileModal'
import { useToast } from '@/components/ui/Toast'
import {
  useDraftQueue,
  useRemoveFromQueue,
  useMoveInQueue,
  useToggleAutoPick,
} from '@/hooks/useDraftQueue'
import type { CaptainPublic, PlayerPublic, PlayerCustomField, LeagueFieldSchema } from '@/lib/types'
import { getInitials } from '@/lib/utils'

interface DraftQueueProps {
  captain: CaptainPublic
  availablePlayers: PlayerPublic[]
  leagueId: string
  captainToken?: string
  customFieldsMap?: Record<string, PlayerCustomField[]>
  fieldSchemas?: LeagueFieldSchema[]
  notes?: Record<string, string>
  onNoteChange?: (playerId: string, note: string) => void
  showExpandedDetails?: boolean
}

interface QueueEntry {
  id: string
  player_id: string
  player: PlayerPublic
}

interface SortableQueueItemProps {
  item: QueueEntry
  index: number
  isFirst: boolean
  isLast: boolean
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  onRemove: (id: string) => void
  isRemoving: boolean
  onViewProfile: (player: PlayerPublic) => void
  customFields?: PlayerCustomField[]
  note?: string
  isEditingNote: boolean
  onToggleNote: () => void
  onNoteChange?: (playerId: string, note: string) => void
  showExpandedDetails: boolean
}

function SortableQueueItem({
  item,
  index,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRemove,
  isRemoving,
  onViewProfile,
  customFields = [],
  note,
  isEditingNote,
  onToggleNote,
  onNoteChange,
  showExpandedDetails,
}: SortableQueueItemProps) {
  const hasExpandableContent = item.player.bio || customFields.length > 0

  return (
    <SortableItem id={item.id} className="transition-colors hover:bg-accent/50">
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Drag handle */}
        <DragHandle className="text-muted-foreground/50 hover:text-muted-foreground" />

        {/* Position number */}
        <span className="w-6 text-center text-sm font-medium text-muted-foreground">
          {index + 1}
        </span>

        {/* Player info with profile picture */}
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onViewProfile(item.player)}
          className="flex-shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {item.player.profile_picture_url ? (
            <img
              src={item.player.profile_picture_url}
              alt={item.player.name}
              loading="lazy"
              className="h-11 w-11 flex-shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
              {getInitials(item.player.name)}
            </div>
          )}
        </button>

        <span className="min-w-0 flex-1 truncate text-sm">{item.player.name}</span>

        {/* View Profile Button */}
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onViewProfile(item.player)}
          className="flex-shrink-0 p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
          title="View full profile"
        >
          <User className="h-4 w-4" />
        </button>

        {/* Note Button */}
        {onNoteChange && (
          <button
            type="button"
            tabIndex={-1}
            onClick={onToggleNote}
            className={
              note
                ? 'flex-shrink-0 p-1.5 rounded-md text-yellow-600 dark:text-yellow-400'
                : 'flex-shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent'
            }
            title={note ? 'Edit note' : 'Add note'}
          >
            <StickyNote className="h-4 w-4" />
          </button>
        )}

        {/* Move buttons */}
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onMoveUp(index)}
            disabled={isFirst}
            title="Move up"
            aria-label="Move up"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onMoveDown(index)}
            disabled={isLast}
            title="Move down"
            aria-label="Move down"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(item.id)}
            disabled={isRemoving}
            title="Remove from queue"
            aria-label="Remove from queue"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Inline Note Editor */}
      {isEditingNote && onNoteChange && (
        <div className="border-t border-border/50 bg-yellow-50/50 px-4 py-2 dark:bg-yellow-950/20">
          <label htmlFor={`queue-note-${item.player.id}`} className="sr-only">
            Note about {item.player.name}
          </label>
          <textarea
            id={`queue-note-${item.player.id}`}
            autoFocus
            rows={2}
            placeholder="Add a note about this player..."
            value={note || ''}
            onChange={(e) => onNoteChange(item.player.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                onToggleNote()
              }
            }}
            className="w-full resize-none rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      )}

      {/* Note Preview (when not editing, in expanded mode) */}
      {showExpandedDetails && note && !isEditingNote && (
        <div className="border-t border-border/50 bg-yellow-50/50 px-4 py-2 dark:bg-yellow-950/20">
          <p className="text-sm text-yellow-700 dark:text-yellow-300 line-clamp-2">
            <StickyNote className="mr-1 inline h-3 w-3" />
            {note}
          </p>
        </div>
      )}

      {/* Expanded Content (bio + custom fields) */}
      {showExpandedDetails && hasExpandableContent && (
        <div className="border-t border-border/50 bg-muted/30 px-4 py-3 pl-6">
          {item.player.bio && (
            <p className="mb-2 text-sm text-muted-foreground line-clamp-3">{item.player.bio}</p>
          )}
          {customFields.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {customFields.map((field) => (
                <span key={field.id}>
                  <span className="text-muted-foreground">{field.field_name}:</span>{' '}
                  {field.field_value || '-'}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </SortableItem>
  )
}

export function DraftQueue({
  captain,
  availablePlayers,
  leagueId,
  captainToken,
  customFieldsMap = {},
  fieldSchemas = [],
  notes = {},
  onNoteChange,
  showExpandedDetails = false,
}: DraftQueueProps) {
  const { data: queue = [], isLoading } = useDraftQueue(captain.id)
  const removeFromQueue = useRemoveFromQueue()
  const moveInQueue = useMoveInQueue()
  const toggleAutoPick = useToggleAutoPick()
  const { addToast } = useToast()

  const [viewingPlayer, setViewingPlayer] = useState<PlayerPublic | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)

  // Local state for optimistic UI updates
  const [isAutoPickEnabled, setIsAutoPickEnabled] = useState(captain.auto_pick_enabled)

  // Sync local state with server state when it changes
  // (intentional optimistic update pattern — local state enables instant UI feedback)
  useEffect(() => {
    setIsAutoPickEnabled(captain.auto_pick_enabled) // eslint-disable-line react-hooks/set-state-in-effect
  }, [captain.auto_pick_enabled])

  // Filter queue to only show available players (not drafted yet)
  const availablePlayerIds = new Set(availablePlayers.map((p) => p.id))
  const availableQueue = queue.filter((q) => availablePlayerIds.has(q.player_id))

  function handleDragReorder(activeId: string, overId: string) {
    const newIndex = availableQueue.findIndex((q) => q.id === overId)
    if (newIndex === -1) return

    moveInQueue.mutate({
      captainId: captain.id,
      queueEntryId: activeId,
      newPosition: newIndex,
      leagueId,
      captainToken,
    })
  }

  function handleMoveUp(index: number) {
    if (index === 0) return
    const item = availableQueue[index]
    moveInQueue.mutate({
      captainId: captain.id,
      queueEntryId: item.id,
      newPosition: index - 1,
      leagueId,
      captainToken,
    })
  }

  function handleMoveDown(index: number) {
    if (index === availableQueue.length - 1) return
    const item = availableQueue[index]
    moveInQueue.mutate({
      captainId: captain.id,
      queueEntryId: item.id,
      newPosition: index + 1,
      leagueId,
      captainToken,
    })
  }

  function handleRemove(queueEntryId: string) {
    removeFromQueue.mutate({
      captainId: captain.id,
      queueEntryId,
      leagueId,
      captainToken,
    })
  }

  async function handleToggleAutoPick() {
    const newEnabled = !isAutoPickEnabled

    // Optimistically update the UI immediately
    setIsAutoPickEnabled(newEnabled)

    try {
      // Toggle the setting - DraftBoard will handle triggering auto-pick
      await toggleAutoPick.mutateAsync({
        captainId: captain.id,
        enabled: newEnabled,
        leagueId,
        captainToken,
      })
    } catch {
      // Revert optimistic update on error
      setIsAutoPickEnabled(!newEnabled)
      addToast('Failed to toggle auto-pick', 'error')
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Auto-pick toggle */}
      <div className="mb-4">
        <button
          type="button"
          role="switch"
          aria-checked={isAutoPickEnabled}
          onClick={handleToggleAutoPick}
          disabled={toggleAutoPick.isPending}
          className="flex cursor-pointer items-center gap-3 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div
            className={`relative h-6 w-11 rounded-full transition-colors ${
              isAutoPickEnabled ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <div
              className={`absolute top-1 h-4 w-4 rounded-full bg-background transition-transform ${
                isAutoPickEnabled ? 'left-6' : 'left-1'
              }`}
            />
          </div>
          <span className="text-sm font-medium">Auto-pick</span>
        </button>
        <p className="mt-1 text-xs text-muted-foreground">
          {isAutoPickEnabled
            ? 'When your turn starts, the top player from your queue will be picked automatically.'
            : 'When your timer expires, a player will be picked from your queue (or randomly if empty).'}
        </p>
      </div>

      {/* Queue list */}
      <div className="flex-1 overflow-y-auto rounded-lg border border-border">
        {isLoading ? (
          <div className="flex h-full items-center justify-center p-8 text-muted-foreground">
            Loading queue...
          </div>
        ) : availableQueue.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <ListOrdered className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p>Your queue is empty</p>
            <p className="mt-1 text-xs">Click the + button on players to add them</p>
          </div>
        ) : (
          <SortableList items={availableQueue.map((q) => q.id)} onReorder={handleDragReorder}>
            <ul className="divide-y divide-border">
              {availableQueue.map((item, index) => (
                <SortableQueueItem
                  key={item.id}
                  item={item}
                  index={index}
                  isFirst={index === 0}
                  isLast={index === availableQueue.length - 1}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                  onRemove={handleRemove}
                  isRemoving={removeFromQueue.isPending}
                  onViewProfile={setViewingPlayer}
                  customFields={customFieldsMap[item.player_id]}
                  note={notes[item.player_id]}
                  isEditingNote={editingNoteId === item.player_id}
                  onToggleNote={() =>
                    setEditingNoteId(editingNoteId === item.player_id ? null : item.player_id)
                  }
                  onNoteChange={onNoteChange}
                  showExpandedDetails={showExpandedDetails}
                />
              ))}
            </ul>
          </SortableList>
        )}
      </div>

      {/* Queue count */}
      {availableQueue.length > 0 && (
        <div className="mt-2 text-center text-xs text-muted-foreground">
          {availableQueue.length} player{availableQueue.length !== 1 ? 's' : ''} in queue
        </div>
      )}

      {/* Player Profile Modal */}
      {viewingPlayer && (
        <PlayerProfileModal
          player={viewingPlayer}
          customFields={customFieldsMap[viewingPlayer.id] || []}
          fieldSchemas={fieldSchemas}
          note={notes[viewingPlayer.id]}
          onClose={() => setViewingPlayer(null)}
        />
      )}
    </div>
  )
}
