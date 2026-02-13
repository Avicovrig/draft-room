import { User, Plus, StickyNote } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import type { PlayerPublic, PlayerCustomField } from '@/lib/types'

interface PlayerPoolItemProps {
  player: PlayerPublic
  customFields: PlayerCustomField[]
  isSelected: boolean
  onSelect: (id: string) => void
  canPick: boolean
  isPicking: boolean
  onViewProfile: (player: PlayerPublic) => void
  showExpandedDetails: boolean
  note?: string
  isEditingNote: boolean
  onToggleNote: () => void
  onNoteChange?: (playerId: string, note: string) => void
  onAddToQueue?: (playerId: string) => void
  isQueued: boolean
  isAddingToQueue: boolean
}

export function PlayerPoolItem({
  player,
  customFields,
  isSelected,
  onSelect,
  canPick,
  isPicking,
  onViewProfile,
  showExpandedDetails,
  note,
  isEditingNote,
  onToggleNote,
  onNoteChange,
  onAddToQueue,
  isQueued,
  isAddingToQueue,
}: PlayerPoolItemProps) {
  const hasExpandableContent = player.bio || customFields.length > 0

  return (
    <li id={`player-${player.id}`} role="option" aria-selected={isSelected}>
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3 transition-[colors,box-shadow] duration-150 min-h-[52px]',
          canPick && !isPicking && 'cursor-pointer hover:bg-accent',
          !canPick && 'cursor-default',
          isPicking && 'opacity-50',
          isSelected && 'bg-primary/10 hover:bg-primary/20 ring-2 ring-primary ring-inset'
        )}
        onClick={() => canPick && !isPicking && onSelect(player.id)}
      >
        {/* Profile Picture */}
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation()
            onViewProfile(player)
          }}
          className="flex-shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {player.profile_picture_url ? (
            <img
              src={player.profile_picture_url}
              alt={player.name}
              loading="lazy"
              className="h-11 w-11 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
              {getInitials(player.name)}
            </div>
          )}
        </button>

        {/* Player Info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-base truncate">{player.name}</div>
        </div>

        {/* View Profile Button */}
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation()
            onViewProfile(player)
          }}
          className="flex-shrink-0 p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
          title="View full profile"
        >
          <User className="h-4 w-4" />
        </button>

        {/* Note Button */}
        {onNoteChange && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation()
              onToggleNote()
            }}
            className={cn(
              'flex-shrink-0 p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md',
              note
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
            title={note ? 'Edit note' : 'Add note'}
          >
            <StickyNote className="h-4 w-4" />
          </button>
        )}

        {/* Add to Queue Button */}
        {onAddToQueue && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation()
              onAddToQueue(player.id)
            }}
            disabled={isQueued || isAddingToQueue}
            className={cn(
              'flex-shrink-0 p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md',
              isQueued
                ? 'text-primary cursor-default'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
            title={isQueued ? 'Already in queue' : 'Add to queue'}
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Inline Note Editor */}
      {isEditingNote && onNoteChange && (
        <div className="border-t border-border/50 bg-yellow-50/50 px-4 py-2 dark:bg-yellow-950/20">
          <label htmlFor={`note-${player.id}`} className="sr-only">
            Note about {player.name}
          </label>
          <textarea
            id={`note-${player.id}`}
            autoFocus
            rows={2}
            placeholder="Add a note about this player..."
            value={note || ''}
            onChange={(e) => onNoteChange(player.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                onToggleNote()
              }
            }}
            onClick={(e) => e.stopPropagation()}
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

      {/* Expanded Content (only in fullscreen mode) */}
      {showExpandedDetails && hasExpandableContent && (
        <div className="border-t border-border/50 bg-muted/30 px-4 py-3 pl-6">
          {/* Bio */}
          {player.bio && (
            <p className="mb-2 text-sm text-muted-foreground line-clamp-3">{player.bio}</p>
          )}

          {/* Custom Fields */}
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
    </li>
  )
}
