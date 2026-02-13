import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Copy, Crown, Users, Clock } from 'lucide-react'
import { StatusBadge, StatusDot } from '@/components/ui/StatusBadge'
import { CopyLeagueModal } from '@/components/league/CopyLeagueModal'
import type { LeagueWithCounts } from '@/lib/types'

interface LeagueListItemProps {
  league: LeagueWithCounts
  index?: number
}

export function LeagueListItem({ league, index = 0 }: LeagueListItemProps) {
  const [showCopyModal, setShowCopyModal] = useState(false)

  const timerLabel =
    league.time_limit_seconds >= 60 && league.time_limit_seconds % 60 === 0
      ? `${league.time_limit_seconds / 60}m`
      : `${league.time_limit_seconds}s`

  return (
    <>
      <Link to={`/league/${league.id}/manage`}>
        <div
          className="animate-slide-up flex items-center gap-3 border-b border-border bg-card px-4 py-3 transition-colors [animation-fill-mode:backwards] hover:bg-muted/50 sm:gap-4"
          style={{ animationDelay: `${index * 0.03}s` }}
        >
          {/* Status dot — always visible */}
          <StatusDot status={league.status} className="shrink-0" />

          {/* Name + draft type */}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{league.name}</p>
            <p className="text-xs text-muted-foreground">
              {league.draft_type === 'snake' ? 'Snake' : 'Round Robin'}
            </p>
          </div>

          {/* Stats — hidden on mobile */}
          <div className="hidden items-center gap-4 text-sm text-muted-foreground sm:flex">
            <span className="flex items-center gap-1">
              <Crown className="h-3.5 w-3.5" />
              {league.captains.length}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {league.players.length}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {timerLabel}
            </span>
          </div>

          {/* Badge */}
          <StatusBadge status={league.status} className="hidden sm:inline-flex" />

          {/* Copy button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowCopyModal(true)
            }}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Copy league"
            aria-label="Copy league"
          >
            <Copy className="h-4 w-4" />
          </button>

          {/* Chevron */}
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </Link>
      <CopyLeagueModal
        league={league}
        isOpen={showCopyModal}
        onClose={() => setShowCopyModal(false)}
      />
    </>
  )
}
