import { fetch as nativeFetch } from '@tauri-apps/plugin-http'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetRuntimeFetchWarningForTests, getRuntimeAwareFetch, getRuntimeAwareFetchFn } from '../runtimeFetch'

const { warnMock } = vi.hoisted(() => ({
  warnMock: vi.fn()
}))

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn()
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    warn: warnMock,
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))

describe('runtimeFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    __resetRuntimeFetchWarningForTests()
  })

  it('uses browser fetch outside tauri runtime', async () => {
    const browserFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', browserFetch)

    const runtimeFetch = getRuntimeAwareFetch()
    await runtimeFetch('http://localhost:28008/_matrix/client/v3/login')

    expect(browserFetch).toHaveBeenCalledWith('http://localhost:28008/_matrix/client/v3/login', {
      credentials: 'omit'
    })
    expect(getRuntimeAwareFetchFn()).toBeTypeOf('function')
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
    expect(warnMock).toHaveBeenCalledTimes(2)
  })

  it('warns only once for repeated native fetch fallback failures', async () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} } as Window & { __TAURI_INTERNALS__: unknown })
    const browserFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', browserFetch)
    ;(nativeFetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('native fetch failed'))

    const runtimeFetch = getRuntimeAwareFetch()
    await runtimeFetch('https://matrix.test/_matrix/client/v3/login')
    await runtimeFetch('https://matrix.test/_matrix/client/v3/capabilities')

    expect(browserFetch).toHaveBeenCalledTimes(2)
    // One warn per native fetch exception (2 calls) + one fallback warn (1 call) = 3 total
    expect(warnMock).toHaveBeenCalledTimes(3)
  })

  it('does not fall back to browser fetch when the request signal is aborted', async () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} } as Window & { __TAURI_INTERNALS__: unknown })
    const browserFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', browserFetch)

    const controller = new AbortController()
    // 模拟 Tauri RID 竞态：abort 触发 fetch_cancel 后 fetch_send 拿到失效的 rid
    ;(nativeFetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      controller.abort()
      throw new Error('resource id invalid')
    })

    const runtimeFetch = getRuntimeAwareFetch()
    await expect(
      runtimeFetch('https://matrix.test/_matrix/client/v3/sync', { signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' })

    expect(browserFetch).not.toHaveBeenCalled()
  })

  it('normalizes tauri "Request cancelled" errors to AbortError', async () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} } as Window & { __TAURI_INTERNALS__: unknown })
    const browserFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', browserFetch)

    const controller = new AbortController()
    controller.abort()
    ;(nativeFetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Request cancelled'))

    const runtimeFetch = getRuntimeAwareFetch()
    await expect(
      runtimeFetch('https://matrix.test/_matrix/client/v3/sync', { signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' })

    expect(browserFetch).not.toHaveBeenCalled()
  })

  it('stops browser fetch retries once the signal aborts mid-flight', async () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} } as Window & { __TAURI_INTERNALS__: unknown })

    const controller = new AbortController()
    const browserFetch = vi.fn().mockImplementation(async () => {
      controller.abort()
      throw new Error('Failed to fetch')
    })
    vi.stubGlobal('fetch', browserFetch)
    ;(nativeFetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('error sending request'))

    const runtimeFetch = getRuntimeAwareFetch()
    await expect(
      runtimeFetch('https://matrix.test/_matrix/client/v3/keys/query', {
        method: 'POST',
        signal: controller.signal
      })
    ).rejects.toMatchObject({ name: 'AbortError' })

    // 信号已中止，不得继续退避重试
    expect(browserFetch).toHaveBeenCalledTimes(1)
  })

  it('still falls back and retries for genuine network failures without an abort signal', async () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} } as Window & { __TAURI_INTERNALS__: unknown })

    const browserFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', browserFetch)
    ;(nativeFetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('resource id invalid'))

    const runtimeFetch = getRuntimeAwareFetch()
    const response = await runtimeFetch('https://matrix.test/_matrix/client/v3/capabilities')

    expect(response.ok).toBe(true)
    expect(browserFetch).toHaveBeenCalledTimes(2)
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
