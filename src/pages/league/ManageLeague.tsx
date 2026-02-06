import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Settings, Users, Crown, Share2, Play, Trash2 } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { useLeague, useDeleteLeague } from '@/hooks/useLeagues'
import { useLeagueCustomFields } from '@/hooks/useCustomFields'
import { LeagueSettings } from '@/components/league/LeagueSettings'
import { PlayerList } from '@/components/league/PlayerList'
import { CaptainList } from '@/components/league/CaptainList'
import { ShareLinks } from '@/components/league/ShareLinks'

type Tab = 'settings' | 'players' | 'captains' | 'share'

export function ManageLeague() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: league, isLoading, error } = useLeague(id)
  const { data: customFieldsMap } = useLeagueCustomFields(id)
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
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  if (error || !league) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="container mx-auto px-4 py-6 sm:p-8">
          <div className="rounded-md bg-destructive/10 p-4 text-destructive">
            League not found or you don't have access.
          </div>
          <Link to="/dashboard" className="mt-4 inline-block text-primary hover:underline">
            Back to Dashboard
          </Link>
        </main>
      </div>
    )
  }

  const canStartDraft = league.status === 'not_started' &&
    league.captains.length >= 2 &&
    league.players.length >= league.captains.length

  const tabs = [
    { id: 'players' as const, label: 'Players', icon: Users, count: league.players.length },
    { id: 'captains' as const, label: 'Captains', icon: Crown, count: league.captains.length },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
    { id: 'share' as const, label: 'Share', icon: Share2 },
  ]

  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-6 sm:p-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/dashboard"
            className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">{league.name}</h1>
              <p className="mt-1 text-muted-foreground">
                {league.draft_type === 'snake' ? 'Snake Draft' : 'Round Robin'} •{' '}
                {league.time_limit_seconds >= 60 && league.time_limit_seconds % 60 === 0 ? `${league.time_limit_seconds / 60}m` : `${league.time_limit_seconds}s`} per pick
              </p>
            </div>
            <div className="flex gap-2">
              {league.status === 'not_started' && (
                <Button
                  onClick={() => navigate(`/league/${id}/draft`)}
                  disabled={!canStartDraft}
                  title={!canStartDraft ? 'Add at least 2 captains and enough players to start' : ''}
                >
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
        </div>

        {/* Tabs */}
        <div className="scrollbar-hide mb-6 flex gap-1 overflow-x-auto border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
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
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'players' && <PlayerList league={league} customFieldsMap={customFieldsMap} />}
        {activeTab === 'captains' && <CaptainList league={league} />}
        {activeTab === 'settings' && <LeagueSettings league={league} />}
        {activeTab === 'share' && <ShareLinks league={league} />}

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
