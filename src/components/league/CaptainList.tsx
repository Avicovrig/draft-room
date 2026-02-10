import { useState, useCallback } from 'react'
import { Plus, Trash2, Shuffle, ChevronUp, ChevronDown, Crown, Camera } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { ImageCropper } from '@/components/ui/ImageCropper'
import { useToast } from '@/components/ui/Toast'
import { useModalFocus } from '@/hooks/useModalFocus'
import {
  useCreateCaptain,
  useDeleteCaptain,
  useAssignRandomCaptains,
  useReorderCaptains,
  useUpdateCaptainColor,
  useUploadTeamPhoto,
} from '@/hooks/useCaptains'
import type { LeagueFullPublic } from '@/lib/types'

interface CaptainListProps {
  league: LeagueFullPublic
}

type CaptainMode = 'select' | 'create'

export function CaptainList({ league }: CaptainListProps) {
  const [captainMode, setCaptainMode] = useState<CaptainMode>('select')
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [newCaptainName, setNewCaptainName] = useState('')
  const [randomCount, setRandomCount] = useState('2')
  const [showRandomAssign, setShowRandomAssign] = useState(false)

  const [editingTeamPhotoId, setEditingTeamPhotoId] = useState<string | null>(null)

  const createCaptain = useCreateCaptain()
  const deleteCaptain = useDeleteCaptain()
  const assignRandom = useAssignRandomCaptains()
  const reorderCaptains = useReorderCaptains()
  const updateColor = useUpdateCaptainColor()
  const uploadTeamPhoto = useUploadTeamPhoto()
  const { addToast } = useToast()
  const closePhotoModal = useCallback(() => setEditingTeamPhotoId(null), [])
  const { overlayProps: photoModalOverlayProps } = useModalFocus({ onClose: closePhotoModal, enabled: !!editingTeamPhotoId })

  const defaultColors = ['#3B82F6', '#EF4444', '#22C55E', '#A855F7']

  const isEditable = league.status === 'not_started'
  const sortedCaptains = [...league.captains].sort((a, b) => a.draft_position - b.draft_position)

  async function handleMoveUp(index: number) {
    if (index === 0) return
    const newOrder = [...sortedCaptains]
    const temp = newOrder[index]
    newOrder[index] = newOrder[index - 1]
    newOrder[index - 1] = temp
    await reorderCaptains.mutateAsync({
      leagueId: league.id,
      captainIds: newOrder.map((c) => c.id),
    })
  }

  async function handleMoveDown(index: number) {
    if (index === sortedCaptains.length - 1) return
    const newOrder = [...sortedCaptains]
    const temp = newOrder[index]
    newOrder[index] = newOrder[index + 1]
    newOrder[index + 1] = temp
    await reorderCaptains.mutateAsync({
      leagueId: league.id,
      captainIds: newOrder.map((c) => c.id),
    })
  }

  // Get players who are not already captains
  const captainPlayerIds = new Set(league.captains.map((c) => c.player_id).filter(Boolean))
  const availablePlayersForCaptain = league.players.filter((p) => !captainPlayerIds.has(p.id))

  async function handleAddCaptain(e: React.FormEvent) {
    e.preventDefault()

    const nextPosition = league.captains.length + 1

    if (captainMode === 'select') {
      if (!selectedPlayerId) return
      const player = league.players.find((p) => p.id === selectedPlayerId)
      if (!player) return

      try {
        await createCaptain.mutateAsync({
          league_id: league.id,
          name: player.name,
          is_participant: true,
          draft_position: nextPosition,
          player_id: selectedPlayerId,
        })
        setSelectedPlayerId('')
      } catch {
        // Error handled by mutation
      }
    } else {
      if (!newCaptainName.trim()) return

      try {
        await createCaptain.mutateAsync({
          league_id: league.id,
          name: newCaptainName.trim(),
          is_participant: false,
          draft_position: nextPosition,
          player_id: null,
        })
        setNewCaptainName('')
      } catch {
        // Error handled by mutation
      }
    }
  }

  async function handleDeleteCaptain(captainId: string) {
    try {
      await deleteCaptain.mutateAsync({ id: captainId, leagueId: league.id })
    } catch {
      // Error handled by mutation
    }
  }

  async function handleRandomizeOrder() {
    if (sortedCaptains.length < 2) return
    const shuffled = [...sortedCaptains]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)) // eslint-disable-line react-hooks/purity
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    await reorderCaptains.mutateAsync({
      leagueId: league.id,
      captainIds: shuffled.map((c) => c.id),
    })
  }

  async function handleRandomAssign() {
    const count = parseInt(randomCount, 10)
    const playerIds = league.players.map((p) => p.id)

    if (playerIds.length < count) {
      alert(`Not enough players. You need at least ${count} players.`)
      return
    }

    try {
      await assignRandom.mutateAsync({
        leagueId: league.id,
        playerIds,
        count,
      })
      setShowRandomAssign(false)
    } catch {
      // Error handled by mutation
    }
  }

  return (
    <div className="space-y-6">
      {/* Add Captain */}
      {isEditable && (
        <Card>
          <CardHeader>
            <CardTitle>Add Captains</CardTitle>
            <CardDescription>
              Captains will select players during the draft. You need 2-4 captains.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mode Toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCaptainMode('select')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  captainMode === 'select'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted'
                }`}
              >
                Select from Players
              </button>
              <button
                type="button"
                onClick={() => setCaptainMode('create')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  captainMode === 'create'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-muted'
                }`}
              >
                Create Non-Player Captain
              </button>
            </div>

            <form onSubmit={handleAddCaptain} className="space-y-4">
              {captainMode === 'select' ? (
                <div className="flex gap-2">
                  <Select
                    value={selectedPlayerId}
                    onChange={(e) => setSelectedPlayerId(e.target.value)}
                    className="flex-1"
                    disabled={league.captains.length >= 4 || availablePlayersForCaptain.length === 0}
                  >
                    <option value="">Select a player...</option>
                    {availablePlayersForCaptain.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="submit"
                    disabled={
                      createCaptain.isPending ||
                      !selectedPlayerId ||
                      league.captains.length >= 4
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Captain name"
                    value={newCaptainName}
                    onChange={(e) => setNewCaptainName(e.target.value)}
                    className="flex-1"
                    disabled={league.captains.length >= 4}
                  />
                  <Button
                    type="submit"
                    disabled={
                      createCaptain.isPending ||
                      !newCaptainName.trim() ||
                      league.captains.length >= 4
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add
                  </Button>
                </div>
              )}

              {captainMode === 'select' && (
                <p className="text-sm text-muted-foreground">
                  Player-captains will be on their own team and won't appear in the draft pool.
                </p>
              )}
              {captainMode === 'create' && (
                <p className="text-sm text-muted-foreground">
                  Non-player captains are team owners who don't play (e.g., coaches, managers).
                </p>
              )}
            </form>

            {league.captains.length >= 4 && (
              <p className="text-sm text-muted-foreground">
                Maximum of 4 captains reached.
              </p>
            )}
            {captainMode === 'select' && availablePlayersForCaptain.length === 0 && league.captains.length < 4 && (
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                All players are already captains. Add more players or create a non-player captain.
              </p>
            )}

            <div className="border-t border-border pt-4">
              {showRandomAssign ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Number of Captains</Label>
                    <Select
                      value={randomCount}
                      onChange={(e) => setRandomCount(e.target.value)}
                    >
                      <option value="2">2 Captains</option>
                      <option value="3">3 Captains</option>
                      <option value="4">4 Captains</option>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      This will remove existing captains and randomly select from your players.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleRandomAssign}
                      disabled={assignRandom.isPending || league.players.length < parseInt(randomCount)}
                    >
                      {assignRandom.isPending ? 'Assigning...' : 'Assign Random Captains'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowRandomAssign(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setShowRandomAssign(true)}>
                  <Shuffle className="mr-2 h-4 w-4" />
                  Randomly Assign Captains
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Captain List / Draft Order */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Draft Order ({sortedCaptains.length} Captains)</CardTitle>
            {isEditable && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRandomizeOrder}
                disabled={sortedCaptains.length < 2 || reorderCaptains.isPending}
              >
                <Shuffle className="mr-2 h-4 w-4" />
                Randomize
              </Button>
            )}
          </div>
          <CardDescription>
            Captains will pick in this order. {league.draft_type === 'snake' ? 'Order reverses each round.' : 'Same order every round.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedCaptains.length === 0 ? (
            <div className="py-6 text-center">
              <Crown className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No captains added yet. Add from players above or use random assignment.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {sortedCaptains.map((captain, index) => (
                <li
                  key={captain.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    {isEditable && (
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0 || reorderCaptains.isPending}
                          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          aria-label="Move up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === sortedCaptains.length - 1 || reorderCaptains.isPending}
                          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          aria-label="Move down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                      {index + 1}
                    </span>
                    {isEditable && (
                      <input
                        type="color"
                        value={captain.team_color || defaultColors[index % defaultColors.length]}
                        onChange={(e) =>
                          updateColor.mutate({
                            captainId: captain.id,
                            color: e.target.value,
                            leagueId: league.id,
                          })
                        }
                        className="h-8 w-8 cursor-pointer rounded border-0 p-0"
                        title="Team color"
                      />
                    )}
                    {!isEditable && captain.team_color && (
                      <span
                        className="h-4 w-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: captain.team_color }}
                      />
                    )}
                    {captain.team_photo_url ? (
                      <img src={captain.team_photo_url} alt="" className="h-8 w-8 rounded object-cover flex-shrink-0" />
                    ) : null}
                    {isEditable && (
                      <button
                        type="button"
                        onClick={() => setEditingTeamPhotoId(captain.id)}
                        className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
                        title={captain.team_photo_url ? 'Change team photo' : 'Upload team photo'}
                      >
                        <Camera className="h-4 w-4" />
                      </button>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{captain.name}</span>
                        {captain.player_id ? (
                          <span className="text-xs text-green-600 dark:text-green-400 whitespace-nowrap">
                            (Player)
                          </span>
                        ) : captain.is_participant ? (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            (Playing)
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            (Non-player)
                          </span>
                        )}
                      </div>
                      {isEditable ? (
                        <input
                          type="text"
                          placeholder="Team name (optional)"
                          defaultValue={captain.team_name || ''}
                          onBlur={(e) => {
                            const newName = e.target.value.trim() || null
                            if (newName !== (captain.team_name || null)) {
                              updateColor.mutate({
                                captainId: captain.id,
                                teamName: newName,
                                leagueId: league.id,
                              })
                            }
                          }}
                          maxLength={50}
                          className="mt-0.5 w-full bg-transparent text-sm text-muted-foreground border-b border-transparent hover:border-border focus:border-primary outline-none"
                        />
                      ) : captain.team_name ? (
                        <span className="text-sm text-muted-foreground">{captain.team_name}</span>
                      ) : null}
                    </div>
                  </div>
                  {isEditable && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteCaptain(captain.id)}
                      disabled={deleteCaptain.isPending}
                      aria-label="Delete captain"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {sortedCaptains.length > 0 && sortedCaptains.length < 2 && (
            <p className="mt-4 text-sm text-yellow-600 dark:text-yellow-400">
              You need at least 2 captains to start the draft.
            </p>
          )}
        </CardContent>
      </Card>

      {editingTeamPhotoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" {...photoModalOverlayProps}>
          <div className="mx-4 w-full max-w-md rounded-lg bg-background p-4">
            <ImageCropper
              onCropComplete={(blob) => {
                uploadTeamPhoto.mutate(
                  {
                    captainId: editingTeamPhotoId,
                    leagueId: league.id,
                    blob,
                  },
                  {
                    onSuccess: () => addToast('Team photo updated', 'success'),
                    onError: (err) => addToast(err instanceof Error ? err.message : 'Failed to upload photo', 'error'),
                  }
                )
                setEditingTeamPhotoId(null)
              }}
              onCancel={() => setEditingTeamPhotoId(null)}
              circularCrop={false}
              onFileTooLarge={() => addToast('Image must be under 10MB', 'error')}
            />
          </div>
        </div>
      )}
    </div>
  )
}
