import { useState } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { LeagueStatus } from '@/lib/types'

interface DraftControlsProps {
  status: LeagueStatus
  canStart: boolean
  onStart: () => Promise<void>
  onPause: () => Promise<void>
  onResume: () => Promise<void>
  onRestart: () => Promise<void>
}

export function DraftControls({
  status,
  canStart,
  onStart,
  onPause,
  onResume,
  onRestart,
}: DraftControlsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showRestartConfirm, setShowRestartConfirm] = useState(false)

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

  if (status === 'completed') {
    return (
      <div className="rounded-lg bg-green-500/10 p-4 text-center text-green-600 dark:text-green-400">
        Draft Complete!
      </div>
    )
  }

  if (status === 'not_started') {
    return (
      <Button
        onClick={() => handleAction(onStart)}
        disabled={!canStart || isLoading}
        size="lg"
        className="w-full"
      >
        <Play className="mr-2 h-5 w-5" />
        {isLoading ? 'Starting...' : 'Start Draft'}
      </Button>
    )
  }

  if (status === 'paused') {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-yellow-500/10 p-4 text-center text-yellow-600 dark:text-yellow-400">
          Draft Paused
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => handleAction(onResume)}
            disabled={isLoading}
            className="flex-1"
          >
            <Play className="mr-2 h-4 w-4" />
            {isLoading ? 'Resuming...' : 'Resume Draft'}
          </Button>

          {showRestartConfirm ? (
            <div className="flex flex-1 gap-2">
              <Button
                variant="destructive"
                onClick={handleRestart}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? 'Restarting...' : 'Confirm Restart'}
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
      </div>
    )
  }

  // in_progress
  return (
    <Button
      onClick={() => handleAction(onPause)}
      disabled={isLoading}
      variant="outline"
      size="lg"
      className="w-full"
    >
      <Pause className="mr-2 h-5 w-5" />
      {isLoading ? 'Pausing...' : 'Pause Draft'}
    </Button>
  )
}
