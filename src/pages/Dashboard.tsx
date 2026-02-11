import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trophy } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { LeagueCard } from '@/components/league/LeagueCard'
import { LeagueCardSkeleton } from '@/components/ui/Skeleton'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { useAuth } from '@/context/AuthContext'
import { useLeagues } from '@/hooks/useLeagues'
import { cn } from '@/lib/utils'

const statusLabels: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  paused: 'Paused',
  completed: 'Completed',
}

export function Dashboard() {
  const { user } = useAuth()
  const { data: leagues, isLoading, error, refetch } = useLeagues()
  const [statusFilter, setStatusFilter] = useState('all')

  const filteredLeagues = leagues
    ? statusFilter === 'all'
      ? leagues
      : leagues.filter((l) => l.status === statusFilter)
    : []

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Your Leagues</h1>
            <p className="mt-1 text-muted-foreground">Logged in as {user?.email}</p>
          </div>
          <Link
            to="/league/new"
            className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4 flex-shrink-0" />
            Create League
          </Link>
        </div>

        {leagues && leagues.length > 0 && (
          <div className="mt-6 flex gap-2 overflow-x-auto">
            {['all', 'not_started', 'in_progress', 'paused', 'completed'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                  statusFilter === status
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                {status === 'all' ? 'All' : statusLabels[status]}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <LeagueCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <ErrorAlert
              message="Failed to load leagues. Please try again."
              onRetry={() => refetch()}
            />
          ) : leagues && leagues.length > 0 ? (
            filteredLeagues.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredLeagues.map((league, i) => (
                  <LeagueCard key={league.id} league={league} index={i} />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                No {statusLabels[statusFilter]?.toLowerCase()} leagues
              </div>
            )
          ) : (
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
              <Trophy className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
              <h3 className="text-lg font-medium">No leagues yet</h3>
              <p className="mt-2 text-muted-foreground">
                Create your first league to get started with drafting.
              </p>
              <Link
                to="/league/new"
                className="mt-4 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create League
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
