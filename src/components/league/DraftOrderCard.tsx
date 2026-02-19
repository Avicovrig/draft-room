import { useState } from 'react'
import { Crown, Shuffle } from 'lucide-react'
import { SortableList } from '@/components/ui/SortableList'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'
import { SortableCaptainItem } from './SortableCaptainItem'
import { useToast } from '@/components/ui/Toast'
import { useDeleteCaptain, useAssignRandomCaptains, useReorderCaptains } from '@/hooks/useCaptains'
import { shuffleArray } from '@/lib/utils'
import type { LeagueFullPublic, CaptainPublic } from '@/lib/types'

interface DraftOrderCardProps {
  league: LeagueFullPublic
  onTeamSettings: (captain: CaptainPublic) => void
  onCopyCaptainLink: (captain: CaptainPublic) => void
  onEditPlayer?: (captain: CaptainPublic) => void
}

export function DraftOrderCard({
  league,
  onTeamSettings,
  onCopyCaptainLink,
  onEditPlayer,
}: DraftOrderCardProps) {
  const [showRandomAssign, setShowRandomAssign] = useState(false)
  const [randomCount, setRandomCount] = useState('2')

  const { addToast } = useToast()
  const deleteCaptain = useDeleteCaptain()
  const assignRandom = useAssignRandomCaptains()
  const reorderCaptains = useReorderCaptains()

  const isEditable = league.status === 'not_started'
  const sortedCaptains = [...league.captains].sort((a, b) => a.draft_position - b.draft_position)
  const captainLinkedCount = league.captains.filter((c) => c.player_id).length
  const availableDraftPlayers = league.players.length - captainLinkedCount
  const maxRandomCaptains = Math.floor(league.players.length / 2)

  // Random assign options: 2 to maxRandomCaptains
  const randomAssignOptions: number[] = []
  for (let i = 2; i <= maxRandomCaptains; i++) {
    randomAssignOptions.push(i)
  }

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
    const shuffled = shuffleArray(sortedCaptains)
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

  async function handleDeleteCaptain(captainId: string) {
    try {
      await deleteCaptain.mutateAsync({ id: captainId, leagueId: league.id })
    } catch {
      // Error handled by mutation
    }
  }

  return (
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
          {league.draft_type === 'snake' ? 'Order reverses each round.' : 'Same order every round.'}
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
                  onTeamSettings={onTeamSettings}
                  onCopyLink={onCopyCaptainLink}
                  onEditPlayer={onEditPlayer}
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
                      <Select value={randomCount} onChange={(e) => setRandomCount(e.target.value)}>
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
              <Button
                variant="outline"
                onClick={() => setShowRandomAssign(true)}
                disabled={availableDraftPlayers - league.captains.length < 1}
              >
                <Shuffle className="mr-2 h-4 w-4" />
                Randomly Assign Captains
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
