import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Copy } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { useModalFocus } from '@/hooks/useModalFocus'
import { useCopyLeague } from '@/hooks/useLeagues'
import type { LeaguePublic } from '@/lib/types'

interface CopyLeagueModalProps {
  league: LeaguePublic
  isOpen: boolean
  onClose: () => void
}

export function CopyLeagueModal({ league, isOpen, onClose }: CopyLeagueModalProps) {
  const [name, setName] = useState(`Copy of ${league.name}`)
  const { addToast } = useToast()
  const navigate = useNavigate()
  const copyLeague = useCopyLeague()

  const { overlayProps } = useModalFocus({ onClose, enabled: isOpen })

  if (!isOpen) return null

  async function handleCopy() {
    const trimmed = name.trim()
    if (!trimmed) return

    try {
      const result = await copyLeague.mutateAsync({
        sourceLeagueId: league.id,
        newLeagueName: trimmed,
      })
      addToast(
        `League copied with ${result.counts.captains} captains and ${result.counts.players} players`,
        'success'
      )
      onClose()
      navigate(`/league/${result.leagueId}/manage`)
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to copy league', 'error')
    }
  }

  return (
    <div
      {...overlayProps}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Copy League</CardTitle>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <label htmlFor="copy-league-name" className="mb-1.5 block text-sm font-medium">
              League Name
            </label>
            <input
              id="copy-league-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) handleCopy()
              }}
            />
          </div>

          <p className="text-sm text-muted-foreground">
            Creates a duplicate league with all captains, players, and field schemas. The new league
            starts in Not Started status with fresh tokens.
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleCopy} disabled={!name.trim()} loading={copyLeague.isPending}>
              <Copy className="mr-2 h-4 w-4" />
              Copy League
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
