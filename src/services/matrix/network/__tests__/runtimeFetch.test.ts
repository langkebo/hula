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
    // 非 _matrix 路径仍走 nativeFetch，验证 TLS 放松
    await runtimeFetch('https://matrix.test/custom/api', {
      method: 'POST'
    })

    expect(nativeFetch).toHaveBeenCalledWith('https://matrix.test/custom/api', {
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
      new Error('error sending request for url (https://matrix.example.com/_matrix/client/v3/login)')
    )

    const runtimeFetch = getRuntimeAwareFetch()
    const response = await runtimeFetch('https://matrix.example.com/_matrix/client/v3/login', {
      method: 'POST'
    })

    expect(response.ok).toBe(true)
    expect(nativeFetch).toHaveBeenCalledWith('https://matrix.example.com/_matrix/client/v3/login', {
      credentials: 'omit',
      method: 'POST'
    })
    expect(browserFetch).toHaveBeenCalledWith('https://matrix.example.com/_matrix/client/v3/login', {
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
    await runtimeFetch('https://matrix.example.com/_matrix/client/v3/login')
    await runtimeFetch('https://matrix.example.com/_matrix/client/v3/capabilities')

    expect(browserFetch).toHaveBeenCalledTimes(2)
    // One warn per native fetch exception (2 calls) + one fallback warn (1 call) = 3 total
    expect(warnMock).toHaveBeenCalledTimes(3)
  })

  it('dev mode .test domain _matrix requests skip nativeFetch and go directly to browser fetch', async () => {
    vi.stubGlobal('window', {
      __TAURI_INTERNALS__: {},
      location: { origin: 'http://localhost:6130' }
    } as unknown as Window & { __TAURI_INTERNALS__: unknown })
    const browserFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', browserFetch)

    const runtimeFetch = getRuntimeAwareFetch()
    await runtimeFetch('https://matrix.test/_matrix/client/v3/login', { method: 'POST' })

    // nativeFetch 不应被调用
    expect(nativeFetch).not.toHaveBeenCalled()
    // 浏览器 fetch 应通过 Vite proxy URL 调用
    expect(browserFetch).toHaveBeenCalledWith('http://localhost:6130/_matrix/client/v3/login', {
      credentials: 'omit',
      method: 'POST'
    })
    // 不应有 warn 日志
    expect(warnMock).not.toHaveBeenCalled()
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
