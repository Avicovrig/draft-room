import { useState } from 'react'
import { Plus, Trash2, FileSpreadsheet, Download, Pencil, Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { PlayerProfileForm, type ProfileFormData } from '@/components/player/PlayerProfileForm'
import { SpreadsheetImportModal } from '@/components/spreadsheet/SpreadsheetImportModal'
import { useCreatePlayer, useDeletePlayer } from '@/hooks/usePlayers'
import { useUpdatePlayerProfile, useUploadProfilePicture } from '@/hooks/usePlayerProfile'
import { useUpsertCustomFields } from '@/hooks/useCustomFields'
import { useLeagueFieldSchemas } from '@/hooks/useFieldSchemas'
import { useToast } from '@/components/ui/Toast'
import { useModalFocus } from '@/hooks/useModalFocus'
import { getAvailablePlayers } from '@/lib/draft'
import { exportPlayersToSpreadsheet } from '@/lib/exportPlayers'
import type { LeagueFullPublic, PlayerPublic, PlayerCustomField, LeagueTokens } from '@/lib/types'
import { getInitials } from '@/lib/utils'

interface PlayerListProps {
  league: LeagueFullPublic
  customFieldsMap?: Record<string, PlayerCustomField[]>
  tokens?: LeagueTokens | null
}

function EditProfileModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
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

export function PlayerList({ league, customFieldsMap = {}, tokens }: PlayerListProps) {
  const [newPlayerName, setNewPlayerName] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<PlayerPublic | null>(null)

  const { addToast } = useToast()
  const { data: fieldSchemas } = useLeagueFieldSchemas(league.id)
  const createPlayer = useCreatePlayer()
  const deletePlayer = useDeletePlayer()
  const updateProfile = useUpdatePlayerProfile()
  const uploadPicture = useUploadProfilePicture()
  const upsertCustomFields = useUpsertCustomFields()

  const isEditable = league.status === 'not_started'

  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!newPlayerName.trim()) return

    try {
      await createPlayer.mutateAsync({
        league_id: league.id,
        name: newPlayerName.trim(),
      })
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
      // Upload profile picture if provided
      let profilePictureUrl = editingPlayer.profile_picture_url
      if (data.profilePictureBlob) {
        const result = await uploadPicture.mutateAsync({
          playerId: editingPlayer.id,
          leagueId: league.id,
          blob: data.profilePictureBlob,
        })
        profilePictureUrl = result.profile_picture_url
      }

      // Update profile
      await updateProfile.mutateAsync({
        playerId: editingPlayer.id,
        leagueId: league.id,
        bio: data.bio,
        profile_picture_url: profilePictureUrl,
      })

      // Update custom fields
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

  const captainPlayerIds = new Set(
    league.captains.filter((c) => c.player_id).map((c) => c.player_id)
  )
  const availablePlayers = getAvailablePlayers(league.players, league.captains)
  const captainPlayers = league.players.filter(
    (p) => !p.drafted_by_captain_id && captainPlayerIds.has(p.id)
  )
  const draftedPlayers = league.players.filter((p) => p.drafted_by_captain_id)

  return (
    <div className="space-y-6">
      {/* Add Players */}
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
                  onClick={() => exportPlayersToSpreadsheet(league.name, league.players, league.captains, customFieldsMap, fieldSchemas)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Spreadsheet
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Spreadsheet Import Modal */}
      <SpreadsheetImportModal
        leagueId={league.id}
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => setShowImportModal(false)}
      />

      {/* Edit Profile Modal */}
      {editingPlayer && (
        <EditProfileModal onClose={() => setEditingPlayer(null)}>
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-background p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">Edit Profile: {editingPlayer.name}</h2>
            <PlayerProfileForm
              player={editingPlayer}
              customFields={customFieldsMap[editingPlayer.id] || []}
              fieldSchemas={fieldSchemas}
              allowFreeformFields={league.allow_player_custom_fields}
              onSave={handleSaveProfile}
              onCancel={() => setEditingPlayer(null)}
            />
          </div>
        </EditProfileModal>
      )}

      {/* Player List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Available Players ({availablePlayers.length})
          </CardTitle>
          <CardDescription>
            Players available to be drafted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {availablePlayers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No players added yet. Add players above to get started.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {availablePlayers.map((player) => (
                <li key={player.id} className="flex items-center gap-3 py-3">
                  {/* Profile Picture */}
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

                  {/* Player Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{player.name}</div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
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
                    {isEditable && (
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
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Captain Players (linked to captains, not in draft pool) */}
      {captainPlayers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Captain Players ({captainPlayers.length})</CardTitle>
            <CardDescription>
              These players are captains and won't appear in the draft pool.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {captainPlayers.map((player) => {
                const captain = league.captains.find((c) => c.player_id === player.id)
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
                      <div className="font-medium truncate">{player.name}</div>
                      {captain && (
                        <div className="text-xs text-muted-foreground">
                          Captain · Draft position {captain.draft_position}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
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
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Drafted Players */}
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
                  const captain = league.captains.find(
                    (c) => c.id === player.drafted_by_captain_id
                  )
                  return (
                    <li key={player.id} className="flex items-center justify-between py-2">
                      <span>{player.name}</span>
                      <span className="text-sm text-muted-foreground">
                        Pick #{player.draft_pick_number} • {captain?.name}
                      </span>
                    </li>
                  )
                })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
