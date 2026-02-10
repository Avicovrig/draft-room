import { useState, useCallback } from 'react'

function getStorageKey(leagueId: string, ownerId: string) {
  return `draft-notes-${leagueId}-${ownerId}`
}

function loadNotes(key: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function useDraftNotes(leagueId: string | undefined, ownerId: string | undefined) {
  const key = leagueId && ownerId ? getStorageKey(leagueId, ownerId) : ''

  const [notes, setNotes] = useState<Record<string, string>>(() =>
    key ? loadNotes(key) : {}
  )

  const setNote = useCallback(
    (playerId: string, text: string) => {
      if (!key) return
      setNotes((prev) => {
        if (text.trim()) {
          const next = { ...prev, [playerId]: text }
          localStorage.setItem(key, JSON.stringify(next))
          return next
        } else {
          const { [playerId]: _, ...rest } = prev
          localStorage.setItem(key, JSON.stringify(rest))
          return rest
        }
      })
    },
    [key]
  )

  return { notes, setNote }
}
