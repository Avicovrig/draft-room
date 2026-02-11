import { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown, X, ListOrdered, GripVertical } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import {
  useDraftQueue,
  useRemoveFromQueue,
  useMoveInQueue,
  useToggleAutoPick,
} from '@/hooks/useDraftQueue'
import type { CaptainPublic, PlayerPublic } from '@/lib/types'
import { getInitials } from '@/lib/utils'

interface DraftQueueProps {
  captain: CaptainPublic
  availablePlayers: PlayerPublic[]
  leagueId: string
  captainToken?: string
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
}: SortableQueueItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-accent/50"
    >
      {/* Drag handle */}
      <button
        type="button"
        className="cursor-grab touch-none p-0.5 text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 flex-shrink-0" />
      </button>

      {/* Position number */}
      <span className="w-6 text-center text-sm font-medium text-muted-foreground">{index + 1}</span>

      {/* Player info */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {item.player.profile_picture_url ? (
          <img
            src={item.player.profile_picture_url}
            alt={item.player.name}
            loading="lazy"
            className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
            {getInitials(item.player.name)}
          </div>
        )}
        <span className="truncate text-sm">{item.player.name}</span>
      </div>

      {/* Move buttons */}
      <div className="flex items-center gap-1">
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
    </li>
  )
}

export function DraftQueue({ captain, availablePlayers, leagueId, captainToken }: DraftQueueProps) {
  const { data: queue = [], isLoading } = useDraftQueue(captain.id)
  const removeFromQueue = useRemoveFromQueue()
  const moveInQueue = useMoveInQueue()
  const toggleAutoPick = useToggleAutoPick()
  const { addToast } = useToast()

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

  // Drag-and-drop sensors (PointerSensor handles both mouse and touch)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = availableQueue.findIndex((q) => q.id === active.id)
    const newIndex = availableQueue.findIndex((q) => q.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    moveInQueue.mutate({
      captainId: captain.id,
      queueEntryId: active.id as string,
      newPosition: newIndex,
    })
  }

  function handleMoveUp(index: number) {
    if (index === 0) return
    const item = availableQueue[index]
    moveInQueue.mutate({
      captainId: captain.id,
      queueEntryId: item.id,
      newPosition: index - 1,
    })
  }

  function handleMoveDown(index: number) {
    if (index === availableQueue.length - 1) return
    const item = availableQueue[index]
    moveInQueue.mutate({
      captainId: captain.id,
      queueEntryId: item.id,
      newPosition: index + 1,
    })
  }

  function handleRemove(queueEntryId: string) {
    removeFromQueue.mutate({
      captainId: captain.id,
      queueEntryId,
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={availableQueue.map((q) => q.id)}
              strategy={verticalListSortingStrategy}
            >
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
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Queue count */}
      {availableQueue.length > 0 && (
        <div className="mt-2 text-center text-xs text-muted-foreground">
          {availableQueue.length} player{availableQueue.length !== 1 ? 's' : ''} in queue
        </div>
      )}
    </div>
  )
}
