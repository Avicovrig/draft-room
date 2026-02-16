import { useEffect } from 'react'
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { DraftBoard } from '@/components/draft/DraftBoard'
import { SpectatorLinkButton } from '@/components/draft/SpectatorLinkButton'
import { useDraft } from '@/hooks/useDraft'
import { useLeagueCustomFields } from '@/hooks/useCustomFields'
import { useLeagueFieldSchemas } from '@/hooks/useFieldSchemas'
import { useLeagueTokens } from '@/hooks/useLeagues'
import { useAuth } from '@/context/AuthContext'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

export function DraftView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    league,
    isLoading,
    error,
    dataUpdatedAt,
    currentCaptain,
    availablePlayers,
    pickOrder,
    startDraft,
    pauseDraft,
    resumeDraft,
    restartDraft,
    undoLastPick,
    makePick,
  } = useDraft(id)

  const { data: customFieldsMap } = useLeagueCustomFields(id)
  const { data: fieldSchemas = [] } = useLeagueFieldSchemas(id)
  const { data: tokens } = useLeagueTokens(id)

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
        <main className="container mx-auto px-4 py-4 sm:py-8">
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
        <main className="container mx-auto px-4 py-4 sm:py-8">
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
      <main className="container mx-auto px-4 py-4 sm:py-8">
        <div className="mb-4 sm:mb-6">
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/dashboard' },
              { label: league.name, href: `/league/${id}/manage` },
              { label: 'Draft' },
            ]}
          />
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{league.name}</h1>
            {tokens?.spectator_token && (
              <SpectatorLinkButton leagueId={league.id} spectatorToken={tokens.spectator_token} />
            )}
          </div>
          <p className="text-muted-foreground">Draft Control Panel</p>
        </div>

        <DraftBoard
          league={league}
          currentCaptain={currentCaptain}
          availablePlayers={availablePlayers}
          pickOrder={pickOrder}
          dataUpdatedAt={dataUpdatedAt}
          customFieldsMap={customFieldsMap}
          fieldSchemas={fieldSchemas}
          canPick={true}
          isManager={true}
          onStartDraft={startDraft}
          onPauseDraft={pauseDraft}
          onResumeDraft={resumeDraft}
          onRestartDraft={restartDraft}
          onUndoLastPick={undoLastPick}
          onMakePick={makePick}
        />
      </main>
    </div>
  )
}
