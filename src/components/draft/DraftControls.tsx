import { useState } from 'react'
import { Play, Pause, RotateCcw, Undo2, Check } from 'lucide-react'
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
  compact?: boolean
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
  compact = false,
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

  // --- Compact mode ---
  if (compact) {
    if (status === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-600 dark:text-green-400">
          <Check className="h-3.5 w-3.5" />
          Complete
        </span>
      )
    }

    if (status === 'not_started') {
      return (
        <Button
          onClick={() => handleAction(onStart)}
          disabled={!canStart}
          loading={isLoading}
          size="sm"
        >
          <Play className="mr-1.5 h-3.5 w-3.5" />
          Start Draft
        </Button>
      )
    }

    if (status === 'paused') {
      return (
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
            Paused
          </span>
          <Button
            onClick={() => handleAction(onResume)}
            loading={isLoading}
            size="sm"
            title="Resume Draft"
            aria-label="Resume Draft"
          >
            <Play className="h-3.5 w-3.5" />
          </Button>
          {showUndoConfirm ? (
            <>
              <Button variant="destructive" onClick={handleUndo} loading={isLoading} size="sm">
                Confirm Undo
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowUndoConfirm(false)}
                disabled={isLoading}
                size="sm"
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowUndoConfirm(true)}
              disabled={isLoading || !hasPicks}
              size="sm"
              title="Undo Pick"
              aria-label="Undo Pick"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {showRestartConfirm ? (
            <>
              <Button variant="destructive" onClick={handleRestart} loading={isLoading} size="sm">
                Confirm Restart
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowRestartConfirm(false)}
                disabled={isLoading}
                size="sm"
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowRestartConfirm(true)}
              disabled={isLoading}
              size="sm"
              title="Restart"
              aria-label="Restart"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )
    }

    // in_progress (compact)
    return (
      <div className="flex items-center gap-1.5">
        <Button
          onClick={() => handleAction(onPause)}
          loading={isLoading}
          variant="outline"
          size="sm"
          title="Pause Draft"
          aria-label="Pause Draft"
        >
          <Pause className="h-3.5 w-3.5" />
        </Button>
        {showUndoConfirm ? (
          <>
            <Button variant="destructive" onClick={handleUndo} loading={isLoading} size="sm">
              Confirm Undo
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowUndoConfirm(false)}
              disabled={isLoading}
              size="sm"
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            onClick={() => setShowUndoConfirm(true)}
            disabled={isLoading || !hasPicks}
            size="sm"
            title="Undo Pick"
            aria-label="Undo Pick"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    )
  }

  // --- Full mode ---
  if (status === 'completed') {
    return (
      <div className="rounded-lg bg-green-500/10 p-3 sm:p-4 text-center text-green-600 dark:text-green-400">
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
      <div className="space-y-3 sm:space-y-4">
        <div className="rounded-lg bg-yellow-500/10 p-3 sm:p-4 text-center text-yellow-600 dark:text-yellow-400">
          Draft Paused
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
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
              disabled={isLoading || !hasPicks}
            >
              <Undo2 className="mr-2 h-4 w-4" />
              Undo Last Pick
            </Button>
          )}
        </div>
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
        className="flex-1"
      >
        <Pause className="mr-2 h-4 w-4" />
        Pause Draft
      </Button>
      {showUndoConfirm ? (
        <div className="flex gap-2">
          <Button variant="destructive" onClick={handleUndo} loading={isLoading}>
            Confirm Undo
          </Button>
          <Button variant="outline" onClick={() => setShowUndoConfirm(false)} disabled={isLoading}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          onClick={() => setShowUndoConfirm(true)}
          disabled={isLoading || !hasPicks}
          variant="outline"
          title="Undo last pick"
        >
          <Undo2 className="mr-2 h-4 w-4" />
          Undo Pick
        </Button>
      )}
    </div>
  )
}
