import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MATRIX_HOMESERVER_STORAGE_KEY, MATRIX_IDENTITY_SERVER_STORAGE_KEY } from '../config'
import { discoverAndSaveMatrixEndpoints, discoverMatrixEndpoints } from '../discovery'

const mockFetch = vi.fn()

vi.mock('@/services/matrix/network/runtimeFetch', () => ({
  getRuntimeAwareFetch: () => mockFetch
}))

describe('matrix discovery', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns explicit homeserver urls without discovery', async () => {
    const result = await discoverMatrixEndpoints('https://matrix.example.com')

    expect(result).toEqual({
      homeserverUrl: 'https://matrix.example.com',
      identityServerUrl: '',
      source: 'explicit_url'
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('resolves homeserver and identity server from .well-known', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        'm.homeserver': {
          base_url: 'https://hs.example.com'
        },
        'm.identity_server': {
          base_url: 'https://is.example.com'
        }
      })
    })

    const result = await discoverMatrixEndpoints('example.com')

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/.well-known/matrix/client')
    expect(result).toEqual({
      homeserverUrl: 'https://hs.example.com',
      identityServerUrl: 'https://is.example.com',
      source: 'well_known',
      serverName: 'example.com'
    })
  })

  it('falls back to bundled config when discovery fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false
    })

    const result = await discoverMatrixEndpoints('example.com', {
      homeserverUrl: 'https://fallback.example.com',
      identityServerUrl: 'https://identity.example.com'
    })

    expect(result).toEqual({
      homeserverUrl: 'https://fallback.example.com',
      identityServerUrl: 'https://identity.example.com',
      source: 'fallback',
      serverName: 'example.com'
    })
  })

  it('derives an https homeserver from server name when discovery and fallback are both unavailable', async () => {
    mockFetch.mockRejectedValue(new Error('offline'))

    const result = await discoverMatrixEndpoints('example.com')

    expect(result).toEqual({
      homeserverUrl: 'https://example.com',
      identityServerUrl: '',
      source: 'derived_server_name',
      serverName: 'example.com'
    })
  })

  it('persists discovered endpoints into local storage', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        'm.homeserver': {
          base_url: 'https://hs.example.com'
        },
        'm.identity_server': {
          base_url: 'https://is.example.com'
        }
      })
    })

    const storage = new Map<string, string>()
    const originalWindow = globalThis.window

    Object.defineProperty(globalThis, 'window', {
      value: {
        localStorage: {
          getItem(key: string) {
            return storage.get(key) ?? null
          },
          setItem(key: string, value: string) {
            storage.set(key, value)
          },
          removeItem(key: string) {
            storage.delete(key)
          }
        }
      },
      configurable: true
    })

    try {
      const result = await discoverAndSaveMatrixEndpoints('example.com')

      expect(result.homeserverUrl).toBe('https://hs.example.com')
      expect(result.identityServerUrl).toBe('https://is.example.com')
      expect(storage.get(MATRIX_HOMESERVER_STORAGE_KEY)).toBe('https://hs.example.com')
      expect(storage.get(MATRIX_IDENTITY_SERVER_STORAGE_KEY)).toBe('https://is.example.com')
    } finally {
      if (originalWindow === undefined) {
        Reflect.deleteProperty(globalThis, 'window')
      } else {
        Object.defineProperty(globalThis, 'window', {
          value: originalWindow,
          configurable: true
        })
      }
    }
  })
})
