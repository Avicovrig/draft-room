import { useState, useEffect, useRef, useMemo } from 'react'
import { getRemainingTime } from '@/lib/draft'

interface UseTimerReturn {
  remainingTime: number
  isExpired: boolean
}

export function useTimer(
  currentPickStartedAt: string | null,
  timeLimitSeconds: number,
  isActive: boolean,
  onExpire?: () => void
): UseTimerReturn {
  // Use a tick counter to force re-renders
  const [tick, setTick] = useState(0)
  const expireCallbackRef = useRef(onExpire)
  const hasExpiredRef = useRef(false)
  const lastPickStartRef = useRef(currentPickStartedAt)

  // Keep callback ref updated
  useEffect(() => {
    expireCallbackRef.current = onExpire
  }, [onExpire])

  // Reset expired state when pick changes
  if (currentPickStartedAt !== lastPickStartRef.current) {
    lastPickStartRef.current = currentPickStartedAt
    hasExpiredRef.current = false
  }

  // Calculate remaining time based on current state
  const remainingTime = useMemo(
    () => getRemainingTime(currentPickStartedAt, timeLimitSeconds),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentPickStartedAt, timeLimitSeconds, tick]
  )

  useEffect(() => {
    if (!isActive || !currentPickStartedAt) {
      return
    }

    const updateTimer = () => {
      const remaining = getRemainingTime(currentPickStartedAt, timeLimitSeconds)
      setTick((t) => t + 1)

      if (remaining <= 0 && !hasExpiredRef.current) {
        hasExpiredRef.current = true
        // Add 1 second delay before calling onExpire to account for client-server time skew
        // This ensures the server also considers the timer expired
        setTimeout(() => {
          expireCallbackRef.current?.()
        }, 1000)
      }
    }

    // Update every 100ms for smooth countdown
    const interval = setInterval(updateTimer, 100)

    return () => clearInterval(interval)
  }, [currentPickStartedAt, timeLimitSeconds, isActive])

  return {
    remainingTime,
    isExpired: remainingTime <= 0,
  }
}

/**
 * Hook for auto-pick functionality
 * Calls the provided callback when timer expires
 */
export function useAutoPick(
  isActive: boolean,
  isMyTurn: boolean,
  isExpired: boolean,
  onAutoPick: () => void
) {
  const hasTriggeredRef = useRef(false)

  useEffect(() => {
    // Reset trigger when turn changes
    hasTriggeredRef.current = false
  }, [isMyTurn])

  useEffect(() => {
    if (isActive && isExpired && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true
      onAutoPick()
    }
  }, [isActive, isExpired, onAutoPick])
}
