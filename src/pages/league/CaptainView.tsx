import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Pencil, Camera } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { DraftBoard } from '@/components/draft/DraftBoard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ImageCropper } from '@/components/ui/ImageCropper'
import { useToast } from '@/components/ui/Toast'
import { useDraft, useCaptainByToken } from '@/hooks/useDraft'
import { useLeagueCustomFields } from '@/hooks/useCustomFields'
import { useLeagueFieldSchemas } from '@/hooks/useFieldSchemas'
import { useUpdateCaptainColorAsCaptain, useUploadTeamPhotoAsCaptain } from '@/hooks/useCaptains'
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

  const { data: captain, isLoading: captainLoading } = useCaptainByToken(id, token)
  const { data: customFieldsMap } = useLeagueCustomFields(id)
  const { data: fieldSchemas = [] } = useLeagueFieldSchemas(id)
  const updateCaptain = useUpdateCaptainColorAsCaptain()
  const uploadTeamPhoto = useUploadTeamPhotoAsCaptain()
  const { addToast } = useToast()
  const [teamName, setTeamName] = useState('')
  const [showTeamPhotoCropper, setShowTeamPhotoCropper] = useState(false)

  // Sync team name from server when captain data loads
  useEffect(() => {
    if (captain) setTeamName(captain.team_name || '')
  }, [captain?.team_name]) // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Breadcrumb items={[
            { label: league.name },
            { label: `Captain: ${captain.name}` },
          ]} />
          <h1 className="text-3xl font-bold">{league.name}</h1>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Drafting as</span>
            {captain.team_photo_url ? (
              <img src={captain.team_photo_url} alt="" className="h-6 w-6 rounded object-cover flex-shrink-0" />
            ) : captain.team_color ? (
              <span
                className="h-4 w-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: captain.team_color }}
              />
            ) : null}
            <span className="font-semibold text-primary">{captain.team_name || captain.name}</span>
          </div>

          {isPreDraft && !showTeamPhotoCropper && (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground" htmlFor="captain-color">
                    Team color
                  </label>
                  <input
                    id="captain-color"
                    type="color"
                    value={captain.team_color || '#3B82F6'}
                    onChange={(e) =>
                      updateCaptain.mutate(
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

                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground" htmlFor="team-name">
                    Team name
                  </label>
                  <Input
                    id="team-name"
                    placeholder="e.g., The Thunderbolts"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    onBlur={() => {
                      const trimmed = teamName.trim() || null
                      if (trimmed !== (captain.team_name || null)) {
                        updateCaptain.mutate(
                          {
                            captainId: captain.id,
                            teamName: trimmed,
                            leagueId: league.id,
                            captainToken: token!,
                          },
                          {
                            onError: (err) => {
                              addToast(
                                err instanceof Error ? err.message : 'Failed to update team name',
                                'error'
                              )
                            },
                          }
                        )
                      }
                    }}
                    maxLength={50}
                    className="w-48"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Team photo</span>
                  {captain.team_photo_url && (
                    <img src={captain.team_photo_url} alt="Team" className="h-8 w-8 rounded object-cover" />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTeamPhotoCropper(true)}
                    className="whitespace-nowrap"
                  >
                    <Camera className="mr-1 h-4 w-4" />
                    {captain.team_photo_url ? 'Change' : 'Upload'}
                  </Button>
                </div>

                {captain.player_id && captain.linked_player_edit_token && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigate(`/player/${captain.player_id}/edit?token=${captain.linked_player_edit_token}`)
                    }
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit My Profile
                  </Button>
                )}
              </div>
            </div>
          )}

          {showTeamPhotoCropper && (
            <div className="mt-3 max-w-md">
              <ImageCropper
                onCropComplete={(blob) => {
                  uploadTeamPhoto.mutate(
                    {
                      captainId: captain.id,
                      leagueId: league.id,
                      blob,
                      captainToken: token!,
                    },
                    {
                      onSuccess: () => addToast('Team photo updated', 'success'),
                      onError: (err) => addToast(err instanceof Error ? err.message : 'Failed to upload photo', 'error'),
                    }
                  )
                  setShowTeamPhotoCropper(false)
                }}
                onCancel={() => setShowTeamPhotoCropper(false)}
                circularCrop={false}
                onFileTooLarge={() => addToast('Image must be under 10MB', 'error')}
              />
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
      </main>
    </div>
  )
}
