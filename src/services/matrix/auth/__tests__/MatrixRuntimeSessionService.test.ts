import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockInvoke = vi.fn()
const mockEmit = vi.fn()
const mockEnsureAppStateReady = vi.fn()
const mockResizeWindow = vi.fn()
const mockCreateWebviewWindow = vi.fn()
const mockSetBadgeCount = vi.fn()

const mockMatrixStore = {
  isLoggedIn: false,
  isInitialized: false,
  userId: '',
  accessToken: '',
  initialize: vi.fn(),
  login: vi.fn(),
  loginWithToken: vi.fn(),
  logout: vi.fn()
}

const mockUserStore = {
  userInfo: null as any,
  initUserInfo: vi.fn(),
  clearUser: vi.fn()
}

const mockGroupStore = {
  membersMap: {} as Record<string, unknown>,
  groupDetails: [] as unknown[]
}

const mockRoomStore = {
  rooms: new Map<string, unknown>(),
  loadRooms: vi.fn()
}

const mockConfigStore = {
  config: null as any,
  initConfig: vi.fn()
}

const mockLoginHistoriesStore = {
  addLoginHistory: vi.fn()
}

const mockEmojiStore = {
  initEmojis: vi.fn(),
  prefetchEmojiToLocal: vi.fn()
}

const mockGlobalStore = {
  isTrayMenuShow: false,
  updateCurrentSessionRoomId: vi.fn()
}

const mockSettingStore = {
  closeAutoLogin: vi.fn()
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

vi.mock('@/hooks/useWindow', () => ({
  useWindow: () => ({
    resizeWindow: mockResizeWindow,
    createWebviewWindow: mockCreateWebviewWindow
  })
}))

vi.mock('@/stores/domains/chat/matrix', () => ({
  useMatrixStore: () => mockMatrixStore
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => mockUserStore
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => mockSettingStore
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => mockGroupStore
}))

vi.mock('@/stores/domains/chat/room', () => ({
  useRoomStore: () => mockRoomStore
}))

vi.mock('@/stores/domains/settings/config', () => ({
  useConfigStore: () => mockConfigStore
}))

vi.mock('@/stores/domains/user/loginHistory', () => ({
  useLoginHistoriesStore: () => mockLoginHistoriesStore
}))

vi.mock('@/stores/domains/chat/emoji', () => ({
  useEmojiStore: () => mockEmojiStore
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => mockGlobalStore
}))

vi.mock('@/services/backend/config', () => ({
  resolveMatrixEndpointConfig: () => ({
    homeserverUrl: 'https://matrix.example.com',
    identityServerUrl: 'https://identity.example.com'
  })
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
    warn: vi.fn(),
    error: vi.fn()
  })
}))

const { matrixRuntimeSessionService } = await import('../MatrixRuntimeSessionService')

describe('MatrixRuntimeSessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    localStorage.setItem('chat', 'cached-chat')
    localStorage.setItem('group', 'cached-group')

    mockMatrixStore.isLoggedIn = false
    mockMatrixStore.isInitialized = false
    mockMatrixStore.userId = ''
    mockMatrixStore.accessToken = ''
    mockMatrixStore.initialize.mockResolvedValue(undefined)
    mockMatrixStore.login.mockResolvedValue(true)
    mockMatrixStore.loginWithToken.mockResolvedValue(true)
    mockMatrixStore.logout.mockResolvedValue(undefined)

    mockUserStore.userInfo = null
    mockUserStore.clearUser.mockReset()
    mockGroupStore.membersMap = { '@alice:example.com': { name: 'Alice' } }
    mockGroupStore.groupDetails = ['old-group']
    mockRoomStore.rooms = new Map([['old-room', {}]])
    mockRoomStore.loadRooms.mockResolvedValue(undefined)
    mockConfigStore.config = null
    mockConfigStore.initConfig.mockResolvedValue(undefined)
    mockLoginHistoriesStore.addLoginHistory.mockReset()
    mockEmojiStore.initEmojis.mockResolvedValue(undefined)
    mockEmojiStore.prefetchEmojiToLocal.mockResolvedValue(undefined)
    mockGlobalStore.isTrayMenuShow = false
    mockGlobalStore.updateCurrentSessionRoomId.mockReset()
    mockSettingStore.closeAutoLogin.mockReset()
    mockEnsureAppStateReady.mockResolvedValue(undefined)
    mockInvoke.mockResolvedValue(undefined)
    mockEmit.mockResolvedValue(undefined)
    mockResizeWindow.mockResolvedValue(undefined)
    mockCreateWebviewWindow.mockResolvedValue(undefined)
    mockSetBadgeCount.mockResolvedValue(undefined)
  })

  it('persists tokens and bootstraps post-login runtime state after password login', async () => {
    mockMatrixStore.userId = '@alice:example.com'
    mockMatrixStore.accessToken = 'access-token'

    const result = await matrixRuntimeSessionService.loginWithPassword({
      username: 'alice',
      password: 'secret',
      homeserverUrl: 'https://matrix.example.com',
      identityServerUrl: 'https://identity.example.com',
      deviceName: 'HuLa Client',
      account: 'alice',
      displayName: 'Alice',
      avatar: 'mxc://avatar',
      client: 'PC'
    })

    expect(mockMatrixStore.initialize).toHaveBeenCalledWith({
      homeserverUrl: 'https://matrix.example.com',
      identityServerUrl: 'https://identity.example.com'
    })
    expect(mockMatrixStore.login).toHaveBeenCalledWith('alice', 'secret', 'HuLa Client')
    expect(mockInvoke).toHaveBeenCalledWith('switch_user_database', { uid: '@alice:example.com' })
    expect(mockInvoke).toHaveBeenCalledWith('update_token', {
      uid: '@alice:example.com',
      token: 'access-token',
      refreshToken: ''
    })
    expect(mockInvoke).toHaveBeenCalledWith('save_user_info', {
      userInfo: {
        uid: '@alice:example.com'
      }
    })
    expect(mockRoomStore.loadRooms).toHaveBeenCalled()
    expect(mockLoginHistoriesStore.addLoginHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: '@alice:example.com',
        name: 'Alice',
        account: 'alice',
        avatar: 'mxc://avatar',
        client: 'PC'
      })
    )
    expect(mockUserStore.userInfo).toEqual(
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

  it('bootstraps runtime state after access-token restore when requested', async () => {
    mockMatrixStore.userId = '@bob:example.com'

    await matrixRuntimeSessionService.restoreWithAccessToken({
      uid: '@bob:example.com',
      accessToken: 'restored-token',
      refreshToken: 'refresh-token',
      displayName: 'Bob',
      account: 'bob',
      client: 'PC',
      persistTokens: true,
      bootstrapAfterRestore: true
    })

    expect(mockMatrixStore.initialize).toHaveBeenCalledWith({
      homeserverUrl: 'https://matrix.example.com',
      identityServerUrl: 'https://identity.example.com',
      accessToken: 'restored-token',
      userId: '@bob:example.com'
    })
    expect(mockMatrixStore.loginWithToken).toHaveBeenCalledWith('restored-token', '@bob:example.com')
    expect(mockUserStore.initUserInfo).toHaveBeenCalledWith('@bob:example.com', 'Bob')
    expect(mockInvoke).toHaveBeenCalledWith('update_token', {
      uid: '@bob:example.com',
      token: 'restored-token',
      refreshToken: 'refresh-token'
    })
    expect(mockUserStore.userInfo).toEqual(
      expect.objectContaining({
        uid: '@bob:example.com',
        name: 'Bob',
        account: 'bob',
        client: 'PC'
      })
    )
    expect(mockRoomStore.loadRooms).toHaveBeenCalled()
  })

  it('resets local state and completes desktop logout flow', async () => {
    localStorage.setItem('user', 'alice')
    localStorage.setItem('TOKEN', 'access-token')
    localStorage.setItem('REFRESH_TOKEN', 'refresh-token')

    await matrixRuntimeSessionService.logoutCurrentSession()

    expect(mockInvoke).toHaveBeenCalledWith('remove_tokens')
    expect(mockSettingStore.closeAutoLogin).toHaveBeenCalledTimes(1)
    expect(mockUserStore.clearUser).toHaveBeenCalledTimes(1)
    expect(mockGlobalStore.updateCurrentSessionRoomId).toHaveBeenCalledWith('')
    expect(mockMatrixStore.logout).toHaveBeenCalledTimes(1)
    expect(mockCreateWebviewWindow).toHaveBeenCalledWith('登录', 'login', 320, 448, undefined, false, 320, 448)
    expect(mockEmit).toHaveBeenCalledWith('logout')
    expect(mockResizeWindow).toHaveBeenCalledWith('tray', 130, 44)
    expect(mockSetBadgeCount).toHaveBeenCalledWith(undefined)
    expect(localStorage.getItem('user')).toBeNull()
    expect(localStorage.getItem('TOKEN')).toBeNull()
    expect(localStorage.getItem('REFRESH_TOKEN')).toBeNull()
  })

  it('treats logged-in runtime as authenticated without reading tokens', async () => {
    mockMatrixStore.isLoggedIn = true

    const authenticated = await matrixRuntimeSessionService.hasAuthenticatedSession()

    expect(authenticated).toBe(true)
    expect(mockInvoke).not.toHaveBeenCalledWith('get_user_tokens')
  })

  it('allows startup token fallback before runtime initialization', async () => {
    mockMatrixStore.isLoggedIn = false
    mockMatrixStore.isInitialized = false
    mockInvoke.mockResolvedValueOnce({
      token: 'startup-token',
      refreshToken: null
    })

    const authenticated = await matrixRuntimeSessionService.hasAuthenticatedSession()

    expect(authenticated).toBe(true)
    expect(mockInvoke).toHaveBeenCalledWith('get_user_tokens')
  })

  it('rejects token-only auth after runtime initialized', async () => {
    mockMatrixStore.isLoggedIn = false
    mockMatrixStore.isInitialized = true
    mockInvoke.mockResolvedValueOnce({
      token: 'stale-token',
      refreshToken: null
    })

    const authenticated = await matrixRuntimeSessionService.hasAuthenticatedSession()

    expect(authenticated).toBe(false)
    expect(mockInvoke).not.toHaveBeenCalledWith('get_user_tokens')
  })
})
