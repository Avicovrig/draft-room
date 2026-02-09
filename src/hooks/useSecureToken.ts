import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Reads a token from URL search params, stores it in sessionStorage,
 * and strips it from the URL to prevent exposure in browser history
 * and referrer headers.
 */
export function useSecureToken(prefix: string, id: string | undefined): string | null {
  const [searchParams] = useSearchParams()
  const storageKey = id ? `${prefix}-token-${id}` : ''
  const tokenFromUrl = searchParams.get('token')

  const [token] = useState<string | null>(() => {
    // Prefer URL param (first load), fall back to sessionStorage
    if (tokenFromUrl) return tokenFromUrl
    if (storageKey) return sessionStorage.getItem(storageKey)
    return null
  })

  useEffect(() => {
    if (!token || !storageKey) return

    // Store in sessionStorage
    sessionStorage.setItem(storageKey, token)

    // Strip token from URL
    if (tokenFromUrl) {
      const url = new URL(window.location.href)
      url.searchParams.delete('token')
      window.history.replaceState({}, '', url.pathname + (url.search || ''))
    }
  }, [token, storageKey, tokenFromUrl])

  return token
}
