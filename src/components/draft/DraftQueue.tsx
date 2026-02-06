import { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown, X, ListOrdered, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useDraftQueue, useRemoveFromQueue, useMoveInQueue, useToggleAutoPick } from '@/hooks/useDraftQueue'
import type { Captain, Player } from '@/lib/types'

interface DraftQueueProps {
  captain: Captain
  availablePlayers: Player[]
  leagueId?: string
  captainToken?: string
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function DraftQueue({ captain, availablePlayers, leagueId, captainToken }: DraftQueueProps) {
  const { data: queue = [], isLoading } = useDraftQueue(captain.id)
  const removeFromQueue = useRemoveFromQueue()
  const moveInQueue = useMoveInQueue()
  const toggleAutoPick = useToggleAutoPick()
  const { addToast } = useToast()

  // Drag state
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Local state for optimistic UI updates
  const [isAutoPickEnabled, setIsAutoPickEnabled] = useState(captain.auto_pick_enabled)

  // Sync local state with server state when it changes
  useEffect(() => {
    setIsAutoPickEnabled(captain.auto_pick_enabled)
  }, [captain.auto_pick_enabled])

  // Filter queue to only show available players (not drafted yet)
  const availablePlayerIds = new Set(availablePlayers.map((p) => p.id))
  const availableQueue = queue.filter((q) => availablePlayerIds.has(q.player_id))

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

  function handleDragStart(index: number) {
    setDragIndex(index)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  function handleDragEnd() {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      const item = availableQueue[dragIndex]
      moveInQueue.mutate({
        captainId: captain.id,
        queueEntryId: item.id,
        newPosition: dragOverIndex,
      })
    }
    setDragIndex(null)
    setDragOverIndex(null)
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
    } catch (error) {
      // Revert optimistic update on error
      setIsAutoPickEnabled(!newEnabled)
      console.error('Toggle auto-pick failed:', error)
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
          className="flex items-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div
            className={`relative w-11 h-6 rounded-full transition-colors ${
              isAutoPickEnabled ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 bg-background rounded-full transition-transform ${
                isAutoPickEnabled ? 'left-6' : 'left-1'
              }`}
            />
          </div>
          <span className="text-sm font-medium">
            Auto-pick
          </span>
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
          <div className="flex h-full flex-col items-center justify-center p-8 text-muted-foreground text-center">
            <ListOrdered className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p>Your queue is empty</p>
            <p className="text-xs mt-1">Click the + button on players to add them</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {availableQueue.map((item, index) => (
              <li
                key={item.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-2 px-3 py-2 transition-colors hover:bg-accent/50 ${
                  dragIndex === index ? 'opacity-50' : ''
                } ${
                  dragOverIndex === index && dragIndex !== null && dragIndex !== index
                    ? dragIndex < index
                      ? 'border-b-2 border-b-primary'
                      : 'border-t-2 border-t-primary'
                    : ''
                }`}
              >
                {/* Drag handle */}
                <GripVertical className="h-4 w-4 flex-shrink-0 cursor-grab text-muted-foreground/50 active:cursor-grabbing" />

                {/* Position number */}
                <span className="w-6 text-center text-sm font-medium text-muted-foreground">
                  {index + 1}
                </span>

                {/* Player info */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {item.player.profile_picture_url ? (
                    <img
                      src={item.player.profile_picture_url}
                      alt={item.player.name}
                      loading="lazy"
                      className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground flex-shrink-0">
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
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0 || moveInQueue.isPending}
                    title="Move up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleMoveDown(index)}
                    disabled={index === availableQueue.length - 1 || moveInQueue.isPending}
                    title="Move down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(item.id)}
                    disabled={removeFromQueue.isPending}
                    title="Remove from queue"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Queue count */}
      {availableQueue.length > 0 && (
        <div className="mt-2 text-xs text-muted-foreground text-center">
          {availableQueue.length} player{availableQueue.length !== 1 ? 's' : ''} in queue
        </div>
      )}
    </div>
  )
}
