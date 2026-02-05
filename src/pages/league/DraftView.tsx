import { useEffect } from 'react'
import { useParams, Navigate, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { DraftBoard } from '@/components/draft/DraftBoard'
import { useDraft } from '@/hooks/useDraft'
import { useLeagueCustomFields } from '@/hooks/useCustomFields'
import { useAuth } from '@/context/AuthContext'

export function DraftView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    league,
    isLoading,
    error,
    currentCaptain,
    availablePlayers,
    startDraft,
    pauseDraft,
    resumeDraft,
    restartDraft,
    makePick,
  } = useDraft(id)

  const { data: customFieldsMap } = useLeagueCustomFields(id)

  // Auto-redirect to summary page when draft completes
  useEffect(() => {
    if (league?.status === 'completed') {
      navigate(`/league/${id}/summary`, { replace: true })
    }
  }, [league?.status, id, navigate])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading draft...</div>
          </div>
        </main>
      </div>
    )
  }

  if (error || !league) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
            {error?.message || 'League not found'}
          </div>
        </main>
      </div>
    )
  }

  // Verify user is the manager
  if (league.manager_id !== user?.id) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          {league.status === 'not_started' && (
            <Link
              to={`/league/${id}/manage`}
              className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to League Settings
            </Link>
          )}
          <h1 className="text-3xl font-bold">{league.name}</h1>
          <p className="text-muted-foreground">Draft Control Panel</p>
        </div>

        <DraftBoard
          league={league}
          currentCaptain={currentCaptain}
          availablePlayers={availablePlayers}
          customFieldsMap={customFieldsMap}
          canPick={true}
          isManager={true}
          onStartDraft={startDraft}
          onPauseDraft={pauseDraft}
          onResumeDraft={resumeDraft}
          onRestartDraft={restartDraft}
          onMakePick={makePick}
        />
      </main>
    </div>
  )
}
