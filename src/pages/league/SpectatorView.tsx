import { useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { DraftBoard } from '@/components/draft/DraftBoard'
import { useDraft, useSpectatorAccess } from '@/hooks/useDraft'
import { useLeagueCustomFields } from '@/hooks/useCustomFields'
import { useLeagueFieldSchemas } from '@/hooks/useFieldSchemas'

export function SpectatorView() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()

  const {
    league,
    isLoading,
    error,
    isSubscribed,
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

  const hasAccess = useSpectatorAccess(id, token)
  const { data: customFieldsMap } = useLeagueCustomFields(id)
  const { data: fieldSchemas = [] } = useLeagueFieldSchemas(id)

  // Auto-redirect to summary page when draft completes
  useEffect(() => {
    if (league?.status === 'completed') {
      navigate(`/league/${id}/summary${token ? `?token=${token}` : ''}`, { replace: true })
    }
  }, [league?.status, id, token, navigate])

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

  // Invalid or missing token
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
            Invalid or missing spectator access token
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{league.name}</h1>
          <p className="text-muted-foreground">Spectator View</p>
        </div>

        <DraftBoard
          league={league}
          currentCaptain={currentCaptain}
          availablePlayers={availablePlayers}
          pickOrder={pickOrder}
          isSubscribed={isSubscribed}
          customFieldsMap={customFieldsMap}
          fieldSchemas={fieldSchemas}
          canPick={false}
          isManager={false}
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
