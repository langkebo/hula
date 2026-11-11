import { fetch as nativeFetch } from '@tauri-apps/plugin-http'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetRuntimeFetchWarningForTests, getRuntimeAwareFetch, getRuntimeAwareFetchFn } from '../runtimeFetch'

const { warnMock, debugMock } = vi.hoisted(() => ({
  warnMock: vi.fn(),
  debugMock: vi.fn()
}))

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn()
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    warn: warnMock,
    error: vi.fn(),
    info: vi.fn(),
    debug: debugMock
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

  it('does not relax TLS checks in tauri runtime', async () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} } as Window & { __TAURI_INTERNALS__: unknown })
    ;(nativeFetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })

    const runtimeFetch = getRuntimeAwareFetch()
    await runtimeFetch('https://matrix.test/_matrix/client/v3/login', {
      method: 'POST'
    })

    expect(nativeFetch).toHaveBeenCalledWith('https://matrix.test/_matrix/client/v3/login', {
      credentials: 'omit',
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
      method: 'POST'
    })
    expect(browserFetch).toHaveBeenCalledWith('https://matrix.test/_matrix/client/v3/login', {
      credentials: 'omit',
      method: 'POST'
    })
    expect(warnMock).toHaveBeenCalledTimes(2)
  })

  it('aggregates repeated native-fetch failures per host: warn once, then debug', async () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} } as Window & { __TAURI_INTERNALS__: unknown })
    const browserFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', browserFetch)
    ;(nativeFetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('url not allowed on the configured scope')
    )

    const runtimeFetch = getRuntimeAwareFetch()
    await runtimeFetch('https://matrix.test/_matrix/client/v3/login')
    await runtimeFetch('https://matrix.test/_matrix/client/v3/capabilities')
    await runtimeFetch('https://matrix.test/_matrix/client/v3/keys/query')

    expect(browserFetch).toHaveBeenCalledTimes(3)
    // 同一 host 的原生异常只 warn 1 次（首次）+ 1 次全局回退 warn = 2 条 WARN；
    // 其余 2 次降级为 debug，避免 /sync 与 presence 心跳把日志刷屏。
    expect(warnMock).toHaveBeenCalledTimes(2)
    expect(debugMock).toHaveBeenCalledTimes(2)
    expect(warnMock.mock.calls.some(([msg]) => String(msg).includes('同一 host 后续异常降为 debug'))).toBe(true)
  })

  it('warns once per distinct host when several hosts fail natively', async () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} } as Window & { __TAURI_INTERNALS__: unknown })
    const browserFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', browserFetch)
    ;(nativeFetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('scope denied'))

    const runtimeFetch = getRuntimeAwareFetch()
    await runtimeFetch('https://matrix.test/_matrix/client/v3/login')
    await runtimeFetch('https://hs.example.com/_matrix/client/v3/login')

    // 2 个不同 host 各 warn 1 次原生异常 + 1 次全局回退 warn = 3 条 WARN，0 条 debug
    expect(warnMock).toHaveBeenCalledTimes(3)
    expect(debugMock).not.toHaveBeenCalled()
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

  it('falls back to browser fetch and retries for genuine network failures without an abort signal', async () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} } as Window & { __TAURI_INTERNALS__: unknown })

    const browserFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', browserFetch)
    // 真正的网络层错误（连接被拒 / 服务端不可达），不是 Tauri 取消错误
    ;(nativeFetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('error sending request for url (https://matrix.test/_matrix/client/v3/capabilities)')
    )

    const runtimeFetch = getRuntimeAwareFetch()
    const response = await runtimeFetch('https://matrix.test/_matrix/client/v3/capabilities')

    expect(response.ok).toBe(true)
    expect(browserFetch).toHaveBeenCalledTimes(2)
  })

  it('normalizes tauri "resource id invalid" to AbortError and never falls back, even without an explicit abort signal', async () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} } as Window & { __TAURI_INTERNALS__: unknown })
    const browserFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', browserFetch)
    // 真实 Tauri 报错格式：The resource id <rid> is invalid.
    ;(nativeFetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('The resource id 3191644895 is invalid.')
    )

    const runtimeFetch = getRuntimeAwareFetch()
    await expect(
      runtimeFetch('https://matrix.test/_matrix/client/unstable/org.matrix.simplified_msc3575/sync')
    ).rejects.toMatchObject({ name: 'AbortError' })

    // 不得回退浏览器 fetch / 不得重放 SDK 已放弃的 /sync 长轮询
    expect(browserFetch).not.toHaveBeenCalled()
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
