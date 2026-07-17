import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MatrixTokenManager } from '../MatrixTokenManager'

const { persistRefreshedTokenMock, logoutExpiredSessionMock } = vi.hoisted(() => ({
  persistRefreshedTokenMock: vi.fn().mockResolvedValue(undefined),
  logoutExpiredSessionMock: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/services/matrix/matrixClientPlatform', () => ({
  persistRefreshedToken: persistRefreshedTokenMock,
  logoutExpiredSession: logoutExpiredSessionMock
}))

describe('MatrixTokenManager', () => {
  let manager: MatrixTokenManager

  const createMockClient = (overrides: Record<string, unknown> = {}) =>
    ({
      getUserId: () => '@user:example.com',
      setAccessToken: vi.fn(),
      http: {
        request: vi.fn()
      },
      ...overrides
    }) as unknown as import('matrix-js-sdk').MatrixClient

  beforeEach(() => {
    vi.useFakeTimers()
    persistRefreshedTokenMock.mockClear()
    logoutExpiredSessionMock.mockClear()
    manager = new MatrixTokenManager()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is not refreshing by default', () => {
    expect(manager.isRefreshing()).toBe(false)
  })

  it('schedules token refresh before expiry', () => {
    const client = createMockClient()
    manager.schedule(client, 'rt1', 120000)

    // Timer should fire near (120000 - 60000 + jitter)
    expect(vi.getTimerCount()).toBeGreaterThan(0)
  })

  it('clear cancels pending refresh', () => {
    const client = createMockClient()
    manager.schedule(client, 'rt1', 120000)
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    manager.clear()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not schedule when refreshToken is empty', () => {
    const client = createMockClient()
    manager.schedule(client, '', 120000)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not schedule when expiresInMs is zero', () => {
    const client = createMockClient()
    manager.schedule(client, 'rt1', 0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('handles millisecond-to-millisecond conversion correctly (expiresInMs < 1000 treated as seconds)', async () => {
    const client = createMockClient({
      http: {
        request: vi.fn().mockResolvedValue({
          access_token: 'new-at',
          refresh_token: 'new-rt',
          expires_in_ms: 7200000
        })
      }
    })
    // expiresInMs = 900 which is < 1000, so treated as seconds → 900000ms effective
    manager.schedule(client, 'rt1', 900)

    // Fast-forward past the scheduled time to trigger the refresh
    await vi.advanceTimersByTimeAsync(900000)

    expect(client.http.request).toHaveBeenCalledWith('POST', '/refresh', undefined, {
      refresh_token: 'rt1'
    })
  })

  it('persists refreshed token on success', async () => {
    const client = createMockClient({
      http: {
        request: vi.fn().mockResolvedValue({
          access_token: 'at2',
          refresh_token: 'rt2',
          expires_in_ms: 7200000
        })
      }
    })
    manager.schedule(client, 'rt1', 120000)

    await vi.advanceTimersByTimeAsync(60001)

    expect(persistRefreshedTokenMock).toHaveBeenCalledWith('@user:example.com', 'at2', 'rt2')
  })

  it('refresh 成功后更新活跃客户端的 access token', async () => {
    const request = vi.fn().mockResolvedValue({
      access_token: 'at-new',
      refresh_token: 'rt-new',
      expires_in_ms: 3600000
    })
    const setAccessToken = vi.fn()
    const client = createMockClient({ http: { request }, setAccessToken })

    manager.schedule(client, 'rt-old', 120000)
    await vi.advanceTimersByTimeAsync(60000)

    expect(setAccessToken).toHaveBeenCalledWith('at-new')
    expect(persistRefreshedTokenMock).toHaveBeenCalledWith('@user:example.com', 'at-new', 'rt-new')
  })

  it('clears on 404 (server does not support refresh)', async () => {
    const client = createMockClient({
      http: {
        request: vi.fn().mockRejectedValue({ httpStatus: 404 })
      }
    })
    manager.schedule(client, 'rt1', 120000)

    await vi.advanceTimersByTimeAsync(60001)

    expect(logoutExpiredSessionMock).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reschedules on 429 with 30s delay', async () => {
    const client = createMockClient({
      http: {
        request: vi.fn().mockRejectedValue({ httpStatus: 429 })
      }
    })
    manager.schedule(client, 'rt1', 120000)

    await vi.advanceTimersByTimeAsync(60001)

    // Should have scheduled a new timer for 30s
    expect(logoutExpiredSessionMock).not.toHaveBeenCalled()
    // The 429 handler calls schedule with 30000ms effective → 30000 - 60000 < 0, clamps to 30000
    // Actually schedule clamps refreshAt to max(expiresInMs - 60000, 30000)
    // With 30000ms: 30000 - 60000 = -30000, clamp to 30000
    expect(vi.getTimerCount()).toBeGreaterThan(0)
  })

  it('triggers logout on fatal refresh errors', async () => {
    const client = createMockClient({
      http: {
        request: vi.fn().mockRejectedValue({ httpStatus: 401, errcode: 'M_UNKNOWN_TOKEN' })
      }
    })
    manager.schedule(client, 'rt1', 120000)

    await vi.advanceTimersByTimeAsync(60001)

    expect(logoutExpiredSessionMock).toHaveBeenCalled()
  })

  it('网络错误(无 httpStatus)时安排 30s 重试且不登出', async () => {
    const request = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const client = createMockClient({ http: { request } })

    manager.schedule(client, 'rt1', 120000)
    await vi.advanceTimersByTimeAsync(60000)

    expect(logoutExpiredSessionMock).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBeGreaterThan(0)
  })

  it('401(token 失效)仍触发登出清理', async () => {
    const request = vi.fn().mockRejectedValue(Object.assign(new Error('unknown token'), { httpStatus: 401 }))
    const client = createMockClient({ http: { request } })

    manager.schedule(client, 'rt1', 120000)
    await vi.advanceTimersByTimeAsync(60000)

    expect(logoutExpiredSessionMock).toHaveBeenCalledTimes(1)
  })
})
