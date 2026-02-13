import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Settings, Play, Users, Copy, Crown, Clock } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { CopyLeagueModal } from '@/components/league/CopyLeagueModal'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { LeagueWithCounts } from '@/lib/types'

interface LeagueCardProps {
  league: LeagueWithCounts
  index?: number
}

export function LeagueCard({ league, index = 0 }: LeagueCardProps) {
  const [showCopyModal, setShowCopyModal] = useState(false)

  return (
    <>
      <Link to={`/league/${league.id}/manage`}>
        <Card
          className="animate-slide-up transition-all duration-200 [animation-fill-mode:backwards] hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5"
          style={{ animationDelay: `${index * 0.05}s` }}
        >
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">{league.name}</CardTitle>
                <CardDescription className="mt-1">
                  {league.draft_type === 'snake' ? 'Snake Draft' : 'Round Robin'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowCopyModal(true)
                  }}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Copy league"
                  aria-label="Copy league"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <StatusBadge status={league.status} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Crown className="h-4 w-4" />
                <span>{league.captains.length} captains</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{league.players.length} players</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>
                  {league.time_limit_seconds >= 60 && league.time_limit_seconds % 60 === 0
                    ? `${league.time_limit_seconds / 60}m`
                    : `${league.time_limit_seconds}s`}{' '}
                  per pick
                </span>
              </div>
              {league.scheduled_start_at && (
                <div className="flex items-center gap-1">
                  <Play className="h-4 w-4" />
                  <span>
                    {new Date(league.scheduled_start_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
              {!league.scheduled_start_at &&
                (league.status === 'not_started' ? (
                  <div className="flex items-center gap-1">
                    <Settings className="h-4 w-4" />
                    <span>Configure</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Play className="h-4 w-4" />
                    <span>View Draft</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </Link>
      <CopyLeagueModal
        league={league}
        isOpen={showCopyModal}
        onClose={() => setShowCopyModal(false)}
      />
    </>
  )
}
