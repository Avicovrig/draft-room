import { useState } from 'react'
import {
  Plus,
  Trash2,
  FileSpreadsheet,
  Download,
  Pencil,
  Copy,
  ExternalLink,
  Crown,
  Shuffle,
  ChevronUp,
  ChevronDown,
  Settings,
  Check,
  Link as LinkIcon,
} from 'lucide-react'
import { SortableList, SortableItem, DragHandle } from '@/components/ui/SortableList'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { PlayerProfileForm, type ProfileFormData } from '@/components/player/PlayerProfileForm'
import { SpreadsheetImportModal } from '@/components/spreadsheet/SpreadsheetImportModal'
import { ManagerTeamSettingsModal } from '@/components/league/ManagerTeamSettingsModal'
import { useToast } from '@/components/ui/Toast'
import { useModalFocus } from '@/hooks/useModalFocus'
import { useCreatePlayer, useDeletePlayer } from '@/hooks/usePlayers'
import { useUpdatePlayerProfile, useUploadProfilePicture } from '@/hooks/usePlayerProfile'
import { useUpsertCustomFields } from '@/hooks/useCustomFields'
import { useLeagueFieldSchemas } from '@/hooks/useFieldSchemas'
import {
  useCreateCaptain,
  useDeleteCaptain,
  useAssignRandomCaptains,
  useReorderCaptains,
} from '@/hooks/useCaptains'
import { DEFAULT_CAPTAIN_COLORS } from '@/lib/colors'
import { getAvailablePlayers } from '@/lib/draft'
import { exportPlayersToSpreadsheet } from '@/lib/exportPlayers'
import { getInitials } from '@/lib/utils'
import type {
  LeagueFullPublic,
  PlayerPublic,
  PlayerCustomField,
  LeagueTokens,
  CaptainPublic,
  LeagueFieldSchema,
} from '@/lib/types'

interface RosterTabProps {
  league: LeagueFullPublic
  customFieldsMap?: Record<string, PlayerCustomField[]>
  tokens?: LeagueTokens | null
  fieldSchemas?: LeagueFieldSchema[]
}

// ─── Edit Profile Modal ─────────────────────────────────────────────────────

function EditProfileModal({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  const { overlayProps } = useModalFocus({ onClose })

  return (
    <div
      {...overlayProps}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      {children}
    </div>
  )
}

// ─── Sortable Captain Item ──────────────────────────────────────────────────

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
  onTeamSettings: (captain: CaptainPublic) => void
  onCopyLink: (captain: CaptainPublic) => void
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
  onTeamSettings,
  onCopyLink,
}: SortableCaptainItemProps) {
  return (
    <SortableItem
      id={captain.id}
      disabled={!isEditable}
      className="rounded-lg border border-border p-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {isEditable && <DragHandle />}
          {isEditable && (
            <div className="hidden sm:flex flex-col">
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
          {captain.team_color && (
            <span
              className="h-4 w-4 flex-shrink-0 rounded-full"
              style={{ backgroundColor: captain.team_color }}
            />
          )}
          {captain.team_photo_url && (
            <img
              src={captain.team_photo_url}
              alt=""
              loading="lazy"
              className="h-8 w-8 flex-shrink-0 rounded object-cover"
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{captain.name}</span>
              {captain.player_id || captain.is_participant ? (
                <span className="whitespace-nowrap text-xs text-green-600 dark:text-green-400">
                  (Player)
                </span>
              ) : (
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  (Non-player)
                </span>
              )}
            </div>
            {captain.team_name && (
              <span className="text-sm text-muted-foreground">{captain.team_name}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isEditable && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onTeamSettings(captain)}
              title="Team settings"
              aria-label={`Team settings for ${captain.name}`}
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onCopyLink(captain)}
            title="Copy captain link"
            aria-label={`Copy link for ${captain.name}`}
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
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
        </div>
      </div>
    </SortableItem>
  )
}

// ─── RosterTab ──────────────────────────────────────────────────────────────

export function RosterTab({ league, customFieldsMap = {}, tokens, fieldSchemas }: RosterTabProps) {
  // Player state
  const [newPlayerName, setNewPlayerName] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<PlayerPublic | null>(null)

  // Captain state
  const [newCaptainName, setNewCaptainName] = useState('')
  const [randomCount, setRandomCount] = useState('2')
  const [showRandomAssign, setShowRandomAssign] = useState(false)
  const [teamSettingsCaptain, setTeamSettingsCaptain] = useState<CaptainPublic | null>(null)
  const [copiedCaptainId, setCopiedCaptainId] = useState<string | null>(null)

  // Hooks: players
  const { addToast } = useToast()
  const { data: loadedFieldSchemas } = useLeagueFieldSchemas(league.id)
  const schemas = fieldSchemas ?? loadedFieldSchemas
  const createPlayer = useCreatePlayer()
  const deletePlayer = useDeletePlayer()
  const updateProfile = useUpdatePlayerProfile()
  const uploadPicture = useUploadProfilePicture()
  const upsertCustomFields = useUpsertCustomFields()

  // Hooks: captains
  const createCaptain = useCreateCaptain()
  const deleteCaptain = useDeleteCaptain()
  const assignRandom = useAssignRandomCaptains()
  const reorderCaptains = useReorderCaptains()

  const isEditable = league.status === 'not_started'

  // Derived data
  const availablePlayers = getAvailablePlayers(league.players, league.captains)
  const draftedPlayers = league.players.filter((p) => p.drafted_by_captain_id)
  const sortedCaptains = [...league.captains].sort((a, b) => a.draft_position - b.draft_position)

  // Captain limits
  const captainLinkedCount = league.captains.filter((c) => c.player_id).length
  const availableDraftPlayers = league.players.length - captainLinkedCount
  const canAddPlayerCaptain = availableDraftPlayers - league.captains.length >= 2
  const canAddNonPlayerCaptain = availableDraftPlayers - league.captains.length >= 1
  const maxRandomCaptains = Math.floor(league.players.length / 2)

  // ── Player Handlers ─────────────────────────────────────────────────────

  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!newPlayerName.trim()) return
    try {
      await createPlayer.mutateAsync({ league_id: league.id, name: newPlayerName.trim() })
      setNewPlayerName('')
    } catch {
      // Error handled by mutation
    }
  }

  async function handleDeletePlayer(playerId: string) {
    try {
      await deletePlayer.mutateAsync({ id: playerId, leagueId: league.id })
    } catch {
      // Error handled by mutation
    }
  }

  async function handleSaveProfile(data: ProfileFormData) {
    if (!editingPlayer) return
    try {
      let profilePictureUrl = editingPlayer.profile_picture_url
      if (data.profilePictureBlob) {
        const result = await uploadPicture.mutateAsync({
          playerId: editingPlayer.id,
          leagueId: league.id,
          blob: data.profilePictureBlob,
        })
        profilePictureUrl = result.profile_picture_url
      }
      await updateProfile.mutateAsync({
        playerId: editingPlayer.id,
        leagueId: league.id,
        bio: data.bio,
        profile_picture_url: profilePictureUrl,
      })
      await upsertCustomFields.mutateAsync({
        playerId: editingPlayer.id,
        leagueId: league.id,
        fields: data.customFields,
        deletedIds: data.deletedCustomFieldIds,
      })
      addToast('Profile saved successfully!', 'success')
      setEditingPlayer(null)
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to save profile', 'error')
    }
  }

  function getPlayerEditUrl(player: PlayerPublic): string | null {
    const tokenEntry = tokens?.players.find((p) => p.id === player.id)
    if (!tokenEntry) return null
    return `${window.location.origin}/player/${player.id}/edit?token=${tokenEntry.edit_token}`
  }

  async function handleCopyPlayerUrl(player: PlayerPublic) {
    const url = getPlayerEditUrl(player)
    if (!url) {
      addToast('Token not available yet', 'error')
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      addToast(`Copied ${player.name}'s profile link`, 'success')
    } catch {
      addToast('Failed to copy link', 'error')
    }
  }

  function handleOpenPlayerUrl(player: PlayerPublic) {
    const url = getPlayerEditUrl(player)
    if (!url) return
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // ── Captain Handlers ────────────────────────────────────────────────────

  async function handleMakeCaptain(player: PlayerPublic) {
    const nextPosition = league.captains.length + 1
    const defaultColor = DEFAULT_CAPTAIN_COLORS[(nextPosition - 1) % DEFAULT_CAPTAIN_COLORS.length]
    try {
      await createCaptain.mutateAsync({
        league_id: league.id,
        name: player.name,
        is_participant: true,
        draft_position: nextPosition,
        player_id: player.id,
        team_color: defaultColor,
      })
    } catch {
      // Error handled by mutation
    }
  }

  async function handleAddNonPlayerCaptain(e: React.FormEvent) {
    e.preventDefault()
    if (!newCaptainName.trim()) return
    const nextPosition = league.captains.length + 1
    const defaultColor = DEFAULT_CAPTAIN_COLORS[(nextPosition - 1) % DEFAULT_CAPTAIN_COLORS.length]
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

  async function handleDeleteCaptain(captainId: string) {
    try {
      await deleteCaptain.mutateAsync({ id: captainId, leagueId: league.id })
    } catch {
      // Error handled by mutation
    }
  }

  async function handleCopyCaptainLink(captain: CaptainPublic) {
    const tokenEntry = tokens?.captains.find((c) => c.id === captain.id)
    if (!tokenEntry) {
      addToast('Token not available yet', 'error')
      return
    }
    const url = `${window.location.origin}/league/${league.id}/captain?token=${tokenEntry.access_token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedCaptainId(captain.id)
      addToast(`Copied ${captain.name}'s captain link`, 'success')
      setTimeout(() => setCopiedCaptainId(null), 2000)
    } catch {
      addToast('Failed to copy link', 'error')
    }
  }

  // ── Draft Order Handlers ────────────────────────────────────────────────

  async function handleDragReorder(activeId: string, overId: string) {
    const oldIndex = sortedCaptains.findIndex((c) => c.id === activeId)
    const newIndex = sortedCaptains.findIndex((c) => c.id === overId)
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
      await assignRandom.mutateAsync({ leagueId: league.id, playerIds, count })
      setShowRandomAssign(false)
    } catch {
      // Error handled by mutation
    }
  }

  // Random assign options: 2 to maxRandomCaptains
  const randomAssignOptions: number[] = []
  for (let i = 2; i <= maxRandomCaptains; i++) {
    randomAssignOptions.push(i)
  }

  // ── Player Row Renderer ─────────────────────────────────────────────────

  function renderPlayerRow(
    player: PlayerPublic,
    options: {
      showMakeCaptain?: boolean
      showDelete?: boolean
      captainBadge?: CaptainPublic
      draftInfo?: { pickNumber: number | null; captainName?: string }
    }
  ) {
    return (
      <li key={player.id} className="flex items-center gap-3 py-3">
        {player.profile_picture_url ? (
          <img
            src={player.profile_picture_url}
            alt={player.name}
            loading="lazy"
            className="h-10 w-10 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground flex-shrink-0">
            {getInitials(player.name)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{player.name}</span>
            {options.captainBadge && (
              <span className="whitespace-nowrap text-xs text-amber-600 dark:text-amber-400">
                (Captain · #{options.captainBadge.draft_position})
              </span>
            )}
          </div>
          {options.draftInfo && (
            <div className="text-xs text-muted-foreground">
              Pick #{options.draftInfo.pickNumber} · {options.draftInfo.captainName}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {options.showMakeCaptain && isEditable && canAddPlayerCaptain && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleMakeCaptain(player)}
              disabled={createCaptain.isPending}
              title="Make captain"
              aria-label={`Make ${player.name} a captain`}
            >
              <Crown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </Button>
          )}
          {options.captainBadge && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleCopyCaptainLink(options.captainBadge!)}
              title="Copy captain link"
              aria-label={`Copy link for ${player.name}`}
            >
              {copiedCaptainId === options.captainBadge.id ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <LinkIcon className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEditingPlayer(player)}
            title="Edit profile"
            aria-label="Edit profile"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleCopyPlayerUrl(player)}
            title="Copy profile link"
            aria-label="Copy profile link"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleOpenPlayerUrl(player)}
            title="Open profile link in new tab"
            aria-label="Open profile link in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          {options.showDelete && isEditable && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDeletePlayer(player.id)}
              disabled={deletePlayer.isPending}
              title="Delete player"
              aria-label="Delete player"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Add Players ──────────────────────────────────────────────── */}
      {isEditable && (
        <Card>
          <CardHeader>
            <CardTitle>Add Players</CardTitle>
            <CardDescription>
              Add players who will be available for captains to draft.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleAddPlayer} className="flex gap-2">
              <Input
                placeholder="Player name"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={createPlayer.isPending || !newPlayerName.trim()}>
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </form>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setShowImportModal(true)}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Import from Spreadsheet
              </Button>
              {league.players.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() =>
                    exportPlayersToSpreadsheet(
                      league.name,
                      league.players,
                      league.captains,
                      customFieldsMap,
                      schemas
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Spreadsheet
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Add Non-Player Captain ───────────────────────────────────── */}
      {isEditable && (
        <Card>
          <CardHeader>
            <CardTitle>Add Non-Player Captain</CardTitle>
            <CardDescription>
              Non-player captains are team owners who don't play (e.g., coaches, managers).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddNonPlayerCaptain} className="flex gap-2">
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
                Add Captain
              </Button>
            </form>
            {!canAddNonPlayerCaptain && (
              <p className="mt-2 text-sm text-muted-foreground">
                Not enough players to add another captain. Each captain needs at least one player to
                draft.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Spreadsheet Import Modal ─────────────────────────────────── */}
      <SpreadsheetImportModal
        leagueId={league.id}
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => setShowImportModal(false)}
      />

      {/* ── Edit Profile Modal ───────────────────────────────────────── */}
      {editingPlayer && (
        <EditProfileModal onClose={() => setEditingPlayer(null)}>
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">Edit Profile: {editingPlayer.name}</h2>
            <PlayerProfileForm
              player={editingPlayer}
              customFields={customFieldsMap[editingPlayer.id] || []}
              fieldSchemas={schemas}
              allowFreeformFields={league.allow_player_custom_fields}
              onSave={handleSaveProfile}
              onCancel={() => setEditingPlayer(null)}
            />
          </div>
        </EditProfileModal>
      )}

      {/* ── Available Players ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Available Players ({availablePlayers.length})</CardTitle>
          <CardDescription>
            Players available to be drafted.
            {isEditable && ' Click the crown icon to make a player a captain.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {availablePlayers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No players added yet. Add players above to get started.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {availablePlayers.map((player) =>
                renderPlayerRow(player, {
                  showMakeCaptain: true,
                  showDelete: true,
                })
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Drafted Players ──────────────────────────────────────────── */}
      {draftedPlayers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Drafted Players ({draftedPlayers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {draftedPlayers
                .sort((a, b) => (a.draft_pick_number ?? 0) - (b.draft_pick_number ?? 0))
                .map((player) => {
                  const captain = league.captains.find((c) => c.id === player.drafted_by_captain_id)
                  return renderPlayerRow(player, {
                    draftInfo: {
                      pickNumber: player.draft_pick_number,
                      captainName: captain?.name,
                    },
                  })
                })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ── Draft Order ──────────────────────────────────────────────── */}
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
                Randomize Draft Order
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
                No captains added yet. Use the crown button on a player above, or add a non-player
                captain.
              </p>
            </div>
          ) : (
            <SortableList
              items={sortedCaptains.map((c) => c.id)}
              onReorder={handleDragReorder}
              disabled={!isEditable}
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
                    onTeamSettings={setTeamSettingsCaptain}
                    onCopyLink={handleCopyCaptainLink}
                  />
                ))}
              </ul>
            </SortableList>
          )}

          {sortedCaptains.length > 0 && sortedCaptains.length < 2 && (
            <p className="mt-4 text-sm text-yellow-600 dark:text-yellow-400">
              You need at least 2 captains to start the draft.
            </p>
          )}

          {/* Random Captain Assignment */}
          {isEditable && (
            <div className="mt-4 border-t border-border pt-4">
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
          )}
        </CardContent>
      </Card>

      {/* ── Team Settings Modal ──────────────────────────────────────── */}
      {teamSettingsCaptain && (
        <ManagerTeamSettingsModal
          captain={teamSettingsCaptain}
          leagueId={league.id}
          onClose={() => setTeamSettingsCaptain(null)}
        />
      )}
    </div>
  )
}
