import { ChevronUp, ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useDraftQueue, useRemoveFromQueue, useMoveInQueue, useToggleAutoPick } from '@/hooks/useDraftQueue'
import type { Captain, Player } from '@/lib/types'

interface DraftQueueProps {
  captain: Captain
  availablePlayers: Player[]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function DraftQueue({ captain, availablePlayers }: DraftQueueProps) {
  const { data: queue = [], isLoading } = useDraftQueue(captain.id)
  const removeFromQueue = useRemoveFromQueue()
  const moveInQueue = useMoveInQueue()
  const toggleAutoPick = useToggleAutoPick()

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

  function handleToggleAutoPick() {
    toggleAutoPick.mutate({
      captainId: captain.id,
      enabled: !captain.auto_pick_enabled,
    })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Auto-pick toggle */}
      <div className="mb-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={captain.auto_pick_enabled}
              onChange={handleToggleAutoPick}
              disabled={toggleAutoPick.isPending}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary transition-colors" />
            <div className="absolute left-1 top-1 w-4 h-4 bg-background rounded-full transition-transform peer-checked:translate-x-5" />
          </div>
          <span className="text-sm font-medium">
            Auto-pick from queue
          </span>
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          {captain.auto_pick_enabled
            ? 'When your timer expires, the top player from your queue will be picked automatically.'
            : 'When your timer expires, a random player will be picked.'}
        </p>
      </div>

      {/* Queue list */}
      <div className="flex-1 overflow-y-auto rounded-lg border border-border">
        {isLoading ? (
          <div className="flex h-full items-center justify-center p-8 text-muted-foreground">
            Loading queue...
          </div>
        ) : availableQueue.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-muted-foreground text-center">
            <div>
              <p>Your queue is empty</p>
              <p className="text-xs mt-1">Click the + button on players to add them</p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {availableQueue.map((item, index) => (
              <li
                key={item.id}
                className="flex items-center gap-2 px-3 py-2"
              >
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
