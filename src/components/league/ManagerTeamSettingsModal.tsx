import { useState, useEffect } from 'react'
import { X, Camera } from 'lucide-react'
import { useModalFocus } from '@/hooks/useModalFocus'
import { useUpdateCaptainColor, useUploadTeamPhoto } from '@/hooks/useCaptains'
import { useToast } from '@/components/ui/Toast'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { ImageCropper } from '@/components/ui/ImageCropper'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { CaptainPublic } from '@/lib/types'

interface ManagerTeamSettingsModalProps {
  captain: CaptainPublic
  leagueId: string
  onClose: () => void
}

export function ManagerTeamSettingsModal({
  captain,
  leagueId,
  onClose,
}: ManagerTeamSettingsModalProps) {
  const { overlayProps } = useModalFocus({ onClose })
  const updateCaptain = useUpdateCaptainColor()
  const uploadTeamPhoto = useUploadTeamPhoto()
  const { addToast } = useToast()
  const [teamName, setTeamName] = useState(captain.team_name || '')
  const [showCropper, setShowCropper] = useState(false)

  useEffect(() => {
    setTeamName(captain.team_name || '') // eslint-disable-line react-hooks/set-state-in-effect
  }, [captain.team_name])

  function handleColorChange(color: string) {
    updateCaptain.mutate(
      { captainId: captain.id, color, leagueId },
      {
        onError: (err) =>
          addToast(err instanceof Error ? err.message : 'Failed to update color', 'error'),
      }
    )
  }

  function handleTeamNameBlur() {
    const trimmed = teamName.trim() || null
    if (trimmed !== (captain.team_name || null)) {
      updateCaptain.mutate(
        { captainId: captain.id, teamName: trimmed, leagueId },
        {
          onError: (err) =>
            addToast(err instanceof Error ? err.message : 'Failed to update team name', 'error'),
        }
      )
    }
  }

  return (
    <div
      {...overlayProps}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col rounded-lg border border-border bg-background shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-lg font-semibold">Team Settings — {captain.name}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close team settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {showCropper ? (
            <ImageCropper
              onCropComplete={(blob) => {
                uploadTeamPhoto.mutate(
                  { captainId: captain.id, leagueId, blob },
                  {
                    onSuccess: () => addToast('Team photo updated', 'success'),
                    onError: (err) =>
                      addToast(
                        err instanceof Error ? err.message : 'Failed to upload photo',
                        'error'
                      ),
                  }
                )
                setShowCropper(false)
              }}
              onCancel={() => setShowCropper(false)}
              circularCrop={false}
              onFileTooLarge={() => addToast('Image must be under 10MB', 'error')}
            />
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Team color</label>
                <ColorPicker value={captain.team_color || '#3B82F6'} onChange={handleColorChange} />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-muted-foreground" htmlFor="mgr-team-name-modal">
                  Team name
                </label>
                <Input
                  id="mgr-team-name-modal"
                  placeholder="e.g., The Thunderbolts"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  onBlur={handleTeamNameBlur}
                  maxLength={50}
                />
              </div>

              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Team photo</span>
                <div className="flex items-center gap-3">
                  {captain.team_photo_url && (
                    <img
                      src={captain.team_photo_url}
                      alt="Team"
                      className="h-12 w-12 rounded object-cover"
                    />
                  )}
                  <Button variant="outline" size="sm" onClick={() => setShowCropper(true)}>
                    <Camera className="mr-1 h-4 w-4" />
                    {captain.team_photo_url ? 'Change' : 'Upload'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
