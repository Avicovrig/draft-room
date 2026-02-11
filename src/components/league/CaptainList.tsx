import { useState, useCallback } from 'react'
import {
  Plus,
  Trash2,
  Shuffle,
  ChevronUp,
  ChevronDown,
  Crown,
  Camera,
  GripVertical,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
import type { CaptainPublic, LeagueFullPublic } from '@/lib/types'

const DEFAULT_COLORS = ['#3B82F6', '#EF4444', '#22C55E', '#A855F7']

interface CaptainListProps {
  league: LeagueFullPublic
}

type CaptainMode = 'select' | 'create'

interface SortableCaptainItemProps {
  captain: CaptainPublic
  index: number
  isEditable: boolean
  isFirst: boolean
  isLast: boolean
  isReordering: boolean
  isDeleting: boolean
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  onDelete: (id: string) => void
  onColorChange: (captainId: string, color: string) => void
  onTeamNameBlur: (captainId: string, name: string | null) => void
  onEditPhoto: (captainId: string) => void
}

function SortableCaptainItem({
  captain,
  index,
  isEditable,
  isFirst,
  isLast,
  isReordering,
  isDeleting,
  onMoveUp,
  onMoveDown,
  onDelete,
  onColorChange,
  onTeamNameBlur,
  onEditPhoto,
}: SortableCaptainItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: captain.id,
    disabled: !isEditable,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between rounded-lg border border-border p-3"
    >
      <div className="flex items-center gap-3">
        {isEditable && (
          <button
            type="button"
            className="cursor-grab touch-none p-0.5 text-muted-foreground hover:text-foreground active:cursor-grabbing"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        {isEditable && (
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => onMoveUp(index)}
              disabled={isFirst || isReordering}
              className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
              aria-label="Move up"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onMoveDown(index)}
              disabled={isLast || isReordering}
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
            value={captain.team_color || '#3B82F6'}
            onChange={(e) => onColorChange(captain.id, e.target.value)}
            className="h-8 w-8 cursor-pointer rounded border-0 p-0"
            title="Team color"
          />
        )}
        {!isEditable && captain.team_color && (
          <span
            className="h-4 w-4 flex-shrink-0 rounded-full"
            style={{ backgroundColor: captain.team_color }}
          />
        )}
        {captain.team_photo_url ? (
          <img
            src={captain.team_photo_url}
            alt=""
            className="h-8 w-8 flex-shrink-0 rounded object-cover"
          />
        ) : null}
        {isEditable && (
          <button
            type="button"
            onClick={() => onEditPhoto(captain.id)}
            className="flex-shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title={captain.team_photo_url ? 'Change team photo' : 'Upload team photo'}
          >
            <Camera className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{captain.name}</span>
            {captain.player_id ? (
              <span className="whitespace-nowrap text-xs text-green-600 dark:text-green-400">
                (Player)
              </span>
            ) : captain.is_participant ? (
              <span className="whitespace-nowrap text-xs text-muted-foreground">(Playing)</span>
            ) : (
              <span className="whitespace-nowrap text-xs text-muted-foreground">(Non-player)</span>
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
                  onTeamNameBlur(captain.id, newName)
                }
              }}
              maxLength={50}
              className="mt-0.5 w-full border-b border-transparent bg-transparent text-sm text-muted-foreground outline-none hover:border-border focus:border-primary"
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
          onClick={() => onDelete(captain.id)}
          disabled={isDeleting}
          aria-label="Delete captain"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )}
    </li>
  )
}

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
  const { overlayProps: photoModalOverlayProps } = useModalFocus({
    onClose: closePhotoModal,
    enabled: !!editingTeamPhotoId,
  })

  const isEditable = league.status === 'not_started'
  const sortedCaptains = [...league.captains].sort((a, b) => a.draft_position - b.draft_position)

  // Dynamic captain limits: each captain needs at least one available draft player
  const captainLinkedCount = league.captains.filter((c) => c.player_id).length
  const availableDraftPlayers = league.players.length - captainLinkedCount
  const canAddPlayerCaptain = availableDraftPlayers - league.captains.length >= 2
  const canAddNonPlayerCaptain = availableDraftPlayers - league.captains.length >= 1
  const maxRandomCaptains = Math.floor(league.players.length / 2)

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sortedCaptains.findIndex((c) => c.id === active.id)
    const newIndex = sortedCaptains.findIndex((c) => c.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const newOrder = [...sortedCaptains]
    const [moved] = newOrder.splice(oldIndex, 1)
    newOrder.splice(newIndex, 0, moved)

    try {
      await reorderCaptains.mutateAsync({
        leagueId: league.id,
        captainIds: newOrder.map((c) => c.id),
      })
    } catch {
      // Error handled by mutation
    }
  }

  async function handleMoveUp(index: number) {
    if (index === 0) return
    const newOrder = [...sortedCaptains]
    const temp = newOrder[index]
    newOrder[index] = newOrder[index - 1]
    newOrder[index - 1] = temp
    try {
      await reorderCaptains.mutateAsync({
        leagueId: league.id,
        captainIds: newOrder.map((c) => c.id),
      })
    } catch {
      // Error handled by mutation
    }
  }

  async function handleMoveDown(index: number) {
    if (index === sortedCaptains.length - 1) return
    const newOrder = [...sortedCaptains]
    const temp = newOrder[index]
    newOrder[index] = newOrder[index + 1]
    newOrder[index + 1] = temp
    try {
      await reorderCaptains.mutateAsync({
        leagueId: league.id,
        captainIds: newOrder.map((c) => c.id),
      })
    } catch {
      // Error handled by mutation
    }
  }

  // Get players who are not already captains
  const captainPlayerIds = new Set(league.captains.map((c) => c.player_id).filter(Boolean))
  const availablePlayersForCaptain = league.players.filter((p) => !captainPlayerIds.has(p.id))

  async function handleAddCaptain(e: React.FormEvent) {
    e.preventDefault()

    const nextPosition = league.captains.length + 1

    const defaultColor = DEFAULT_COLORS[(nextPosition - 1) % DEFAULT_COLORS.length]

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
          team_color: defaultColor,
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
          team_color: defaultColor,
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
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    try {
      await reorderCaptains.mutateAsync({
        leagueId: league.id,
        captainIds: shuffled.map((c) => c.id),
      })
    } catch {
      // Error handled by mutation
    }
  }

  async function handleRandomAssign() {
    const count = parseInt(randomCount, 10)
    const playerIds = league.players.map((p) => p.id)

    if (playerIds.length < count * 2) {
      addToast(
        `Not enough players. You need at least ${count * 2} players for ${count} captains.`,
        'error'
      )
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

  function handleColorChange(captainId: string, color: string) {
    updateColor.mutate({ captainId, color, leagueId: league.id })
  }

  function handleTeamNameBlur(captainId: string, name: string | null) {
    updateColor.mutate({ captainId, teamName: name, leagueId: league.id })
  }

  // Generate random assign options: 2 to maxRandomCaptains
  const randomAssignOptions: number[] = []
  for (let i = 2; i <= maxRandomCaptains; i++) {
    randomAssignOptions.push(i)
  }

  return (
    <div className="space-y-6">
      {/* Add Captain */}
      {isEditable && (
        <Card>
          <CardHeader>
            <CardTitle>Add Captains</CardTitle>
            <CardDescription>
              Captains will select players during the draft. You need at least 2 captains, and there
              must be at least one available player per captain.
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
                    disabled={!canAddPlayerCaptain || availablePlayersForCaptain.length === 0}
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
                    disabled={createCaptain.isPending || !selectedPlayerId || !canAddPlayerCaptain}
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
                    disabled={!canAddNonPlayerCaptain}
                  />
                  <Button
                    type="submit"
                    disabled={
                      createCaptain.isPending || !newCaptainName.trim() || !canAddNonPlayerCaptain
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

            {captainMode === 'select' && !canAddPlayerCaptain && league.players.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Not enough players to add another player-captain. Each captain needs at least one
                available player in the draft pool.
              </p>
            )}
            {captainMode === 'create' && !canAddNonPlayerCaptain && (
              <p className="text-sm text-muted-foreground">
                Not enough players to add more captains. Each captain needs at least one available
                player in the draft pool.
              </p>
            )}
            {captainMode === 'select' &&
              availablePlayersForCaptain.length === 0 &&
              canAddPlayerCaptain && (
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  All players are already captains. Add more players or create a non-player captain.
                </p>
              )}
            {league.players.length === 0 && (
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                Add players first before creating captains.
              </p>
            )}

            <div className="border-t border-border pt-4">
              {showRandomAssign ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Number of Captains</Label>
                    {randomAssignOptions.length > 0 ? (
                      <>
                        <Select
                          value={randomCount}
                          onChange={(e) => setRandomCount(e.target.value)}
                        >
                          {randomAssignOptions.map((n) => (
                            <option key={n} value={String(n)}>
                              {n} Captains
                            </option>
                          ))}
                        </Select>
                        <p className="text-sm text-muted-foreground">
                          This will remove existing captains and randomly select from your players.
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-yellow-600 dark:text-yellow-400">
                        Not enough players for random assignment. You need at least 4 players (2
                        captains minimum, each needing one draft player).
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {randomAssignOptions.length > 0 && (
                      <Button onClick={handleRandomAssign} disabled={assignRandom.isPending}>
                        {assignRandom.isPending ? 'Assigning...' : 'Assign Random Captains'}
                      </Button>
                    )}
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
            {isEditable ? 'Drag to reorder captains. ' : 'Captains will pick in this order. '}
            {league.draft_type === 'snake'
              ? 'Order reverses each round.'
              : 'Same order every round.'}
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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortedCaptains.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-2">
                  {sortedCaptains.map((captain, index) => (
                    <SortableCaptainItem
                      key={captain.id}
                      captain={captain}
                      index={index}
                      isEditable={isEditable}
                      isFirst={index === 0}
                      isLast={index === sortedCaptains.length - 1}
                      isReordering={reorderCaptains.isPending}
                      isDeleting={deleteCaptain.isPending}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                      onDelete={handleDeleteCaptain}
                      onColorChange={handleColorChange}
                      onTeamNameBlur={handleTeamNameBlur}
                      onEditPhoto={setEditingTeamPhotoId}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}

          {sortedCaptains.length > 0 && sortedCaptains.length < 2 && (
            <p className="mt-4 text-sm text-yellow-600 dark:text-yellow-400">
              You need at least 2 captains to start the draft.
            </p>
          )}
        </CardContent>
      </Card>

      {editingTeamPhotoId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          {...photoModalOverlayProps}
        >
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
                    onError: (err) =>
                      addToast(
                        err instanceof Error ? err.message : 'Failed to upload photo',
                        'error'
                      ),
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
