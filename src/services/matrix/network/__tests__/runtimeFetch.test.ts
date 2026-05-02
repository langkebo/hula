import { fetch as nativeFetch } from '@tauri-apps/plugin-http'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getRuntimeAwareFetch, getRuntimeAwareFetchFn } from '../runtimeFetch'

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn()
}))

describe('runtimeFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('uses browser fetch outside tauri runtime', async () => {
    const browserFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', browserFetch)

    const runtimeFetch = getRuntimeAwareFetch()
    await runtimeFetch('http://localhost:28008/_matrix/client/v3/login')

    expect(browserFetch).toHaveBeenCalledWith('http://localhost:28008/_matrix/client/v3/login', {
      credentials: 'omit'
    })
    expect(getRuntimeAwareFetchFn()).toBeUndefined()
  })

  it('uses tauri native fetch in tauri runtime', async () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} } as Window & { __TAURI_INTERNALS__: unknown })
    ;(nativeFetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })

    const runtimeFetch = getRuntimeAwareFetch()
    await runtimeFetch('http://localhost:28008/_matrix/client/v3/login')

    expect(nativeFetch).toHaveBeenCalledWith('http://localhost:28008/_matrix/client/v3/login', {
      credentials: 'omit'
    })
    expect(getRuntimeAwareFetchFn()).toBeTypeOf('function')
  })

  it('relaxes invalid cert checks for local test domains in tauri runtime', async () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} } as Window & { __TAURI_INTERNALS__: unknown })
    ;(nativeFetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })

    const runtimeFetch = getRuntimeAwareFetch()
    await runtimeFetch('https://matrix.test/_matrix/client/v3/login', {
      method: 'POST'
    })

    expect(nativeFetch).toHaveBeenCalledWith('https://matrix.test/_matrix/client/v3/login', {
      credentials: 'omit',
      danger: {
        acceptInvalidCerts: true,
        acceptInvalidHostnames: true
      },
      method: 'POST'
    })
  })

  it('falls back to browser fetch when tauri native fetch throws', async () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} } as Window & { __TAURI_INTERNALS__: unknown })
    const browserFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', browserFetch)
    ;(nativeFetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('error sending request for url (https://matrix.test/_matrix/client/v3/login)')
    )

    const runtimeFetch = getRuntimeAwareFetch()
    const response = await runtimeFetch('https://matrix.test/_matrix/client/v3/login', {
      method: 'POST'
    })

    expect(response.ok).toBe(true)
    expect(nativeFetch).toHaveBeenCalledWith('https://matrix.test/_matrix/client/v3/login', {
      credentials: 'omit',
      danger: {
        acceptInvalidCerts: true,
        acceptInvalidHostnames: true
      },
      method: 'POST'
    })
    expect(browserFetch).toHaveBeenCalledWith('https://matrix.test/_matrix/client/v3/login', {
      credentials: 'omit',
      method: 'POST'
    })
  })

  it('preserves explicit credentials when provided', async () => {
    const browserFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', browserFetch)

    const runtimeFetch = getRuntimeAwareFetch()
    await runtimeFetch('http://localhost:28008/_matrix/client/v3/login', {
      credentials: 'include',
      method: 'POST'
    })

    expect(browserFetch).toHaveBeenCalledWith('http://localhost:28008/_matrix/client/v3/login', {
      credentials: 'include',
      method: 'POST'
    })
  })
})
