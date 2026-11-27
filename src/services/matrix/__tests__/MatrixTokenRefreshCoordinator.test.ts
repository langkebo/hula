import { invoke } from '@tauri-apps/api/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { refreshAccessToken } from '../MatrixTokenRefreshCoordinator'

const { persistRefreshedTokenMock } = vi.hoisted(() => ({
  persistRefreshedTokenMock: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/utils/AppHarness', () => ({ hasTauriRuntime: vi.fn(() => false) }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@/services/matrix/matrixClientPlatform', () => ({
  persistRefreshedToken: persistRefreshedTokenMock
}))

type RefreshClient = Parameters<typeof refreshAccessToken>[0]

interface InvokeMock {
  mockReset: () => void
  mockImplementation: (impl: (command: string) => Promise<unknown>) => void
  mock: { calls: unknown[][] }
}

const hasTauriRuntimeMock = vi.mocked(hasTauriRuntime)
const invokeMock = invoke as unknown as InvokeMock

function createClient(refreshImpl: () => Promise<unknown>): RefreshClient {
  return {
    refreshToken: vi.fn(refreshImpl),
    setAccessToken: vi.fn()
  } as unknown as RefreshClient
}

describe('MatrixTokenRefreshCoordinator', () => {
  beforeEach(() => {
    hasTauriRuntimeMock.mockReturnValue(false)
    invokeMock.mockReset()
    persistRefreshedTokenMock.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  /** P-26 回归锁：同一 refresh token 的并发调用只能发一次 HTTP，其余合并复用结果。 */
  it('merges concurrent refreshes into a single HTTP request', async () => {
    let resolveRefresh: (value: unknown) => void = () => {}
    const pending = new Promise((resolve) => {
      resolveRefresh = resolve
    })
    const client = createClient(() => pending)

    const first = refreshAccessToken(client, '@user:matrix.test', 'rt1', 'loginWithToken')
    const second = refreshAccessToken(client, '@user:matrix.test', 'rt1', 'tokenManager')

    resolveRefresh({ access_token: 'at2', refresh_token: 'rt2', expires_in_ms: 86_400_000 })

    const [a, b] = await Promise.all([first, second])

    expect(client.refreshToken).toHaveBeenCalledTimes(1)
    expect(a.accessToken).toBe('at2')
    expect(b.accessToken).toBe('at2')
    expect(a.refreshed).toBe(true)
    expect(b.refreshed).toBe(true)
    expect(client.setAccessToken).toHaveBeenCalledWith('at2')
  })

  /** 晚到的调用方不能重放已被轮换掉的旧 refresh token（否则触发 reuse detection）。 */
  it('reuses the recent result for a late caller with the old refresh token', async () => {
    const client = createClient(async () => ({
      access_token: 'at2',
      refresh_token: 'rt2',
      expires_in_ms: 86_400_000
    }))

    const first = await refreshAccessToken(client, '@user:matrix.test', 'rt1', 'loginWithToken')
    const late = await refreshAccessToken(client, '@user:matrix.test', 'rt1', 'tokenManager')

    expect(first.refreshed).toBe(true)
    expect(late.refreshed).toBe(false)
    expect(late.refreshToken).toBe('rt2')
    expect(client.refreshToken).toHaveBeenCalledTimes(1)
  })

  /** 其他窗口已轮换时，直接采用持久化凭证，绝不再用旧 token 发 HTTP。 */
  it('adopts persisted credentials rotated by another window', async () => {
    hasTauriRuntimeMock.mockReturnValue(true)
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'begin_token_refresh') {
        return { status: 'owner' }
      }
      if (command === 'get_user_tokens') {
        return { uid: '@user:matrix.test', token: 'at-rotated', refreshToken: 'rt-rotated' }
      }
      return undefined
    })
    const client = createClient(async () => {
      throw new Error('不应发起 HTTP 刷新')
    })

    const result = await refreshAccessToken(client, '@user:matrix.test', 'rt-old', 'loginWithToken')

    expect(result.refreshed).toBe(false)
    expect(result.accessToken).toBe('at-rotated')
    expect(result.refreshToken).toBe('rt-rotated')
    expect(client.refreshToken).not.toHaveBeenCalled()
    expect(client.setAccessToken).toHaveBeenCalledWith('at-rotated')
    expect(invokeMock).toHaveBeenCalledWith(
      'finish_token_refresh',
      expect.objectContaining({ uid: '@user:matrix.test', token: 'at-rotated', refreshToken: 'rt-rotated' })
    )
  })

  /** 刷新失败必须释放租约，否则其他窗口会一直等待。 */
  it('releases the lease when refresh fails', async () => {
    hasTauriRuntimeMock.mockReturnValue(true)
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'begin_token_refresh') {
        return { status: 'owner' }
      }
      if (command === 'get_user_tokens') {
        return { uid: '@user:matrix.test', token: 'at1', refreshToken: 'rt1' }
      }
      return undefined
    })
    const client = createClient(async () => {
      throw new Error('boom')
    })

    await expect(refreshAccessToken(client, '@user:matrix.test', 'rt1', 'tokenManager')).rejects.toThrow('boom')

    expect(invokeMock).toHaveBeenCalledWith(
      'finish_token_refresh',
      expect.objectContaining({ uid: '@user:matrix.test', token: null, refreshToken: null })
    )
  })
})
