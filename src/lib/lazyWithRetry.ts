import { lazy } from 'react'

type ComponentImportFn = Parameters<typeof lazy>[0]

const STORAGE_KEY_PREFIX = 'chunk-retry:'

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    msg.includes('dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('failed to fetch')
  )
}

/**
 * Wrapper around React.lazy that handles chunk load failures after deployments.
 * On failure, does a single full-page reload to fetch latest HTML/chunk URLs.
 * Uses sessionStorage to prevent infinite reload loops.
 */
export function lazyWithRetry(importFn: ComponentImportFn, moduleId?: string) {
  const key = `${STORAGE_KEY_PREFIX}${moduleId ?? importFn.toString()}`

  return lazy(() =>
    importFn().then(
      (module) => {
        sessionStorage.removeItem(key)
        return module
      },
      (error: unknown) => {
        if (!isChunkLoadError(error)) throw error

        const hasReloaded = sessionStorage.getItem(key) === '1'
        if (hasReloaded) {
          sessionStorage.removeItem(key)
          throw error
        }

        sessionStorage.setItem(key, '1')
        window.location.reload()

        // Return a never-resolving promise so React stays in Suspense
        // while the page reloads
        return new Promise<never>(() => {})
      }
    )
  )
}
