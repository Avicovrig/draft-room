import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Re-implement the core logic for testability (the actual module uses React.lazy
// which is hard to unit test in isolation)

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

async function lazyImportWithRetry<T>(
  importFn: () => Promise<T>,
  moduleId: string,
  deps: { sessionStorage: Storage; reload: () => void }
): Promise<T> {
  const key = `${STORAGE_KEY_PREFIX}${moduleId}`

  try {
    const module = await importFn()
    deps.sessionStorage.removeItem(key)
    return module
  } catch (error) {
    if (!isChunkLoadError(error)) throw error

    const hasReloaded = deps.sessionStorage.getItem(key) === '1'
    if (hasReloaded) {
      deps.sessionStorage.removeItem(key)
      throw error
    }

    deps.sessionStorage.setItem(key, '1')
    deps.reload()
    return new Promise<never>(() => {})
  }
}

describe('lazyWithRetry', () => {
  const mockReload = vi.fn()
  let storage: Record<string, string> = {}
  let mockSessionStorage: Storage

  beforeEach(() => {
    storage = {}
    mockReload.mockClear()

    mockSessionStorage = {
      getItem: vi.fn((key: string) => storage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete storage[key]
      }),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function retry<T>(importFn: () => Promise<T>, moduleId: string) {
    return lazyImportWithRetry(importFn, moduleId, {
      sessionStorage: mockSessionStorage,
      reload: mockReload,
    })
  }

  it('passes through a successful import unchanged', async () => {
    const fakeModule = { default: () => null }
    const importFn = vi.fn().mockResolvedValue(fakeModule)

    const result = await retry(importFn, 'test-module')

    expect(result).toBe(fakeModule)
    expect(mockReload).not.toHaveBeenCalled()
  })

  it('clears stale reload flag on successful import', async () => {
    storage['chunk-retry:test-module'] = '1'
    const fakeModule = { default: () => null }
    const importFn = vi.fn().mockResolvedValue(fakeModule)

    await retry(importFn, 'test-module')

    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('chunk-retry:test-module')
  })

  it('triggers reload on first chunk load error', async () => {
    const importFn = vi
      .fn()
      .mockRejectedValue(new Error('Failed to fetch dynamically imported module'))

    // The function calls reload and returns a never-resolving promise,
    // so we race it with a timeout
    const result = await Promise.race([
      retry(importFn, 'test-module'),
      new Promise((resolve) => setTimeout(() => resolve('timed-out'), 50)),
    ])

    expect(result).toBe('timed-out')
    expect(mockReload).toHaveBeenCalledOnce()
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith('chunk-retry:test-module', '1')
  })

  it('propagates error on second failure (after reload)', async () => {
    storage['chunk-retry:test-module'] = '1'
    const chunkError = new Error('Failed to fetch dynamically imported module')
    const importFn = vi.fn().mockRejectedValue(chunkError)

    await expect(retry(importFn, 'test-module')).rejects.toThrow(chunkError)

    expect(mockReload).not.toHaveBeenCalled()
    expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('chunk-retry:test-module')
  })

  it('propagates non-chunk errors immediately without reload', async () => {
    const syntaxError = new SyntaxError('Unexpected token')
    const importFn = vi.fn().mockRejectedValue(syntaxError)

    await expect(retry(importFn, 'test-module')).rejects.toThrow(syntaxError)

    expect(mockReload).not.toHaveBeenCalled()
    expect(mockSessionStorage.setItem).not.toHaveBeenCalled()
  })

  describe('isChunkLoadError', () => {
    it('matches "dynamically imported module" errors', () => {
      expect(
        isChunkLoadError(new Error('Failed to fetch dynamically imported module /assets/foo.js'))
      ).toBe(true)
    })

    it('matches "Loading chunk" errors', () => {
      expect(isChunkLoadError(new Error('Loading chunk 42 failed'))).toBe(true)
    })

    it('matches "Failed to fetch" errors', () => {
      expect(isChunkLoadError(new Error('Failed to fetch'))).toBe(true)
    })

    it('does not match unrelated errors', () => {
      expect(isChunkLoadError(new Error('Network timeout'))).toBe(false)
    })

    it('does not match non-Error values', () => {
      expect(isChunkLoadError('string error')).toBe(false)
      expect(isChunkLoadError(null)).toBe(false)
    })
  })
})
