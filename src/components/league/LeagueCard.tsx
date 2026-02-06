import { Link } from 'react-router-dom'
import { Settings, Play, Users } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import type { League } from '@/lib/types'

interface LeagueCardProps {
  league: League
}

const statusColors = {
  not_started: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  in_progress: 'bg-green-500/10 text-green-600 dark:text-green-400',
  paused: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  completed: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
}

const statusLabels = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  paused: 'Paused',
  completed: 'Completed',
}

export function LeagueCard({ league }: LeagueCardProps) {
  const statusColor = statusColors[league.status]
  const statusLabel = statusLabels[league.status]

  return (
    <Link to={`/league/${league.id}/manage`}>
      <Card className="transition-all duration-200 hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{league.name}</CardTitle>
              <CardDescription className="mt-1">
                {league.draft_type === 'snake' ? 'Snake Draft' : 'Round Robin'}
              </CardDescription>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}
            >
              {statusLabel}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{league.time_limit_seconds >= 60 && league.time_limit_seconds % 60 === 0 ? `${league.time_limit_seconds / 60}m` : `${league.time_limit_seconds}s`} per pick</span>
            </div>
            {league.status === 'not_started' ? (
              <div className="flex items-center gap-1">
                <Settings className="h-4 w-4" />
                <span>Configure</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Play className="h-4 w-4" />
                <span>View Draft</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
