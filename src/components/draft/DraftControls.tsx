import { useState } from 'react'
import { Play, Pause, RotateCcw, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { LeagueStatus } from '@/lib/types'

interface DraftControlsProps {
  status: LeagueStatus
  canStart: boolean
  captainCount: number
  playerCount: number
  hasPicks: boolean
  onStart: () => Promise<void>
  onPause: () => Promise<void>
  onResume: () => Promise<void>
  onRestart: () => Promise<void>
  onUndo: () => Promise<void>
}

export function DraftControls({
  status,
  canStart,
  captainCount,
  playerCount,
  hasPicks,
  onStart,
  onPause,
  onResume,
  onRestart,
  onUndo,
}: DraftControlsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showRestartConfirm, setShowRestartConfirm] = useState(false)
  const [showUndoConfirm, setShowUndoConfirm] = useState(false)

  async function handleAction(action: () => Promise<void>) {
    setIsLoading(true)
    try {
      await action()
    } finally {
      setIsLoading(false)
    }
  }

  async function handleRestart() {
    setIsLoading(true)
    try {
      await onRestart()
      setShowRestartConfirm(false)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleUndo() {
    setIsLoading(true)
    try {
      await onUndo()
      setShowUndoConfirm(false)
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'completed') {
    return (
      <div className="rounded-lg bg-green-500/10 p-4 text-center text-green-600 dark:text-green-400">
        Draft Complete!
      </div>
    )
  }

  if (status === 'not_started') {
    const reasons: string[] = []
    if (captainCount < 2) reasons.push(`Need at least 2 captains (have ${captainCount})`)
    if (playerCount < captainCount)
      reasons.push(`Need at least ${captainCount} available players (have ${playerCount})`)

    return (
      <div className="space-y-2">
        <Button
          onClick={() => handleAction(onStart)}
          disabled={!canStart}
          loading={isLoading}
          size="lg"
          className="w-full"
        >
          <Play className="mr-2 h-5 w-5" />
          Start Draft
        </Button>
        {!canStart && reasons.length > 0 && (
          <div className="rounded-md bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-400">
            {reasons.map((r, i) => (
              <div key={i}>{r}</div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (status === 'paused') {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-yellow-500/10 p-4 text-center text-yellow-600 dark:text-yellow-400">
          Draft Paused
        </div>

        <div className="flex gap-2">
          <Button onClick={() => handleAction(onResume)} loading={isLoading} className="flex-1">
            <Play className="mr-2 h-4 w-4" />
            Resume Draft
          </Button>

          {showRestartConfirm ? (
            <div className="flex flex-1 gap-2">
              <Button
                variant="destructive"
                onClick={handleRestart}
                loading={isLoading}
                className="flex-1"
              >
                Confirm Restart
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowRestartConfirm(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowRestartConfirm(true)}
              disabled={isLoading}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Restart
            </Button>
          )}
        </div>

        {showRestartConfirm && (
          <p className="text-sm text-muted-foreground">
            This will reset all picks and return to the setup phase.
          </p>
        )}

        {hasPicks && (
          <div className="flex gap-2">
            {showUndoConfirm ? (
              <>
                <Button
                  variant="destructive"
                  onClick={handleUndo}
                  loading={isLoading}
                  className="flex-1"
                >
                  Confirm Undo
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowUndoConfirm(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowUndoConfirm(true)}
                disabled={isLoading}
              >
                <Undo2 className="mr-2 h-4 w-4" />
                Undo Last Pick
              </Button>
            )}
          </div>
        )}
      </div>
    )
  }

  // in_progress
  return (
    <div className="flex gap-2">
      <Button
        onClick={() => handleAction(onPause)}
        loading={isLoading}
        variant="outline"
        size="lg"
        className="flex-1"
      >
        <Pause className="mr-2 h-5 w-5" />
        Pause Draft
      </Button>
      {hasPicks &&
        (showUndoConfirm ? (
          <div className="flex gap-2">
            <Button variant="destructive" size="lg" onClick={handleUndo} loading={isLoading}>
              Confirm Undo
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setShowUndoConfirm(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => setShowUndoConfirm(true)}
            loading={isLoading}
            variant="outline"
            size="lg"
            title="Undo last pick"
          >
            <Undo2 className="mr-2 h-4 w-4" />
            Undo Pick
          </Button>
        ))}
    </div>
  )
}
