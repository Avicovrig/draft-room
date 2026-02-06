import { useState } from 'react'
import { Crown, User } from 'lucide-react'
import { PlayerProfileModal } from '@/components/player/PlayerProfileModal'
import { cn } from '@/lib/utils'
import type { Captain, Player, PlayerCustomField } from '@/lib/types'

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

interface TeamRosterProps {
  captains: Captain[]
  players: Player[]
  currentCaptainId?: string
  highlightCaptainId?: string
  customFieldsMap?: Record<string, PlayerCustomField[]>
}

export function TeamRoster({
  captains,
  players,
  currentCaptainId,
  highlightCaptainId,
  customFieldsMap = {},
}: TeamRosterProps) {
  const [viewingPlayer, setViewingPlayer] = useState<Player | null>(null)
  const sortedCaptains = [...captains].sort((a, b) => a.draft_position - b.draft_position)

  function getPlayersForCaptain(captainId: string) {
    return players
      .filter((p) => p.drafted_by_captain_id === captainId)
      .sort((a, b) => (a.draft_pick_number ?? 0) - (b.draft_pick_number ?? 0))
  }

  function getCaptainPlayer(captain: Captain): Player | undefined {
    if (!captain.player_id) return undefined
    return players.find((p) => p.id === captain.player_id)
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {sortedCaptains.map((captain) => {
        const teamPlayers = getPlayersForCaptain(captain.id)
        const isCurrentTurn = captain.id === currentCaptainId
        const isHighlighted = captain.id === highlightCaptainId
        const captainPlayer = getCaptainPlayer(captain)

        return (
          <div
            key={captain.id}
            className={cn(
              'rounded-lg border p-4 transition-all',
              isCurrentTurn && 'border-primary ring-2 ring-primary/20',
              isHighlighted && !isCurrentTurn && 'border-yellow-500 bg-yellow-500/5',
              !isCurrentTurn && !isHighlighted && 'border-border'
            )}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown
                  className={cn(
                    'h-4 w-4',
                    isCurrentTurn ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
                <h3 className="font-semibold">{captain.name}</h3>
              </div>
              <span className="text-sm text-muted-foreground">
                {teamPlayers.length} players
              </span>
            </div>

            {isCurrentTurn && (
              <div className="mb-3 rounded bg-primary/10 px-2 py-1 text-center text-xs font-medium text-primary">
                Now Picking
              </div>
            )}

            <ul className="space-y-1">
              {captain.is_participant && (
                <li className="flex items-center gap-2 text-sm">
                  {captainPlayer?.profile_picture_url ? (
                    <img
                      src={captainPlayer.profile_picture_url}
                      alt={captain.name}
                      loading="lazy"
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-xs">
                      {captainPlayer ? getInitials(captain.name) : 'C'}
                    </span>
                  )}
                  <span className="flex-1 text-muted-foreground">{captain.name}</span>
                  {captainPlayer && (
                    <button
                      type="button"
                      onClick={() => setViewingPlayer(captainPlayer)}
                      className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
                      title="View profile"
                    >
                      <User className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              )}
              {teamPlayers.map((player) => (
                <li key={player.id} className="flex items-center gap-2 text-sm">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-xs">
                    {player.draft_pick_number}
                  </span>
                  <span>{player.name}</span>
                </li>
              ))}
              {teamPlayers.length === 0 && !captain.is_participant && (
                <li className="text-sm text-muted-foreground italic">
                  No picks yet
                </li>
              )}
            </ul>
          </div>
        )
      })}

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
