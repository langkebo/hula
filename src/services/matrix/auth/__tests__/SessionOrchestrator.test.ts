import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getMatrixClientMock,
  getMatrixSessionSnapshotMock,
  getCurrentSessionRoomIdMock,
  setCurrentSessionRoomIdMock,
  getCurrentUserInfoMock,
  setCurrentUserInfoMock,
  clearCurrentUserStateMock,
  patchCurrentUserInfoFieldsMock,
  setTrayMenuShowMock,
  matrixStoreMock,
  userStoreMock,
  roomStoreMock,
  chatStoreMock,
  groupStoreMock,
  contactStoreMock,
  loginHistoryStoreMock,
  emojiStoreMock,
  settingStoreMock
} = vi.hoisted(() => ({
  getMatrixClientMock: vi.fn(),
  getMatrixSessionSnapshotMock: vi.fn(),
  getCurrentSessionRoomIdMock: vi.fn(),
  setCurrentSessionRoomIdMock: vi.fn(),
  getCurrentUserInfoMock: vi.fn(),
  setCurrentUserInfoMock: vi.fn(),
  clearCurrentUserStateMock: vi.fn(),
  patchCurrentUserInfoFieldsMock: vi.fn(),
  setTrayMenuShowMock: vi.fn(),
  matrixStoreMock: {
    isInitialized: false,
    lastError: null as string | null,
    userId: null as string | null,
    accessToken: null as string | null,
    homeserverUrl: null as string | null,
    refreshToken: undefined as string | undefined,
    getClient: vi.fn(),
    initialize: vi.fn(),
    login: vi.fn(),
    completeSSOLogin: vi.fn(),
    loginWithToken: vi.fn(),
    logout: vi.fn()
  },
  userStoreMock: {
    initUserInfo: vi.fn(),
    fetchUserProfile: vi.fn()
  },
  roomStoreMock: {
    roomList: [],
    resetState: vi.fn(),
    setupEventListeners: vi.fn(),
    loadRooms: vi.fn()
  },
  chatStoreMock: {
    chatMessageListByRoomId: vi.fn(),
    getSessionList: vi.fn(),
    sessionList: []
  },
  groupStoreMock: {
    groupDetails: [] as unknown[],
    membersMap: {} as Record<string, unknown>,
    updateUserPresence: vi.fn()
  },
  contactStoreMock: {
    updateContactPresence: vi.fn()
  },
  loginHistoryStoreMock: {
    addLoginHistory: vi.fn()
  },
  emojiStoreMock: {
    initEmojis: vi.fn(),
    prefetchEmojiToLocal: vi.fn()
  },
  settingStoreMock: {
    closeAutoLogin: vi.fn()
  }
}))

vi.mock('@/common/currentSessionRoomState', () => ({
  getCurrentSessionRoomId: getCurrentSessionRoomIdMock,
  setCurrentSessionRoomId: setCurrentSessionRoomIdMock
}))

vi.mock('@/common/currentUserState', () => ({
  getCurrentUserInfo: getCurrentUserInfoMock,
  setCurrentUserInfo: setCurrentUserInfoMock,
  clearCurrentUserState: clearCurrentUserStateMock,
  patchCurrentUserInfoFields: patchCurrentUserInfoFieldsMock
}))

vi.mock('@/common/globalUiState', () => ({
  setTrayMenuShow: setTrayMenuShowMock
}))

vi.mock('@/services/matrix/matrixClientAccessor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/matrix/matrixClientAccessor')>()
  return {
    ...actual,
    getMatrixClient: getMatrixClientMock
  }
})

vi.mock('@/services/matrix/matrixSessionState', () => ({
  getMatrixSessionSnapshot: getMatrixSessionSnapshotMock
}))

vi.mock('@/stores/domains/chat/matrix', () => ({
  useMatrixStore: vi.fn(() => matrixStoreMock)
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: vi.fn(() => userStoreMock)
}))

vi.mock('@/stores/domains/chat/room', () => ({
  useRoomStore: vi.fn(() => roomStoreMock)
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: vi.fn(() => chatStoreMock)
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: vi.fn(() => groupStoreMock)
}))

vi.mock('@/stores/domains/chat/contacts', () => ({
  useContactStore: vi.fn(() => contactStoreMock)
}))

vi.mock('@/stores/domains/user/loginHistory', () => ({
  useLoginHistoriesStore: vi.fn(() => loginHistoryStoreMock)
}))

vi.mock('@/stores/domains/chat/emoji', () => ({
  useEmojiStore: vi.fn(() => emojiStoreMock)
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: vi.fn(() => settingStoreMock)
}))

vi.mock('../MatrixRuntimeSessionService', () => ({
  MatrixRuntimeSessionService: class {
    constructor(public port: unknown) {}
  }
}))

const { createSessionStorePort } = await import('../SessionOrchestrator')

describe('createSessionStorePort', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matrixStoreMock.userId = null
    matrixStoreMock.accessToken = null
    matrixStoreMock.homeserverUrl = null
    matrixStoreMock.getClient.mockReset()
    matrixStoreMock.getClient.mockReturnValue(null)
    getMatrixSessionSnapshotMock.mockReturnValue({
      userId: '@alice:example.com',
      accessToken: 'token',
      homeserverUrl: 'https://matrix.example.com'
    })
    getCurrentUserInfoMock.mockReturnValue({
      uid: '@alice:example.com',
      name: 'Alice'
    })
    getCurrentSessionRoomIdMock.mockReturnValue('!room:example.com')
  })

  it('reads matrix data from accessor and session snapshot', () => {
    const port = createSessionStorePort()

    port.matrix.getClient()
    expect(getMatrixClientMock).toHaveBeenCalledTimes(1)
    expect(port.matrix.getUserId()).toBe('@alice:example.com')
    expect(port.matrix.getAccessToken()).toBe('token')
    expect(port.matrix.getHomeserverUrl()).toBe('https://matrix.example.com')
    expect(port.matrix.isLoggedIn()).toBe(true)
  })

  it('returns null from getClient when the accessor is not registered', () => {
    getMatrixClientMock.mockReturnValue(null)

    const port = createSessionStorePort()

    expect(port.matrix.getClient()).toBeNull()
  })

  it('falls back to matrix store session fields when lightweight snapshot is not ready', () => {
    getMatrixSessionSnapshotMock.mockReturnValue({
      userId: null,
      accessToken: null,
      homeserverUrl: null
    })
    matrixStoreMock.userId = '@restore:example.com'
    matrixStoreMock.accessToken = 'restore-token'
    matrixStoreMock.homeserverUrl = 'https://restore.example.com'

    const port = createSessionStorePort()

    expect(port.matrix.getUserId()).toBe('@restore:example.com')
    expect(port.matrix.getAccessToken()).toBe('restore-token')
    expect(port.matrix.getHomeserverUrl()).toBe('https://restore.example.com')
    expect(port.matrix.isLoggedIn()).toBe(true)
  })

  it('reads and updates user data through shared user state helpers', () => {
    const port = createSessionStorePort()
    const info = { uid: '@bob:example.com' } as any

    expect(port.user.getUserInfo()).toEqual({
      uid: '@alice:example.com',
      name: 'Alice'
    })

    port.user.setUserInfo(info)
    port.user.clearUser()
    port.user.updateProfileFields({ name: 'Bob' })

    expect(setCurrentUserInfoMock).toHaveBeenCalledWith(info)
    expect(clearCurrentUserStateMock).toHaveBeenCalledTimes(1)
    expect(patchCurrentUserInfoFieldsMock).toHaveBeenCalledWith({ name: 'Bob' })
  })

  it('routes global room selection and tray UI writes through lightweight state helpers', () => {
    const port = createSessionStorePort()

    expect(port.global.getCurrentSessionRoomId()).toBe('!room:example.com')
    port.global.updateCurrentSessionRoomId('!next:example.com')
    port.global.setTrayMenuShow(true)

    expect(setCurrentSessionRoomIdMock).toHaveBeenCalledWith('!next:example.com')
    expect(setTrayMenuShowMock).toHaveBeenCalledWith(true)
  })
})
