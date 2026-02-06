import { useState } from 'react'
import { Search, User, Plus } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { PlayerProfileModal } from '@/components/player/PlayerProfileModal'
import { cn } from '@/lib/utils'
import { calculateAge, type Player, type PlayerCustomField } from '@/lib/types'

interface PlayerPoolProps {
  players: Player[]
  customFieldsMap?: Record<string, PlayerCustomField[]>
  canPick: boolean
  onPick: (playerId: string) => void
  isPicking: boolean
  showExpandedDetails?: boolean
  onAddToQueue?: (playerId: string) => void
  queuedPlayerIds?: Set<string>
  isAddingToQueue?: boolean
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function PlayerPool({ players, customFieldsMap = {}, canPick, onPick, isPicking, showExpandedDetails = false, onAddToQueue, queuedPlayerIds = new Set(), isAddingToQueue = false }: PlayerPoolProps) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewingPlayer, setViewingPlayer] = useState<Player | null>(null)

  const filteredPlayers = players
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      // First sort by having a profile picture (those with pictures first)
      const aHasPic = a.profile_picture_url ? 1 : 0
      const bHasPic = b.profile_picture_url ? 1 : 0
      if (bHasPic !== aHasPic) return bHasPic - aHasPic

      // Then sort by age (youngest first, null birthdays last)
      const aAge = calculateAge(a.birthday)
      const bAge = calculateAge(b.birthday)
      if (aAge === null && bAge === null) return 0
      if (aAge === null) return 1
      if (bAge === null) return -1
      return aAge - bAge
    })

  function handlePick() {
    if (selectedId && canPick) {
      onPick(selectedId)
      setSelectedId(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filteredPlayers.length} available
        </span>
      </div>

      <div className="flex-1 overflow-y-auto rounded-lg border border-border">
        {filteredPlayers.length === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-muted-foreground">
            {search ? 'No players match your search' : 'No players available'}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filteredPlayers.map((player) => {
              const age = calculateAge(player.birthday)
              const customFields = customFieldsMap[player.id] || []
              const hasExpandableContent = player.bio || player.weight || player.hometown || customFields.length > 0

              return (
                <li key={player.id}>
                  <div
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 transition-colors min-h-[52px]',
                      canPick && !isPicking && 'cursor-pointer hover:bg-accent',
                      !canPick && 'cursor-default',
                      isPicking && 'opacity-50',
                      selectedId === player.id && 'bg-primary/10 hover:bg-primary/20 ring-2 ring-primary ring-inset'
                    )}
                    onClick={() => canPick && !isPicking && setSelectedId(player.id)}
                  >
                    {/* Profile Picture */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setViewingPlayer(player)
                      }}
                      className="flex-shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {player.profile_picture_url ? (
                        <img
                          src={player.profile_picture_url}
                          alt={player.name}
                          loading="lazy"
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                          {getInitials(player.name)}
                        </div>
                      )}
                    </button>

                    {/* Player Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-base truncate">{player.name}</div>
                      {(age !== null || player.height) && (
                        <div className="text-sm text-muted-foreground">
                          {age !== null && <span>{age} yrs</span>}
                          {age !== null && player.height && <span> · </span>}
                          {player.height && <span>{player.height}</span>}
                        </div>
                      )}
                    </div>

                    {/* View Profile Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setViewingPlayer(player)
                      }}
                      className="flex-shrink-0 p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
                      title="View full profile"
                    >
                      <User className="h-4 w-4" />
                    </button>

                    {/* Add to Queue Button */}
                    {onAddToQueue && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onAddToQueue(player.id)
                        }}
                        disabled={queuedPlayerIds.has(player.id) || isAddingToQueue}
                        className={cn(
                          'flex-shrink-0 p-2 rounded-md',
                          queuedPlayerIds.has(player.id)
                            ? 'text-primary cursor-default'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                        )}
                        title={queuedPlayerIds.has(player.id) ? 'Already in queue' : 'Add to queue'}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Expanded Content (only in fullscreen mode) */}
                  {showExpandedDetails && hasExpandableContent && (
                    <div className="border-t border-border/50 bg-muted/30 px-4 py-3 pl-6">
                      {/* Stats Row */}
                      {(player.weight || player.hometown) && (
                        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          {player.weight && (
                            <span>
                              <span className="text-muted-foreground">Weight:</span> {player.weight}
                            </span>
                          )}
                          {player.hometown && (
                            <span>
                              <span className="text-muted-foreground">From:</span> {player.hometown}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Bio */}
                      {player.bio && (
                        <p className="mb-2 text-sm text-muted-foreground line-clamp-3">
                          {player.bio}
                        </p>
                      )}

                      {/* Custom Fields */}
                      {customFields.length > 0 && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          {customFields.map((field) => (
                            <span key={field.id}>
                              <span className="text-muted-foreground">{field.field_name}:</span> {field.field_value || '-'}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {canPick && (
        <div className="mt-4 flex-shrink-0">
          <Button
            onClick={handlePick}
            disabled={!selectedId || isPicking}
            className="w-full min-h-[52px] text-base touch-manipulation"
            size="lg"
          >
            {isPicking
              ? 'Picking...'
              : selectedId
              ? `Draft ${filteredPlayers.find((p) => p.id === selectedId)?.name}`
              : 'Select a player to draft'}
          </Button>
        </div>
      )}

      {/* Player Profile Modal */}
      {viewingPlayer && (
        <PlayerProfileModal
          player={viewingPlayer}
          customFields={customFieldsMap[viewingPlayer.id] || []}
          onClose={() => setViewingPlayer(null)}
        />
      )}
    </div>
  )
}
