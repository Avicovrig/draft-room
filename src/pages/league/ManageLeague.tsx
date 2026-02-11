import { useState, lazy, Suspense } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Settings, Users, Crown, Share2, Play, Trash2, ListChecks } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { ManageLeagueSkeleton, Skeleton } from '@/components/ui/Skeleton'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { useLeague, useDeleteLeague, useLeagueTokens } from '@/hooks/useLeagues'
import { useLeagueCustomFields } from '@/hooks/useCustomFields'
import { useLeagueFieldSchemas } from '@/hooks/useFieldSchemas'
import { DraftReadinessChecklist } from '@/components/league/DraftReadinessChecklist'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { getAvailablePlayers } from '@/lib/draft'

const PlayerList = lazy(() =>
  import('@/components/league/PlayerList').then((m) => ({ default: m.PlayerList }))
)
const CaptainList = lazy(() =>
  import('@/components/league/CaptainList').then((m) => ({ default: m.CaptainList }))
)
const FieldSchemaList = lazy(() =>
  import('@/components/league/FieldSchemaList').then((m) => ({ default: m.FieldSchemaList }))
)
const LeagueSettings = lazy(() =>
  import('@/components/league/LeagueSettings').then((m) => ({ default: m.LeagueSettings }))
)
const ShareLinks = lazy(() =>
  import('@/components/league/ShareLinks').then((m) => ({ default: m.ShareLinks }))
)

type Tab = 'settings' | 'players' | 'captains' | 'fields' | 'share'

export function ManageLeague() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: league, isLoading, error } = useLeague(id)
  const { data: customFieldsMap } = useLeagueCustomFields(id)
  const { data: fieldSchemas = [] } = useLeagueFieldSchemas(id)
  const { data: tokens } = useLeagueTokens(id)
  const deleteLeague = useDeleteLeague()
  const [activeTab, setActiveTab] = useState<Tab>('players')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  async function handleDelete() {
    if (!id) return
    try {
      await deleteLeague.mutateAsync(id)
      navigate('/dashboard')
    } catch {
      // Error handled by mutation
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <ManageLeagueSkeleton />
      </div>
    )
  }

  if (error || !league) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-6 sm:p-8">
          <ErrorAlert message="League not found or you don't have access." />
          <Link to="/dashboard" className="mt-4 inline-block text-primary hover:underline">
            Back to Dashboard
          </Link>
        </main>
      </div>
    )
  }

  const availablePlayers = getAvailablePlayers(league.players, league.captains)
  const canStartDraft =
    league.status === 'not_started' &&
    league.captains.length >= 2 &&
    availablePlayers.length >= league.captains.length

  const tabs = [
    { id: 'players' as const, label: 'Players', icon: Users, count: league.players.length },
    { id: 'captains' as const, label: 'Captains', icon: Crown, count: league.captains.length },
    { id: 'fields' as const, label: 'Fields', icon: ListChecks },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
    { id: 'share' as const, label: 'Share', icon: Share2 },
  ]

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-6 sm:p-8">
        {/* Header */}
        <div className="mb-8">
          <Breadcrumb
            items={[{ label: 'Dashboard', href: '/dashboard' }, { label: league.name }]}
          />
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">{league.name}</h1>
              <p className="mt-1 text-muted-foreground">
                {league.draft_type === 'snake' ? 'Snake Draft' : 'Round Robin'} •{' '}
                {league.time_limit_seconds >= 60 && league.time_limit_seconds % 60 === 0
                  ? `${league.time_limit_seconds / 60}m`
                  : `${league.time_limit_seconds}s`}{' '}
                per pick
              </p>
            </div>
            <div className="flex gap-2">
              {league.status === 'not_started' && (
                <Button onClick={() => navigate(`/league/${id}/draft`)} disabled={!canStartDraft}>
                  <Play className="mr-2 h-4 w-4" />
                  Start Draft
                </Button>
              )}
              {league.status !== 'not_started' && (
                <Button onClick={() => navigate(`/league/${id}/draft`)}>
                  <Play className="mr-2 h-4 w-4" />
                  View Draft
                </Button>
              )}
            </div>
          </div>

          {league.status === 'not_started' && (
            <DraftReadinessChecklist
              league={league}
              fieldSchemas={fieldSchemas}
              customFieldsMap={customFieldsMap}
            />
          )}
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="League management"
          className="scrollbar-hide mb-6 flex gap-1 overflow-x-auto border-b border-border"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.count !== undefined && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={activeTab}>
          <Suspense fallback={<TabSkeleton />}>
            {activeTab === 'players' && (
              <PlayerList league={league} customFieldsMap={customFieldsMap} tokens={tokens} />
            )}
            {activeTab === 'captains' && <CaptainList league={league} />}
            {activeTab === 'fields' && <FieldSchemaList league={league} />}
            {activeTab === 'settings' && <LeagueSettings league={league} />}
            {activeTab === 'share' && <ShareLinks league={league} tokens={tokens} />}
          </Suspense>
        </div>

        {/* Danger Zone */}
        {league.status === 'not_started' && (
          <Card className="mt-8 border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              {showDeleteConfirm ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Are you sure you want to delete this league? This action cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={deleteLeague.isPending}
                    >
                      {deleteLeague.isPending ? 'Deleting...' : 'Yes, Delete League'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete League
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}

function TabSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
