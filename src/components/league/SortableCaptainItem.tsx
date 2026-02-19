import { ChevronUp, ChevronDown, Settings, Trash2, Link as LinkIcon, Pencil } from 'lucide-react'
import { SortableItem, DragHandle } from '@/components/ui/SortableList'
import { Button } from '@/components/ui/Button'
import type { CaptainPublic } from '@/lib/types'

export interface SortableCaptainItemProps {
  captain: CaptainPublic
  index: number
  isEditable: boolean
  isFirst: boolean
  isLast: boolean
  isReordering: boolean
  isDeleting: boolean
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  onDelete: (id: string) => void
  onTeamSettings: (captain: CaptainPublic) => void
  onCopyLink: (captain: CaptainPublic) => void
  onEditPlayer?: (captain: CaptainPublic) => void
}

export function SortableCaptainItem({
  captain,
  index,
  isEditable,
  isFirst,
  isLast,
  isReordering,
  isDeleting,
  onMoveUp,
  onMoveDown,
  onDelete,
  onTeamSettings,
  onCopyLink,
  onEditPlayer,
}: SortableCaptainItemProps) {
  return (
    <SortableItem
      id={captain.id}
      disabled={!isEditable}
      className="rounded-lg border border-border p-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {isEditable && <DragHandle />}
          {isEditable && (
            <div className="hidden sm:flex flex-col">
              <button
                type="button"
                onClick={() => onMoveUp(index)}
                disabled={isFirst || isReordering}
                className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label="Move up"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onMoveDown(index)}
                disabled={isLast || isReordering}
                className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label="Move down"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          )}
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            {index + 1}
          </span>
          {captain.team_color && (
            <span
              className="h-4 w-4 flex-shrink-0 rounded-full"
              style={{ backgroundColor: captain.team_color }}
            />
          )}
          {captain.team_photo_url && (
            <img
              src={captain.team_photo_url}
              alt=""
              loading="lazy"
              className="h-8 w-8 flex-shrink-0 rounded object-cover"
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{captain.name}</span>
              {captain.player_id || captain.is_participant ? (
                <span className="whitespace-nowrap text-xs text-green-600 dark:text-green-400">
                  (Player)
                </span>
              ) : (
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  (Non-player)
                </span>
              )}
            </div>
            {captain.team_name && (
              <span className="text-sm text-muted-foreground">{captain.team_name}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {captain.player_id && onEditPlayer && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEditPlayer(captain)}
              title="Edit player profile"
              aria-label={`Edit profile for ${captain.name}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {isEditable && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onTeamSettings(captain)}
              title="Team settings"
              aria-label={`Team settings for ${captain.name}`}
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onCopyLink(captain)}
            title="Copy captain link"
            aria-label={`Copy link for ${captain.name}`}
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
          {isEditable && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(captain.id)}
              disabled={isDeleting}
              aria-label="Delete captain"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>
    </SortableItem>
  )
}
