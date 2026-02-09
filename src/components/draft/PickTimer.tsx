import { useEffect, useRef } from 'react'
import { useTimer } from '@/hooks/useTimer'
import { formatTime } from '@/lib/draft'
import { cn } from '@/lib/utils'
import { playSound, resumeAudioContext } from '@/lib/sounds'

interface PickTimerProps {
  currentPickStartedAt: string | null
  timeLimitSeconds: number
  isActive: boolean
  onExpire?: () => void
}

export function PickTimer({
  currentPickStartedAt,
  timeLimitSeconds,
  isActive,
  onExpire,
}: PickTimerProps) {
  const { remainingTime, isExpired } = useTimer(
    currentPickStartedAt,
    timeLimitSeconds,
    isActive,
    onExpire
  )
  const lastPlayedSecondRef = useRef<number | null>(null)
  const pickStartRef = useRef(currentPickStartedAt)

  const percentage = (remainingTime / timeLimitSeconds) * 100
  const isLow = remainingTime <= 10
  const isCritical = remainingTime <= 5
  // Derive shake key from remaining seconds — changes each second to re-trigger CSS animation
  const shakeKey = Math.ceil(remainingTime)

  // Reset when pick changes
  useEffect(() => {
    pickStartRef.current = currentPickStartedAt
    lastPlayedSecondRef.current = null
  }, [currentPickStartedAt])

  // Play tick sound once per second for last 10 seconds
  useEffect(() => {
    if (!isActive) {
      lastPlayedSecondRef.current = null
      return
    }

    const wholeSecond = Math.ceil(remainingTime)

    // Only play if: active, in last 10 seconds, not expired, and haven't played this second yet
    if (wholeSecond <= 10 && wholeSecond > 0 && wholeSecond !== lastPlayedSecondRef.current) {
      lastPlayedSecondRef.current = wholeSecond
      resumeAudioContext()
      playSound('timerWarning')
    }
  }, [remainingTime, isActive])

  return (
    <div
      className="text-center"
      role="status"
      aria-live="polite"
      aria-label={
        isExpired ? 'Time expired, auto-picking' :
        isActive ? `${formatTime(remainingTime)} remaining` :
        'Waiting to start'
      }
    >
      <div
        key={isLow && !isCritical ? shakeKey : undefined}
        className={cn(
          'text-5xl font-bold tabular-nums transition-all',
          isExpired && 'text-destructive',
          isCritical && !isExpired && 'text-6xl text-red-500 animate-pulse-fast',
          isLow && !isCritical && !isExpired && 'text-yellow-500 animate-shake'
        )}
      >
        {isExpired ? '0:00' : formatTime(remainingTime)}
      </div>

      {/* Progress bar */}
      <div className={cn(
        'mt-4 h-2 w-full overflow-hidden rounded-full bg-muted',
        isCritical && !isExpired && 'animate-glow'
      )}>
        <div
          className={cn(
            'h-full transition-all duration-100',
            isExpired && 'bg-destructive',
            isCritical && !isExpired && 'bg-red-500',
            isLow && !isCritical && !isExpired && 'bg-yellow-500',
            !isLow && 'bg-primary'
          )}
          style={{ width: `${Math.max(0, percentage)}%` }}
        />
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        {isExpired
          ? 'Time expired - auto-picking...'
          : isActive
          ? 'Time remaining to pick'
          : 'Waiting to start'}
      </p>
    </div>
  )
}
