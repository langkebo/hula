import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEnsureAppStateReady = vi.fn()

const mockMatrixStore = {
  userId: '',
  accessToken: ''
}

const mockUserStore = {
  userInfo: null as null | {
    uid?: string
  }
}

const mockMatrixRuntimeSessionService = {
  getStoredTokens: vi.fn(),
  restoreWithAccessToken: vi.fn(),
  completeDesktopLoginTransition: vi.fn()
}

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@/utils/AppStateReady', () => ({
  ensureAppStateReady: mockEnsureAppStateReady
}))

vi.mock('../matrix', () => ({
  matrixRuntimeSessionService: mockMatrixRuntimeSessionService
}))

vi.mock('../../stores/domains/chat/matrix', () => ({
  useMatrixStore: () => mockMatrixStore
}))

vi.mock('../../stores/domains/user/user', () => ({
  useUserStore: () => mockUserStore
}))

const { loginCommand } = await import('../tauriCommand')

describe('loginCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMatrixStore.userId = ''
    mockUserStore.userInfo = null
    mockEnsureAppStateReady.mockResolvedValue(undefined)
    mockMatrixRuntimeSessionService.getStoredTokens.mockResolvedValue({
      token: 'access-token',
      refreshToken: 'refresh-token'
    })
    mockMatrixRuntimeSessionService.restoreWithAccessToken.mockResolvedValue(undefined)
    mockMatrixRuntimeSessionService.completeDesktopLoginTransition.mockResolvedValue(undefined)
  })

  it('restores the desktop session with stored tokens and completes transition', async () => {
    await loginCommand({
      uid: '@alice:example.com',
      account: 'alice',
      name: 'Alice'
    })

    expect(mockEnsureAppStateReady).toHaveBeenCalledTimes(1)
    expect(mockMatrixRuntimeSessionService.getStoredTokens).toHaveBeenCalledTimes(1)
    expect(mockMatrixRuntimeSessionService.restoreWithAccessToken).toHaveBeenCalledWith({
      uid: '@alice:example.com',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      displayName: 'Alice',
      account: 'alice',
      client: 'PC',
      bootstrapAfterRestore: true
    })
    expect(mockMatrixRuntimeSessionService.completeDesktopLoginTransition).toHaveBeenCalledTimes(1)
  })

  it('falls back to store uid when caller does not provide one', async () => {
    mockUserStore.userInfo = {
      uid: '@bob:example.com'
    }

    await loginCommand({})

    expect(mockMatrixRuntimeSessionService.restoreWithAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: '@bob:example.com'
      })
    )
  })

  it('throws when access token is missing', async () => {
    mockUserStore.userInfo = {
      uid: '@carol:example.com'
    }
    mockMatrixRuntimeSessionService.getStoredTokens.mockResolvedValue({
      token: '',
      refreshToken: ''
    })

    await expect(loginCommand({})).rejects.toThrow('缺少访问令牌，无法恢复登录会话')
    expect(mockMatrixRuntimeSessionService.restoreWithAccessToken).not.toHaveBeenCalled()
  })
})
