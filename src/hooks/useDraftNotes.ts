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
        const next = { ...prev }
        if (text.trim()) {
          next[playerId] = text
        } else {
          delete next[playerId]
        }
        localStorage.setItem(key, JSON.stringify(next))
        return next
      })
    },
    [key]
  )

  return { notes, setNote }
}
