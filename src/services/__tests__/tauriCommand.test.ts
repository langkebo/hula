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

const mockSessionOrchestrator = {
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

vi.mock('../matrix/auth/SessionOrchestrator', () => ({
  sessionOrchestrator: mockSessionOrchestrator
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
    mockSessionOrchestrator.getStoredTokens.mockResolvedValue({
      token: 'access-token',
      refreshToken: 'refresh-token'
    })
    mockSessionOrchestrator.restoreWithAccessToken.mockResolvedValue(undefined)
    mockSessionOrchestrator.completeDesktopLoginTransition.mockResolvedValue(undefined)
  })

  it('restores the desktop session with stored tokens and completes transition', async () => {
    await loginCommand({
      uid: '@alice:example.com',
      account: 'alice',
      name: 'Alice'
    })

    expect(mockEnsureAppStateReady).toHaveBeenCalledTimes(1)
    expect(mockSessionOrchestrator.getStoredTokens).toHaveBeenCalledTimes(1)
    expect(mockSessionOrchestrator.restoreWithAccessToken).toHaveBeenCalledWith({
      uid: '@alice:example.com',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      displayName: 'Alice',
      account: 'alice',
      client: 'PC',
      bootstrapAfterRestore: true
    })
    expect(mockSessionOrchestrator.completeDesktopLoginTransition).toHaveBeenCalledTimes(1)
  })

  it('falls back to store uid when caller does not provide one', async () => {
    mockUserStore.userInfo = {
      uid: '@bob:example.com'
    }

    await loginCommand({})

    expect(mockSessionOrchestrator.restoreWithAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: '@bob:example.com'
      })
    )
  })

  it('throws when access token is missing', async () => {
    mockUserStore.userInfo = {
      uid: '@carol:example.com'
    }
    mockSessionOrchestrator.getStoredTokens.mockResolvedValue({
      token: '',
      refreshToken: ''
    })

    await expect(loginCommand({})).rejects.toThrow('缺少访问令牌，无法恢复登录会话')
    expect(mockSessionOrchestrator.restoreWithAccessToken).not.toHaveBeenCalled()
  })
})
