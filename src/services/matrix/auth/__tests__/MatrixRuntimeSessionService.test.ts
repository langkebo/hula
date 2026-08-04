import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionStorePort } from '../MatrixRuntimeSessionService'

const mockInvoke = vi.fn()
const mockEmit = vi.fn()
const mockEnsureAppStateReady = vi.fn()
const mockResizeWindow = vi.fn()
const mockCreateWebviewWindow = vi.fn()
const mockSetBadgeCount = vi.fn()

const mockPort = {
  matrix: {
    getClient: vi.fn(),
    getUserId: vi.fn(() => ''),
    isLoggedIn: vi.fn(() => false),
    isInitialized: vi.fn(() => false),
    getLastError: vi.fn(() => undefined),
    getAccessToken: vi.fn<() => string | undefined>(() => undefined),
    getRefreshToken: vi.fn<() => string | undefined>(() => undefined),
    getHomeserverUrl: vi.fn(() => undefined),
    initialize: vi.fn(),
    login: vi.fn(),
    completeSSOLogin: vi.fn(),
    loginWithToken: vi.fn(),
    logout: vi.fn()
  },
  user: {
    getUserInfo: vi.fn(),
    initUserInfo: vi.fn(),
    setUserInfo: vi.fn(),
    clearUser: vi.fn(),
    fetchUserProfile: vi.fn(),
    updateProfileFields: vi.fn()
  },
  room: {
    getRoomList: vi.fn(() => []),
    getMessages: vi.fn(() => []),
    resetState: vi.fn(),
    setupEventListeners: vi.fn(),
    loadRooms: vi.fn()
  },
  chat: {
    getSessionList: vi.fn(),
    getSessionListValue: vi.fn<() => Array<{ roomId: string }>>(() => [])
  },
  group: {
    clearGroupDetails: vi.fn(),
    clearMembersMap: vi.fn(),
    updateUserPresence: vi.fn()
  },
  contact: {
    updateContactPresence: vi.fn()
  },
  global: {
    getCurrentSessionRoomId: vi.fn(() => undefined),
    updateCurrentSessionRoomId: vi.fn(),
    setTrayMenuShow: vi.fn()
  },
  loginHistory: {
    addLoginHistory: vi.fn()
  },
  emoji: {
    initEmojis: vi.fn(),
    prefetchEmojiToLocal: vi.fn()
  },
  setting: {
    closeAutoLogin: vi.fn()
  }
}

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke
}))

vi.mock('@tauri-apps/api/event', () => ({
  emit: mockEmit
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: {
    getByLabel: vi.fn(async (label: string) => {
      if (label === 'home') {
        return {
          setBadgeCount: mockSetBadgeCount
        }
      }
      return null
    })
  }
}))

vi.mock('@/utils/AppStateReady', () => ({
  ensureAppStateReady: mockEnsureAppStateReady
}))

vi.mock('@/utils/AppHarness', () => ({
  hasTauriRuntime: () => true
}))

vi.mock('@/composables/common/useWindow', () => ({
  useWindow: () => ({
    resizeWindow: mockResizeWindow,
    createWebviewWindow: mockCreateWebviewWindow
  })
}))

vi.mock('@/services/backend/config', () => ({
  resolveMatrixRuntimeEndpointConfig: () => ({
    homeserverUrl: 'https://matrix.example.com',
    identityServerUrl: 'https://identity.example.com'
  }),
  resolveMatrixSessionEndpointConfig: () => ({
    homeserverUrl: 'https://matrix-session.example.com',
    identityServerUrl: 'https://identity-session.example.com'
  }),
  resolveMatrixEndpointConfig: () => ({
    homeserverUrl: 'https://matrix.example.com',
    identityServerUrl: 'https://identity.example.com'
  }),
  saveMatrixSessionEndpointConfig: vi.fn(),
  clearMatrixSessionEndpointConfig: vi.fn()
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isDesktop: () => true,
  isMac: () => true
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: vi.fn((avatar?: string) => avatar || '')
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

vi.mock('@/composables/user/usePresenceHeartbeat', () => ({
  startPresenceHeartbeat: vi.fn(),
  stopPresenceHeartbeat: vi.fn()
}))

vi.mock('@/services/matrix/MatrixWsBridge', () => ({
  matrixWsBridge: {
    start: vi.fn(),
    stop: vi.fn()
  }
}))

vi.mock('@/services/matrix/MatrixWorkerHost', () => ({
  matrixWorkerHost: {
    start: vi.fn().mockResolvedValue(undefined),
    terminate: vi.fn(),
    get isStarted() {
      return false
    }
  }
}))

vi.mock('@/services/matrix/user/MatrixPresenceService', () => ({
  matrixPresenceService: {
    setPresence: vi.fn().mockResolvedValue(undefined),
    onPresenceChange: vi.fn()
  }
}))

vi.mock('@/services/matrix/MatrixClientService', () => {
  const stub = {
    getClient: vi.fn(() => null),
    getConnectionState: vi.fn(() => 'CONNECTED'),
    waitForClientReady: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((event: string, cb: (data: unknown) => void) => {
      // 模拟 sync 事件立即触发，避免 waitSyncPrepared 超时
      if (event === 'sync') {
        Promise.resolve().then(() => cb({ state: 'PREPARED' }))
      }
    }),
    off: vi.fn()
  }
  return { matrixClientService: stub, default: stub }
})

const { MatrixRuntimeSessionService } = await import('../MatrixRuntimeSessionService')

function createService(port: SessionStorePort = mockPort as unknown as SessionStorePort) {
  return new MatrixRuntimeSessionService(port)
}

describe('MatrixRuntimeSessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem('chat', 'cached-chat')
    localStorage.setItem('group', 'cached-group')

    mockPort.matrix.getClient.mockReturnValue({})
    mockPort.matrix.getUserId.mockReturnValue('')
    mockPort.matrix.isLoggedIn.mockReturnValue(false)
    mockPort.matrix.isInitialized.mockReturnValue(false)
    mockPort.matrix.getLastError.mockReturnValue(undefined)
    mockPort.matrix.getAccessToken.mockReturnValue(undefined)
    mockPort.matrix.getRefreshToken.mockReturnValue(undefined)
    mockPort.matrix.getHomeserverUrl.mockReturnValue(undefined)
    mockPort.matrix.initialize.mockResolvedValue(undefined)
    mockPort.matrix.login.mockResolvedValue(true)
    mockPort.matrix.completeSSOLogin.mockResolvedValue(true)
    mockPort.matrix.loginWithToken.mockResolvedValue(true)
    mockPort.matrix.logout.mockResolvedValue(undefined)

    mockPort.user.getUserInfo.mockReturnValue(undefined)
    mockPort.user.initUserInfo.mockReset()
    mockPort.user.setUserInfo.mockReset()
    mockPort.user.clearUser.mockReset()
    mockPort.user.fetchUserProfile.mockResolvedValue(null)
    mockPort.user.updateProfileFields.mockReset()

    mockPort.room.getRoomList.mockReturnValue([])
    mockPort.room.getMessages.mockReturnValue([])
    mockPort.room.resetState.mockReset()
    mockPort.room.setupEventListeners.mockResolvedValue(undefined)
    mockPort.room.loadRooms.mockResolvedValue(undefined)

    mockPort.chat.getSessionList.mockResolvedValue(undefined)
    mockPort.chat.getSessionListValue.mockReturnValue([{ roomId: '!room:example.com' }])

    mockPort.group.clearGroupDetails.mockReset()
    mockPort.group.clearMembersMap.mockReset()
    mockPort.group.updateUserPresence.mockReset()

    mockPort.contact.updateContactPresence.mockReset()

    mockPort.global.getCurrentSessionRoomId.mockReturnValue(undefined)
    mockPort.global.updateCurrentSessionRoomId.mockReset()
    mockPort.global.setTrayMenuShow.mockReset()

    mockPort.loginHistory.addLoginHistory.mockReset()

    mockPort.emoji.initEmojis.mockResolvedValue(undefined)
    mockPort.emoji.prefetchEmojiToLocal.mockResolvedValue(undefined)

    mockPort.setting.closeAutoLogin.mockReset()

    mockEnsureAppStateReady.mockResolvedValue(undefined)
    mockInvoke.mockResolvedValue(undefined)
    mockEmit.mockResolvedValue(undefined)
    mockResizeWindow.mockResolvedValue(undefined)
    mockCreateWebviewWindow.mockResolvedValue(undefined)
    mockSetBadgeCount.mockResolvedValue(undefined)
  })

  it('persists tokens and bootstraps post-login runtime state after password login', async () => {
    mockPort.matrix.getUserId.mockReturnValue('@alice:example.com')
    mockPort.matrix.getAccessToken.mockReturnValue('access-token')

    const service = createService()
    const result = await service.loginWithPassword({
      username: 'alice',
      password: 'secret',
      homeserverUrl: 'https://matrix.example.com',
      identityServerUrl: 'https://identity.example.com',
      deviceName: 'Tjg Client',
      account: 'alice',
      displayName: 'Alice',
      avatar: 'mxc://avatar',
      client: 'PC'
    })

    expect(mockPort.matrix.initialize).toHaveBeenCalledWith({
      homeserverUrl: 'https://matrix.example.com',
      identityServerUrl: 'https://identity.example.com',
      allowInsecureHttp: false
    })
    expect(mockPort.matrix.login).toHaveBeenCalledWith('alice', 'secret', 'Tjg Client')
    expect(mockInvoke).toHaveBeenCalledWith('switch_user_database', { uid: '@alice:example.com' })
    expect(mockInvoke).toHaveBeenCalledWith('update_token', {
      req: {
        uid: '@alice:example.com',
        token: 'access-token',
        refreshToken: ''
      }
    })
    expect(mockInvoke).toHaveBeenCalledWith('save_user_info', {
      userInfo: {
        uid: '@alice:example.com'
      }
    })
    expect(mockPort.room.loadRooms).toHaveBeenCalled()
    expect(mockPort.room.resetState).toHaveBeenCalled()
    expect(mockPort.room.setupEventListeners).toHaveBeenCalled()
    expect(mockPort.chat.getSessionList).toHaveBeenCalledWith(true)
    expect(mockPort.global.updateCurrentSessionRoomId).toHaveBeenCalledWith('!room:example.com')
    expect(mockPort.loginHistory.addLoginHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: '@alice:example.com',
        name: 'Alice',
        account: 'alice',
        avatar: 'mxc://avatar',
        client: 'PC'
      })
    )
    expect(mockPort.user.setUserInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: '@alice:example.com',
        name: 'Alice',
        account: 'alice',
        avatar: 'mxc://avatar',
        client: 'PC'
      })
    )
    expect(localStorage.getItem('chat')).toBeNull()
    expect(localStorage.getItem('group')).toBeNull()
    expect(result).toEqual({
      uid: '@alice:example.com',
      accessToken: 'access-token'
    })
  })

  it('restores runtime state after sso token login with session-bound endpoints', async () => {
    mockPort.matrix.getUserId.mockReturnValue('@sso:example.com')
    mockPort.matrix.getAccessToken.mockReturnValue('sso-access-token')

    const service = createService()
    const result = await service.loginWithSsoToken({
      loginToken: 'login-token',
      account: 'alice',
      displayName: 'Alice SSO',
      avatar: 'mxc://sso-avatar',
      client: 'PC'
    })

    expect(mockPort.matrix.initialize).toHaveBeenCalledWith({
      homeserverUrl: 'https://matrix-session.example.com',
      identityServerUrl: 'https://identity-session.example.com',
      allowInsecureHttp: false
    })
    expect(mockPort.matrix.completeSSOLogin).toHaveBeenCalledWith('login-token')
    expect(mockInvoke).toHaveBeenCalledWith('switch_user_database', { uid: '@sso:example.com' })
    expect(mockInvoke).toHaveBeenCalledWith('update_token', {
      req: {
        uid: '@sso:example.com',
        token: 'sso-access-token',
        refreshToken: ''
      }
    })
    expect(mockPort.loginHistory.addLoginHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: '@sso:example.com',
        name: 'Alice SSO',
        account: 'alice',
        avatar: 'mxc://sso-avatar',
        client: 'PC'
      })
    )
    expect(result).toEqual({
      uid: '@sso:example.com',
      accessToken: 'sso-access-token'
    })
  })

  it('bootstraps runtime state after access-token restore when requested', async () => {
    mockPort.matrix.getUserId.mockReturnValue('@bob:example.com')

    const service = createService()
    await service.restoreWithAccessToken({
      uid: '@bob:example.com',
      accessToken: 'restored-token',
      refreshToken: 'refresh-token',
      displayName: 'Bob',
      account: 'bob',
      client: 'PC',
      persistTokens: true,
      bootstrapAfterRestore: true
    })

    expect(mockPort.matrix.initialize).toHaveBeenCalledWith({
      homeserverUrl: 'https://matrix-session.example.com',
      identityServerUrl: 'https://identity-session.example.com',
      accessToken: 'restored-token',
      userId: '@bob:example.com',
      allowInsecureHttp: false
    })
    expect(mockPort.matrix.loginWithToken).toHaveBeenCalledWith('restored-token', '@bob:example.com', 'refresh-token')
    expect(mockPort.user.initUserInfo).toHaveBeenCalledWith('@bob:example.com', 'Bob')
    expect(mockInvoke).toHaveBeenCalledWith('update_token', {
      req: {
        uid: '@bob:example.com',
        token: 'restored-token',
        refreshToken: 'refresh-token'
      }
    })
    expect(mockPort.user.setUserInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: '@bob:example.com',
        name: 'Bob',
        account: 'bob',
        client: 'PC'
      })
    )
    expect(mockPort.room.resetState).toHaveBeenCalled()
    expect(mockPort.room.loadRooms).toHaveBeenCalled()
    expect(mockPort.room.setupEventListeners).toHaveBeenCalled()
    expect(mockPort.chat.getSessionList).toHaveBeenCalledWith(true)
    expect(mockPort.global.updateCurrentSessionRoomId).toHaveBeenCalledWith('!room:example.com')
  })

  it('restores matrix client before bootstrapping when current window client is missing', async () => {
    mockPort.matrix.getClient.mockReturnValue(null)
    mockPort.matrix.getUserId.mockReturnValue('@carol:example.com')
    mockPort.user.getUserInfo.mockReturnValue({
      uid: '@carol:example.com',
      name: 'Carol',
      account: 'carol',
      email: 'carol@example.com',
      avatar: 'mxc://carol',
      client: 'PC'
    } as any)
    mockInvoke.mockImplementation(async (command: string) => {
      if (command === 'get_user_tokens') {
        return {
          token: 'stored-token',
          refreshToken: 'stored-refresh-token'
        }
      }
      return undefined
    })

    const service = createService()
    await service.bootstrapPostLoginState({
      account: 'carol',
      displayName: 'Carol',
      avatar: 'mxc://carol',
      client: 'PC'
    })

    expect(mockPort.matrix.initialize).toHaveBeenCalledWith({
      homeserverUrl: 'https://matrix-session.example.com',
      identityServerUrl: 'https://identity-session.example.com',
      accessToken: 'stored-token',
      userId: '@carol:example.com',
      allowInsecureHttp: false
    })
    expect(mockPort.matrix.loginWithToken).toHaveBeenCalledWith(
      'stored-token',
      '@carol:example.com',
      'stored-refresh-token'
    )
    expect(mockPort.room.resetState).toHaveBeenCalled()
    expect(mockPort.room.loadRooms).toHaveBeenCalled()
    expect(mockPort.room.setupEventListeners).toHaveBeenCalled()
    expect(mockPort.chat.getSessionList).toHaveBeenCalledWith(true)
    expect(mockPort.global.updateCurrentSessionRoomId).toHaveBeenCalledWith('!room:example.com')
  })

  it('reuses runtime tokens for bootstrap restore when access token persistence is disabled', async () => {
    mockPort.matrix.getClient.mockReturnValue(null)
    mockPort.matrix.getUserId.mockReturnValue('@dave:example.com')
    mockPort.matrix.getAccessToken.mockReturnValue('runtime-token')
    mockPort.matrix.getRefreshToken.mockReturnValue('runtime-refresh-token')
    mockPort.user.getUserInfo.mockReturnValue({
      uid: '@dave:example.com',
      name: 'Dave',
      account: 'dave',
      email: 'dave@example.com',
      avatar: 'mxc://dave',
      client: 'PC'
    } as any)

    const service = createService()
    await service.bootstrapPostLoginState({
      account: 'dave',
      displayName: 'Dave',
      avatar: 'mxc://dave',
      client: 'PC'
    })

    expect(mockPort.matrix.initialize).toHaveBeenCalledWith({
      homeserverUrl: 'https://matrix-session.example.com',
      identityServerUrl: 'https://identity-session.example.com',
      accessToken: 'runtime-token',
      userId: '@dave:example.com',
      allowInsecureHttp: false
    })
    expect(mockPort.matrix.loginWithToken).toHaveBeenCalledWith(
      'runtime-token',
      '@dave:example.com',
      'runtime-refresh-token'
    )
    expect(mockInvoke).not.toHaveBeenCalledWith('get_user_tokens', undefined)
    expect(mockInvoke).not.toHaveBeenCalledWith('switch_user_database', expect.anything())
  })

  it('resets local state and completes desktop logout flow', async () => {
    localStorage.setItem('user', 'alice')
    localStorage.setItem('TOKEN', 'access-token')
    localStorage.setItem('REFRESH_TOKEN', 'refresh-token')

    const service = createService()
    await service.logoutCurrentSession()

    expect(mockInvoke).toHaveBeenCalledWith('remove_tokens', undefined)
    expect(mockPort.setting.closeAutoLogin).toHaveBeenCalledTimes(1)
    expect(mockPort.user.clearUser).toHaveBeenCalledTimes(1)
    expect(mockPort.global.updateCurrentSessionRoomId).toHaveBeenCalledWith('')
    expect(mockPort.matrix.logout).toHaveBeenCalledTimes(1)
    expect(mockCreateWebviewWindow).toHaveBeenCalledWith('登录', 'login', 320, 448, undefined, false, 320, 448)
    expect(mockEmit).toHaveBeenCalledWith('logout')
    expect(mockResizeWindow).toHaveBeenCalledWith('tray', 130, 44)
    expect(mockSetBadgeCount).toHaveBeenCalledWith(undefined)
    expect(localStorage.getItem('user')).toBeNull()
    expect(localStorage.getItem('TOKEN')).toBeNull()
    expect(localStorage.getItem('REFRESH_TOKEN')).toBeNull()
  })

  it('treats logged-in runtime as authenticated without reading tokens', async () => {
    mockPort.matrix.isLoggedIn.mockReturnValue(true)

    const service = createService()
    const authenticated = await service.hasAuthenticatedSession()

    expect(authenticated).toBe(true)
    expect(mockInvoke).not.toHaveBeenCalledWith('get_user_tokens')
  })

  it('allows startup token fallback before runtime initialization', async () => {
    mockPort.matrix.isLoggedIn.mockReturnValue(false)
    mockPort.matrix.isInitialized.mockReturnValue(false)
    mockInvoke.mockResolvedValueOnce({
      token: 'startup-token',
      refreshToken: null
    })

    const service = createService()
    const authenticated = await service.hasAuthenticatedSession()

    expect(authenticated).toBe(true)
    expect(mockInvoke).toHaveBeenCalledWith('get_user_tokens', undefined)
  })

  it('rejects token-only auth after runtime initialized', async () => {
    mockPort.matrix.isLoggedIn.mockReturnValue(false)
    mockPort.matrix.isInitialized.mockReturnValue(true)
    mockInvoke.mockResolvedValueOnce({
      token: 'stale-token',
      refreshToken: null
    })

    const service = createService()
    const authenticated = await service.hasAuthenticatedSession()

    expect(authenticated).toBe(false)
    expect(mockInvoke).not.toHaveBeenCalledWith('get_user_tokens')
  })
})
