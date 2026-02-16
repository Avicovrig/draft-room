import { Zap } from 'lucide-react'
import { PickTimer } from './PickTimer'
import { DraftControls } from './DraftControls'
import type { LeagueFullPublic, CaptainPublic } from '@/lib/types'

interface DraftCommandBarProps {
  league: LeagueFullPublic
  currentCaptain: CaptainPublic | undefined
  availablePlayerCount: number
  canStartDraft: boolean
  isManager: boolean
  showAutoPickFlash: boolean
  onStartDraft: () => Promise<void>
  onPauseDraft: () => Promise<void>
  onResumeDraft: () => Promise<void>
  onRestartDraft: () => Promise<void>
  onUndoLastPick: () => Promise<void>
  onTimerExpire: () => void
}

export function DraftCommandBar({
  league,
  currentCaptain,
  availablePlayerCount,
  canStartDraft,
  isManager,
  showAutoPickFlash,
  onStartDraft,
  onPauseDraft,
  onResumeDraft,
  onRestartDraft,
  onUndoLastPick,
  onTimerExpire,
}: DraftCommandBarProps) {
  const isActive = league.status === 'in_progress'
  const hasPicks = league.draft_picks.length > 0

  return (
    <div className="flex items-center gap-2 sm:gap-3 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
      {/* Current picker info */}
      {isActive && currentCaptain && (
        <div className="flex items-center gap-2 min-w-0" aria-label="Current turn">
          {currentCaptain.team_photo_url ? (
            <img
              src={currentCaptain.team_photo_url}
              alt=""
              className="h-6 w-6 rounded object-cover flex-shrink-0"
            />
          ) : currentCaptain.team_color ? (
            <span
              className="h-5 w-5 rounded-full flex-shrink-0"
              style={{ backgroundColor: currentCaptain.team_color }}
            />
          ) : null}
          <span className="text-sm font-medium truncate hidden sm:inline">
            {currentCaptain.team_name || currentCaptain.name}
          </span>
        </div>
      )}

      {/* Timer */}
      <div className="relative flex items-center">
        {showAutoPickFlash && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <Zap className="h-8 w-8 text-yellow-500 animate-scale-in" />
          </div>
        )}
        <PickTimer
          currentPickStartedAt={league.current_pick_started_at}
          timeLimitSeconds={league.time_limit_seconds}
          isActive={isActive}
          onExpire={onTimerExpire}
          compact
        />
      </div>

      {/* Manager controls */}
      {isManager && (
        <div className="flex items-center border-l border-border pl-3">
          <DraftControls
            status={league.status}
            canStart={canStartDraft}
            captainCount={league.captains.length}
            playerCount={availablePlayerCount}
            hasPicks={hasPicks}
            onStart={onStartDraft}
            onPause={onPauseDraft}
            onResume={onResumeDraft}
            onRestart={onRestartDraft}
            onUndo={onUndoLastPick}
            compact
          />
        </div>
      )}
    </div>
  )
}
