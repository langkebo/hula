import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixHttpClient } from '../MatrixHttpClient'

const {
  getMatrixClientMock,
  getMatrixHomeserverUrlMock,
  getMatrixAccessTokenMock,
  runtimeFetchMock,
  infoMock,
  errorMock
} = vi.hoisted(() => ({
  getMatrixClientMock: vi.fn(),
  getMatrixHomeserverUrlMock: vi.fn(),
  getMatrixAccessTokenMock: vi.fn(),
  runtimeFetchMock: vi.fn(),
  infoMock: vi.fn(),
  errorMock: vi.fn()
}))

vi.mock('../matrixClientAccessor', () => ({
  getMatrixClient: getMatrixClientMock,
  getMatrixHomeserverUrl: getMatrixHomeserverUrlMock,
  getMatrixAccessToken: getMatrixAccessTokenMock
}))

vi.mock('@/services/backend', () => ({
  resolveMatrixRuntimeEndpointConfig: () => ({ homeserverUrl: 'https://fallback.matrix.test' })
}))

vi.mock('../network/runtimeFetch', () => ({
  getRuntimeAwareFetch: () => runtimeFetchMock
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: infoMock,
  error: errorMock,
  warn: vi.fn()
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({
    t: (key: string) => key
  })
}))

describe('MatrixHttpClient', () => {
  let authedRequestWithPrefix: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    // Characterization: mock Naive UI global side-effect targets
    vi.stubGlobal('$message', {
      error: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      info: vi.fn()
    })
    vi.stubGlobal('$loadingBar', {
      start: vi.fn(),
      finish: vi.fn(),
      error: vi.fn()
    })
    authedRequestWithPrefix = vi.fn().mockResolvedValue({})
    getMatrixHomeserverUrlMock.mockReturnValue('https://matrix.test')
    getMatrixAccessTokenMock.mockReturnValue('tok-abc')
    runtimeFetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
    // B-1：client 分支统一走 SDK manager 的 authedRequestWithPrefix（内部剥离完整前缀）
    getMatrixClientMock.mockReturnValue({
      getRoomManager: () => ({ authedRequestWithPrefix })
    } as unknown as MatrixClient)
  })

  it('uses the accessor-provided Matrix client for GET requests', async () => {
    authedRequestWithPrefix.mockResolvedValueOnce({ ok: true })

    const result = await matrixHttpClient.get<{ ok: boolean }>('/test')

    expect(authedRequestWithPrefix).toHaveBeenCalledWith('GET', '/test', undefined, undefined)
    expect(result).toEqual({ ok: true })
  })

  it('passes body for POST requests', async () => {
    await matrixHttpClient.post('/send', { body: 'hello' })

    expect(authedRequestWithPrefix).toHaveBeenCalledWith('POST', '/send', undefined, { body: 'hello' })
    expect(infoMock).toHaveBeenCalled()
  })

  it('returns the default value when safe request fails', async () => {
    authedRequestWithPrefix.mockRejectedValueOnce(new Error('boom'))

    const result = await matrixHttpClient.get('/test', {
      defaultValue: { fallback: true }
    })

    expect(result).toEqual({ fallback: true })
    expect(errorMock).toHaveBeenCalled()
  })

  it('throws when throwOnError is enabled', async () => {
    authedRequestWithPrefix.mockRejectedValueOnce(new Error('boom'))

    await expect(
      matrixHttpClient.get('/test', {
        throwOnError: true
      })
    ).rejects.toThrow('boom')
  })

  it('returns false for delete when request fails', async () => {
    authedRequestWithPrefix.mockRejectedValueOnce(new Error('boom'))

    await expect(matrixHttpClient.delete('/test')).resolves.toBe(false)
  })

  it('builds encoded room and user paths', () => {
    expect(matrixHttpClient.buildRoomPath('!room:server', 'state')).toBe(
      '/_matrix/client/v3/rooms/!room%3Aserver/state'
    )
    expect(matrixHttpClient.buildUserPath('@user:server', 'account_data')).toBe(
      '/_matrix/client/v3/user/%40user%3Aserver/account_data'
    )
  })

  it('falls back to an unauthenticated runtime fetch when the Matrix client accessor has not been registered', async () => {
    getMatrixClientMock.mockReturnValueOnce(null)

    await expect(
      matrixHttpClient.request('POST', '/test', {
        queryParams: { via: 'fallback' },
        body: { ok: true }
      })
    ).resolves.toEqual({})

    // 回退路径语义为「未鉴权」：绝不携带 Authorization（token 与 client 同源，client 为 null 时必为 null）
    expect(runtimeFetchMock).toHaveBeenCalledWith('https://matrix.test/test?via=fallback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ok: true })
    })
  })

  it('request 不再操作 window.$loadingBar（即使传入 showLoading）', async () => {
    authedRequestWithPrefix.mockResolvedValueOnce({ ok: true })

    await matrixHttpClient.request('GET', '/test', {
      showLoading: true
    } as never)

    expect(window.$loadingBar.start).not.toHaveBeenCalled()
    expect(window.$loadingBar.finish).not.toHaveBeenCalled()
    expect(window.$loadingBar.error).not.toHaveBeenCalled()
  })

  it('request 失败不再操作 window.$loadingBar', async () => {
    authedRequestWithPrefix.mockRejectedValueOnce(new Error('boom'))

    await expect(
      matrixHttpClient.request('GET', '/test', {
        showLoading: true
      } as never)
    ).rejects.toThrow('boom')

    expect(window.$loadingBar.start).not.toHaveBeenCalled()
    expect(window.$loadingBar.error).not.toHaveBeenCalled()
    expect(window.$loadingBar.finish).not.toHaveBeenCalled()
  })

  it('request 不再操作 window.$message（即使传入 showErrorToast）', async () => {
    authedRequestWithPrefix.mockRejectedValueOnce(new Error('boom'))

    await expect(
      matrixHttpClient.request('GET', '/test', {
        showErrorToast: true
      } as never)
    ).rejects.toThrow('boom')

    expect(window.$message.error).not.toHaveBeenCalled()
  })

  it('safeRequest 默认（quiet 未设）失败时不再调用 window.$message.error', async () => {
    authedRequestWithPrefix.mockRejectedValueOnce(new Error('boom'))

    await matrixHttpClient.get('/test')

    expect(window.$message.error).not.toHaveBeenCalled()
  })
})
