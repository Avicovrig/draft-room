import { useState, Suspense } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Settings, Users, Play, Trash2, Copy } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { ManageLeagueSkeleton, Skeleton } from '@/components/ui/Skeleton'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { useLeague, useDeleteLeague, useLeagueTokens } from '@/hooks/useLeagues'
import { useLeagueCustomFields } from '@/hooks/useCustomFields'
import { useLeagueFieldSchemas } from '@/hooks/useFieldSchemas'
import { DraftReadinessChecklist } from '@/components/league/DraftReadinessChecklist'
import { CopyLeagueModal } from '@/components/league/CopyLeagueModal'
import { FieldSchemaModal } from '@/components/league/FieldSchemaModal'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { getAvailablePlayers } from '@/lib/draft'
import { lazyWithRetry } from '@/lib/lazyWithRetry'

const RosterTab = lazyWithRetry(
  () => import('@/components/league/RosterTab').then((m) => ({ default: m.RosterTab })),
  'RosterTab'
)
const LeagueSettings = lazyWithRetry(
  () => import('@/components/league/LeagueSettings').then((m) => ({ default: m.LeagueSettings })),
  'LeagueSettings'
)

type Tab = 'roster' | 'settings'

export function ManageLeague() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: league, isLoading, error } = useLeague(id)
  const { data: customFieldsMap } = useLeagueCustomFields(id)
  const { data: fieldSchemas = [] } = useLeagueFieldSchemas(id)
  const { data: tokens } = useLeagueTokens(id)
  const deleteLeague = useDeleteLeague()
  const [activeTab, setActiveTab] = useState<Tab>('roster')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [showFieldsModal, setShowFieldsModal] = useState(false)

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
    { id: 'roster' as const, label: 'Roster', icon: Users, count: league.players.length },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
            {activeTab === 'roster' && (
              <RosterTab
                league={league}
                customFieldsMap={customFieldsMap}
                tokens={tokens}
                fieldSchemas={fieldSchemas}
              />
            )}
            {activeTab === 'settings' && (
              <>
                <LeagueSettings
                  league={league}
                  onOpenFieldSchemas={() => setShowFieldsModal(true)}
                  fieldSchemaCount={fieldSchemas.length}
                />
                <Card className="mt-8">
                  <CardHeader>
                    <CardTitle>Copy League</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Create a duplicate of this league with all captains, players, and field
                      schemas. The new league starts in Not Started status.
                    </p>
                    <Button variant="outline" onClick={() => setShowCopyModal(true)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy League
                    </Button>
                  </CardContent>
                </Card>
                <CopyLeagueModal
                  league={league}
                  isOpen={showCopyModal}
                  onClose={() => setShowCopyModal(false)}
                />
                {league.status === 'not_started' && (
                  <Card className="mt-8 border-destructive/50">
                    <CardHeader>
                      <CardTitle className="text-destructive">Danger Zone</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {showDeleteConfirm ? (
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            Are you sure you want to delete this league? This action cannot be
                            undone.
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
              </>
            )}
          </Suspense>
        </div>

        {/* Field Schema Modal (outside tabs) */}
        <FieldSchemaModal
          league={league}
          isOpen={showFieldsModal}
          onClose={() => setShowFieldsModal(false)}
        />
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
