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

    // Update every minute, or every second if less than 5 minutes away
    const timeUntil = getTimeUntilStart(scheduledTime)
    const intervalMs = timeUntil && timeUntil.totalMs < 5 * 60 * 1000 ? 1000 : 60000

    const interval = setInterval(updateCountdown, intervalMs)
    return () => clearInterval(interval)
  }, [scheduledTime])

  return (
    <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
      <Clock className="h-4 w-4" />
      <div>
        <span className="text-foreground font-medium">
          {formatScheduledTime(scheduledTime)}
        </span>
        {!isPast && (
          <span className="ml-2 text-sm">
            (in {countdown})
          </span>
        )}
        {isPast && (
          <span className="ml-2 text-sm text-primary font-medium">
            Ready to start!
          </span>
        )}
      </div>
    </div>
  )
}
