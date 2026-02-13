import { useState, useRef, useEffect } from 'react'
import { Crown, User } from 'lucide-react'
import { PlayerProfileModal } from '@/components/player/PlayerProfileModal'
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber'
import { useToggleAutoPick } from '@/hooks/useDraftQueue'
import { cn, getInitials } from '@/lib/utils'
import type { CaptainPublic, PlayerPublic, PlayerCustomField } from '@/lib/types'

function AnimatedCount({ count, label }: { count: number; label: string }) {
  const display = useAnimatedNumber(count)
  return (
    <span className="text-sm text-muted-foreground">
      {display} {label}
    </span>
  )
}

interface TeamRosterProps {
  captains: CaptainPublic[]
  players: PlayerPublic[]
  currentCaptainId?: string
  highlightCaptainId?: string
  customFieldsMap?: Record<string, PlayerCustomField[]>
  isManager?: boolean
  leagueId?: string
}

export function TeamRoster({
  captains,
  players,
  currentCaptainId,
  highlightCaptainId,
  customFieldsMap = {},
  isManager = false,
  leagueId,
}: TeamRosterProps) {
  const [viewingPlayer, setViewingPlayer] = useState<PlayerPublic | null>(null)
  const toggleAutoPick = useToggleAutoPick()
  const knownPlayerIdsRef = useRef<Set<string>>(new Set())
  const [newPlayerIds, setNewPlayerIds] = useState<Set<string>>(new Set())
  const sortedCaptains = [...captains].sort((a, b) => a.draft_position - b.draft_position)

  // Track new picks for animation
  const allDraftedIds = new Set(players.filter((p) => p.drafted_by_captain_id).map((p) => p.id))

  useEffect(() => {
    const newIds = new Set<string>()
    allDraftedIds.forEach((id) => {
      if (!knownPlayerIdsRef.current.has(id)) {
        newIds.add(id)
      }
    })
    if (newIds.size > 0) {
      setNewPlayerIds(newIds) // eslint-disable-line react-hooks/set-state-in-effect
      // Clear animation class after animation completes
      const timer = setTimeout(() => setNewPlayerIds(new Set()), 1800)
      knownPlayerIdsRef.current = new Set(allDraftedIds)
      return () => clearTimeout(timer)
    }
    knownPlayerIdsRef.current = new Set(allDraftedIds)
  }, [allDraftedIds.size]) // eslint-disable-line react-hooks/exhaustive-deps

  function getPlayersForCaptain(captainId: string) {
    return players
      .filter((p) => p.drafted_by_captain_id === captainId)
      .sort((a, b) => (a.draft_pick_number ?? 0) - (b.draft_pick_number ?? 0))
  }

  function getCaptainPlayer(captain: CaptainPublic): PlayerPublic | undefined {
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
              'rounded-lg border border-l-4 p-3 sm:p-4 transition-all',
              isCurrentTurn && 'border-primary ring-2 ring-primary/20',
              isHighlighted && !isCurrentTurn && 'border-yellow-500 bg-yellow-500/5',
              !isCurrentTurn && !isHighlighted && 'border-border'
            )}
            style={{
              borderLeftColor: captain.team_color || undefined,
            }}
          >
            <div className="mb-2 sm:mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                {captain.team_photo_url ? (
                  <img
                    src={captain.team_photo_url}
                    alt={captain.team_name || captain.name}
                    className="h-7 w-7 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <Crown
                    className={cn(
                      'h-4 w-4 flex-shrink-0',
                      isCurrentTurn ? 'text-primary' : 'text-muted-foreground'
                    )}
                    style={{ color: captain.team_color || undefined }}
                  />
                )}
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{captain.team_name || captain.name}</h3>
                  {captain.team_name && (
                    <span className="text-xs text-muted-foreground truncate block">
                      {captain.name}
                    </span>
                  )}
                </div>
              </div>
              <AnimatedCount count={teamPlayers.length} label="players" />
            </div>

            {isCurrentTurn && (
              <div className="mb-2 sm:mb-3 rounded bg-primary/10 px-2 py-1 text-center text-xs font-medium text-primary">
                Now Picking
              </div>
            )}

            {isManager && leagueId && (
              <button
                type="button"
                role="switch"
                aria-checked={captain.auto_pick_enabled}
                onClick={() =>
                  toggleAutoPick.mutate({
                    captainId: captain.id,
                    enabled: !captain.auto_pick_enabled,
                    leagueId,
                  })
                }
                className="mb-2 sm:mb-3 flex items-center gap-2"
              >
                <div
                  className={cn(
                    'relative h-5 w-9 rounded-full transition-colors',
                    captain.auto_pick_enabled ? 'bg-primary' : 'bg-muted'
                  )}
                >
                  <div
                    className={cn(
                      'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                      captain.auto_pick_enabled ? 'translate-x-4' : 'translate-x-0.5'
                    )}
                  />
                </div>
                <span className="text-xs text-muted-foreground">Auto-pick</span>
              </button>
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
                <li
                  key={player.id}
                  className={cn(
                    'flex items-center gap-2 text-sm rounded px-1',
                    newPlayerIds.has(player.id) && 'animate-slide-in-right animate-highlight-pulse'
                  )}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-xs">
                    {player.draft_pick_number}
                  </span>
                  <span>{player.name}</span>
                </li>
              ))}
              {teamPlayers.length === 0 && !captain.is_participant && (
                <li className="text-sm text-muted-foreground italic">No picks yet</li>
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
