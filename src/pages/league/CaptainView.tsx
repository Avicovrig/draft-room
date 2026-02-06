import { useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { DraftBoard } from '@/components/draft/DraftBoard'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useDraft, useCaptainByToken } from '@/hooks/useDraft'
import { useLeagueCustomFields } from '@/hooks/useCustomFields'
import { useUpdateCaptainColorAsCaptain } from '@/hooks/useCaptains'

export function CaptainView() {
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

  const captain = useCaptainByToken(id, token)
  const { data: customFieldsMap } = useLeagueCustomFields(id)
  const updateColor = useUpdateCaptainColorAsCaptain()
  const { addToast } = useToast()

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
  if (!captain) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
            Invalid or missing captain access token
          </div>
        </main>
      </div>
    )
  }

  const isMyTurn = currentCaptain?.id === captain.id
  const canPick = isMyTurn && league.status === 'in_progress'
  const isPreDraft = league.status === 'not_started'
  const captainPlayer = captain.player_id
    ? league.players.find((p) => p.id === captain.player_id)
    : undefined

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{league.name}</h1>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Drafting as</span>
            {captain.team_color && (
              <span
                className="h-4 w-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: captain.team_color }}
              />
            )}
            <span className="font-semibold text-primary">{captain.name}</span>
          </div>

          {isPreDraft && (
            <div className="mt-3 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground" htmlFor="captain-color">
                  Team color
                </label>
                <input
                  id="captain-color"
                  type="color"
                  value={captain.team_color || '#3B82F6'}
                  onChange={(e) =>
                    updateColor.mutate(
                      {
                        captainId: captain.id,
                        color: e.target.value,
                        leagueId: league.id,
                        captainToken: token!,
                      },
                      {
                        onError: (err) => {
                          addToast(
                            err instanceof Error ? err.message : 'Failed to update color',
                            'error'
                          )
                        },
                      }
                    )
                  }
                  className="h-8 w-8 cursor-pointer rounded border-0 p-0"
                />
              </div>

              {captainPlayer && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate(`/player/${captainPlayer.id}/edit?token=${captainPlayer.edit_token}`)
                  }
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit My Profile
                </Button>
              )}
            </div>
          )}
        </div>

        <DraftBoard
          league={league}
          currentCaptain={currentCaptain}
          availablePlayers={availablePlayers}
          pickOrder={pickOrder}
          isSubscribed={isSubscribed}
          customFieldsMap={customFieldsMap}
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
      </main>
    </div>
  )
}
