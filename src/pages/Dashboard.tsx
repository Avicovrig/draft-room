import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Trophy } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { LeagueCard } from '@/components/league/LeagueCard'
import { LeagueListItem } from '@/components/league/LeagueListItem'
import { LeagueCardSkeleton, LeagueListItemSkeleton } from '@/components/ui/Skeleton'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { FilterPills } from '@/components/ui/FilterPills'
import { Input } from '@/components/ui/Input'
import { ViewToggle } from '@/components/ui/ViewToggle'
import { statusConfig } from '@/lib/statusConfig'
import { useAuth } from '@/context/AuthContext'
import { useLeagues } from '@/hooks/useLeagues'
import type { LeagueStatus } from '@/lib/types'

type StatusFilter = 'all' | LeagueStatus

const filterOptions: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'not_started', label: statusConfig.not_started.label },
  { value: 'in_progress', label: statusConfig.in_progress.label },
  { value: 'paused', label: statusConfig.paused.label },
  { value: 'completed', label: statusConfig.completed.label },
]

function getStoredView(): 'grid' | 'list' {
  try {
    const stored = localStorage.getItem('draft-room-dashboard-view')
    if (stored === 'grid' || stored === 'list') return stored
  } catch {
    // localStorage unavailable
  }
  return 'grid'
}

export function Dashboard() {
  const { user } = useAuth()
  const { data: leagues, isLoading, error, refetch } = useLeagues()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState<'grid' | 'list'>(getStoredView)

  function handleViewChange(v: 'grid' | 'list') {
    setView(v)
    try {
      localStorage.setItem('draft-room-dashboard-view', v)
    } catch {
      // localStorage unavailable
    }
  }

  const filteredLeagues = leagues
    ? leagues
        .filter((l) => statusFilter === 'all' || l.status === statusFilter)
        .filter((l) => l.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : []

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Your Leagues</h1>
            <p className="mt-1 text-muted-foreground">Logged in as {user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <ViewToggle view={view} onViewChange={handleViewChange} />
            <Link
              to="/league/new"
              className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              <Plus className="mr-2 h-4 w-4 flex-shrink-0" />
              Create League
            </Link>
          </div>
        </div>

        {leagues && leagues.length > 0 && (
          <div className="mt-6 space-y-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search leagues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <FilterPills
              options={filterOptions}
              selected={statusFilter}
              onChange={setStatusFilter}
              ariaLabel="Filter by status"
            />
          </div>
        )}

        <div className="mt-6">
          {isLoading ? (
            view === 'grid' ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <LeagueCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                {[1, 2, 3].map((i) => (
                  <LeagueListItemSkeleton key={i} />
                ))}
              </div>
            )
          ) : error ? (
            <ErrorAlert
              message="Failed to load leagues. Please try again."
              onRetry={() => refetch()}
            />
          ) : leagues && leagues.length > 0 ? (
            filteredLeagues.length > 0 ? (
              view === 'grid' ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredLeagues.map((league, i) => (
                    <LeagueCard key={league.id} league={league} index={i} />
                  ))}
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  {filteredLeagues.map((league, i) => (
                    <LeagueListItem key={league.id} league={league} index={i} />
                  ))}
                </div>
              )
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                {searchQuery
                  ? `No leagues matching "${searchQuery}"`
                  : `No ${statusConfig[statusFilter as LeagueStatus]?.label.toLowerCase()} leagues`}
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
