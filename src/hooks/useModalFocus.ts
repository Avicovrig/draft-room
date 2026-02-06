import { useEffect, useRef, useCallback } from 'react'

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'

interface UseModalFocusOptions {
  onClose: () => void
  enabled?: boolean
}

export function useModalFocus({ onClose, enabled = true }: UseModalFocusOptions) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!enabled) return

    previousFocusRef.current = document.activeElement as HTMLElement
    document.body.style.overflow = 'hidden'

    // Focus first focusable element inside the modal content (not the overlay)
    requestAnimationFrame(() => {
      const modal = overlayRef.current
      if (!modal) return
      const focusable = modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      for (const el of focusable) {
        if (el !== modal) {
          el.focus()
          break
        }
      }
    })

    return () => {
      document.body.style.overflow = ''
      previousFocusRef.current?.focus()
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      if (e.key === 'Tab') {
        const modal = overlayRef.current
        if (!modal) return

        const focusable = Array.from(
          modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null) // only visible elements

        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, enabled])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose()
    },
    [onClose]
  )

  return {
    overlayRef,
    overlayProps: {
      ref: overlayRef,
      onClick: handleOverlayClick,
      role: 'dialog' as const,
      'aria-modal': true as const,
    },
  }
}
