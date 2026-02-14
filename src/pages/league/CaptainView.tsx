import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { DraftBoard } from '@/components/draft/DraftBoard'
import { Button } from '@/components/ui/Button'
import { TeamSettingsModal } from '@/components/captain/TeamSettingsModal'
import { useDraft, useCaptainByToken } from '@/hooks/useDraft'
import { useLeagueCustomFields } from '@/hooks/useCustomFields'
import { useLeagueFieldSchemas } from '@/hooks/useFieldSchemas'
import { useSecureToken } from '@/hooks/useSecureToken'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

export function CaptainView() {
  const { id } = useParams<{ id: string }>()
  const token = useSecureToken('captain', id)
  const navigate = useNavigate()

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

  const { data: captain, isLoading: captainLoading } = useCaptainByToken(id, token)
  const { data: customFieldsMap } = useLeagueCustomFields(id)
  const { data: fieldSchemas = [] } = useLeagueFieldSchemas(id)
  const [showTeamSettings, setShowTeamSettings] = useState(false)

  // Auto-redirect to summary page when draft completes
  useEffect(() => {
    if (league?.status === 'completed') {
      navigate(`/league/${id}/summary`, { replace: true })
    }
  }, [league?.status, id, navigate])

  if (isLoading || captainLoading) {
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

  // Invalid or missing token
  if (!captain) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-4 sm:py-8">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
            Invalid or missing captain access token
          </div>
        </main>
      </div>
    )
  }

  const isMyTurn = currentCaptain?.id === captain.id
  const canPick = isMyTurn && league.status === 'in_progress'

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-4 sm:py-8">
        <div className="mb-4 sm:mb-6">
          <Breadcrumb items={[{ label: league.name }, { label: `Captain: ${captain.name}` }]} />
          <h1 className="text-3xl font-bold">{league.name}</h1>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Drafting as</span>
            {captain.team_photo_url ? (
              <img
                src={captain.team_photo_url}
                alt=""
                className="h-6 w-6 rounded object-cover flex-shrink-0"
              />
            ) : captain.team_color ? (
              <span
                className="h-4 w-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: captain.team_color }}
              />
            ) : null}
            <span className="font-semibold text-primary">{captain.team_name || captain.name}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTeamSettings(true)}
            className="mt-2"
          >
            <Settings className="mr-1.5 h-4 w-4" />
            Team Settings
          </Button>
        </div>

        <DraftBoard
          league={league}
          currentCaptain={currentCaptain}
          availablePlayers={availablePlayers}
          pickOrder={pickOrder}
          dataUpdatedAt={dataUpdatedAt}
          customFieldsMap={customFieldsMap}
          fieldSchemas={fieldSchemas}
          canPick={canPick}
          isManager={false}
          viewingAsCaptain={captain}
          captainToken={token ?? undefined}
          onStartDraft={startDraft}
          onPauseDraft={pauseDraft}
          onResumeDraft={resumeDraft}
          onRestartDraft={restartDraft}
          onUndoLastPick={undoLastPick}
          onMakePick={makePick}
        />

        {showTeamSettings && (
          <TeamSettingsModal
            captain={captain}
            leagueId={league.id}
            captainToken={token!}
            onClose={() => setShowTeamSettings(false)}
          />
        )}
      </main>
    </div>
  )
}
