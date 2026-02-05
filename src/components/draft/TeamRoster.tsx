import { Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Captain, Player } from '@/lib/types'

interface TeamRosterProps {
  captains: Captain[]
  players: Player[]
  currentCaptainId?: string
  highlightCaptainId?: string
}

export function TeamRoster({
  captains,
  players,
  currentCaptainId,
  highlightCaptainId,
}: TeamRosterProps) {
  const sortedCaptains = [...captains].sort((a, b) => a.draft_position - b.draft_position)

  function getPlayersForCaptain(captainId: string) {
    return players
      .filter((p) => p.drafted_by_captain_id === captainId)
      .sort((a, b) => (a.draft_pick_number ?? 0) - (b.draft_pick_number ?? 0))
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {sortedCaptains.map((captain) => {
        const teamPlayers = getPlayersForCaptain(captain.id)
        const isCurrentTurn = captain.id === currentCaptainId
        const isHighlighted = captain.id === highlightCaptainId

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
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-xs">
                    C
                  </span>
                  <span className="text-muted-foreground">{captain.name}</span>
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
    </div>
  )
}
