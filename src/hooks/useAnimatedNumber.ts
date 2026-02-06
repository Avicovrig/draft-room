import { useEffect, useRef, useState } from 'react'

export function useAnimatedNumber(target: number, duration = 400): number {
  const [display, setDisplay] = useState(target)
  const prevRef = useRef(target)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    const start = prevRef.current
    const diff = target - start

    if (diff === 0) return

    const startTime = performance.now()

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(start + diff * eased))

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      } else {
        prevRef.current = target
      }
    }

    frameRef.current = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(frameRef.current)
  }, [target, duration])

  return display
}
