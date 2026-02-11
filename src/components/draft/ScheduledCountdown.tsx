import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'
import { formatScheduledTime, formatCountdown, getTimeUntilStart } from '@/lib/draft'

interface ScheduledCountdownProps {
  scheduledTime: string
  className?: string
}

export function ScheduledCountdown({ scheduledTime, className = '' }: ScheduledCountdownProps) {
  const [countdown, setCountdown] = useState(() => formatCountdown(scheduledTime))
  const [isPast, setIsPast] = useState(() => !getTimeUntilStart(scheduledTime))

  useEffect(() => {
    const CLOSE_THRESHOLD_MS = 5 * 60 * 1000

    const updateCountdown = () => {
      const timeUntil = getTimeUntilStart(scheduledTime)
      if (!timeUntil) {
        setIsPast(true)
        setCountdown('Starting soon!')
      } else {
        setIsPast(false)
        setCountdown(formatCountdown(scheduledTime))
      }
    }

    // Update immediately
    updateCountdown()

    // Dynamically adjust interval: 1s when close, 60s otherwise.
    // Re-check every tick so the interval switches when crossing the threshold.
    const tick = () => {
      updateCountdown()
      const timeUntil = getTimeUntilStart(scheduledTime)
      const nextMs = timeUntil && timeUntil.totalMs < CLOSE_THRESHOLD_MS ? 1000 : 60000
      timer = setTimeout(tick, nextMs)
    }

    const timeUntil = getTimeUntilStart(scheduledTime)
    const initialMs = timeUntil && timeUntil.totalMs < CLOSE_THRESHOLD_MS ? 1000 : 60000
    let timer = setTimeout(tick, initialMs)

    return () => clearTimeout(timer)
  }, [scheduledTime])

  return (
    <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
      <Clock className="h-4 w-4" />
      <div>
        <span className="text-foreground font-medium">{formatScheduledTime(scheduledTime)}</span>
        {!isPast && <span className="ml-2 text-sm">(in {countdown})</span>}
        {isPast && <span className="ml-2 text-sm text-primary font-medium">Ready to start!</span>}
      </div>
    </div>
  )
}
