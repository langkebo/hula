import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MsgEnum, OnlineEnum } from '@/enums'
import { SessionBootstrapService } from '../SessionBootstrapService'
import type { MatrixPostLoginBootstrapOptions, SessionRuntimeHost } from '../sessionRuntimeInternal'
import { SessionRuntimeState } from '../sessionRuntimeInternal'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('@/composables/user/usePresenceHeartbeat', () => ({
  startPresenceHeartbeat: vi.fn()
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

vi.mock('@/services/backend/config', () => ({
  resolveMatrixSessionEndpointConfig: () => ({
    homeserverUrl: 'https://matrix.test',
    identityServerUrl: 'https://id.test'
  })
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn().mockReturnValue(null),
    waitForClientReady: vi.fn().mockResolvedValue({})
  }
}))

vi.mock('@/services/matrix/MatrixWorkerHost', () => ({
  matrixWorkerHost: {
    start: vi.fn().mockResolvedValue(undefined),
    bootstrapSearchRooms: vi.fn().mockResolvedValue(undefined),
    bootstrapSearchEvents: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('@/services/matrix/MatrixWsBridge', () => ({
  matrixWsBridge: {
    start: vi.fn()
  }
}))

vi.mock('@/services/matrix/user/MatrixPresenceService', () => ({
  matrixPresenceService: {
    setPresence: vi.fn().mockResolvedValue(undefined),
    onPresenceChange: vi.fn().mockReturnValue(vi.fn())
  }
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: (url?: string) => url ?? ''
  }
}))

vi.mock('@/utils/extensionHealth', () => ({
  reportExtensionDegradationToUi: vi.fn()
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isDesktop: () => true
}))

vi.mock('@/utils/presenceStatus', () => ({
  buildPresenceStorePatch: (presence: { presence?: string }) => ({
    activeStatus: OnlineEnum.ONLINE,
    lastOptTime: 12345,
    presence: presence.presence
  })
}))

vi.mock('@/utils/userIdentity', () => ({
  toLocalpart: (s: string) => s.split(':')[0].replace('@', '')
}))

function createMockHost(overrides?: Partial<SessionRuntimeHost>): {
  host: SessionRuntimeHost
  mocks: Record<string, ReturnType<typeof vi.fn>>
} {
  const mocks = {
    getClient: vi.fn().mockReturnValue(null),
    getUserId: vi.fn().mockReturnValue('@alice:matrix.test'),
    getAccessToken: vi.fn().mockReturnValue(undefined),
    getRefreshToken: vi.fn().mockReturnValue(undefined),
    getHomeserverUrl: vi.fn().mockReturnValue('https://matrix.test'),
    restoreWithAccessToken: vi.fn().mockResolvedValue(undefined),
    getStoredTokens: vi
      .fn()
      .mockResolvedValue({ uid: '@alice:matrix.test', token: 'stored-token', refreshToken: null }),
    waitSyncPrepared: vi.fn().mockResolvedValue(undefined),
    resolveDisplayName: vi.fn().mockReturnValue('Alice'),
    clearUserLocalStorage: vi.fn(),
    clearMessageCache: vi.fn(),
    getCurrentClientDeviceId: vi.fn().mockReturnValue('DEV1'),
    resetLocalSessionState: vi.fn().mockResolvedValue(undefined),
    bootstrapPostLoginState: vi.fn().mockResolvedValue(undefined),
    getUserInfo: vi.fn().mockReturnValue(undefined),
    setUserInfo: vi.fn(),
    fetchUserProfile: vi.fn().mockResolvedValue(null),
    updateProfileFields: vi.fn(),
    addLoginHistory: vi.fn(),
    getRoomList: vi.fn().mockReturnValue([]),
    getMessages: vi.fn().mockReturnValue([]),
    resetState: vi.fn(),
    setupEventListeners: vi.fn().mockResolvedValue(undefined),
    loadRooms: vi.fn().mockResolvedValue(true),
    getSessionList: vi.fn().mockResolvedValue(undefined),
    getSessionListValue: vi.fn().mockReturnValue([]),
    getCurrentSessionRoomId: vi.fn().mockReturnValue(undefined),
    updateCurrentSessionRoomId: vi.fn(),
    clearGroupDetails: vi.fn(),
    clearMembersMap: vi.fn(),
    updateUserPresence: vi.fn(),
    updateContactPresence: vi.fn(),
    initEmojis: vi.fn().mockResolvedValue(undefined),
    prefetchEmojiToLocal: vi.fn().mockResolvedValue(undefined),
    closeAutoLogin: vi.fn(),
    setTrayMenuShow: vi.fn(),
    initUserInfo: vi.fn(),
    clearUser: vi.fn()
  }

  const port = {
    matrix: {
      getClient: mocks.getClient,
      getUserId: mocks.getUserId,
      isLoggedIn: vi.fn().mockReturnValue(true),
      isInitialized: vi.fn().mockReturnValue(true),
      getLastError: vi.fn().mockReturnValue(undefined),
      getAccessToken: mocks.getAccessToken,
      getRefreshToken: mocks.getRefreshToken,
      getHomeserverUrl: mocks.getHomeserverUrl,
      initialize: vi.fn().mockResolvedValue(undefined),
      login: vi.fn().mockResolvedValue(true),
      completeSSOLogin: vi.fn().mockResolvedValue(true),
      loginWithToken: vi.fn().mockResolvedValue(true),
      logout: vi.fn().mockResolvedValue(undefined)
    },
    user: {
      getUserInfo: mocks.getUserInfo,
      setUserInfo: mocks.setUserInfo,
      initUserInfo: mocks.initUserInfo,
      clearUser: mocks.clearUser,
      fetchUserProfile: mocks.fetchUserProfile,
      updateProfileFields: mocks.updateProfileFields
    },
    room: {
      getRoomList: mocks.getRoomList,
      getMessages: mocks.getMessages,
      resetState: mocks.resetState,
      setupEventListeners: mocks.setupEventListeners,
      loadRooms: mocks.loadRooms
    },
    chat: {
      getSessionList: mocks.getSessionList,
      getSessionListValue: mocks.getSessionListValue
    },
    group: {
      clearGroupDetails: mocks.clearGroupDetails,
      clearMembersMap: mocks.clearMembersMap,
      updateUserPresence: mocks.updateUserPresence
    },
    contact: {
      updateContactPresence: mocks.updateContactPresence
    },
    global: {
      getCurrentSessionRoomId: mocks.getCurrentSessionRoomId,
      updateCurrentSessionRoomId: mocks.updateCurrentSessionRoomId,
      setTrayMenuShow: mocks.setTrayMenuShow
    },
    loginHistory: {
      addLoginHistory: mocks.addLoginHistory
    },
    emoji: {
      initEmojis: mocks.initEmojis,
      prefetchEmojiToLocal: mocks.prefetchEmojiToLocal
    },
    setting: {
      closeAutoLogin: mocks.closeAutoLogin
    }
  }

  const host = {
    port,
    getCurrentClientDeviceId: mocks.getCurrentClientDeviceId,
    resolveDisplayName: mocks.resolveDisplayName,
    clearUserLocalStorage: mocks.clearUserLocalStorage,
    clearMessageCache: mocks.clearMessageCache,
    getStoredTokens: mocks.getStoredTokens,
    restoreWithAccessToken: mocks.restoreWithAccessToken,
    bootstrapPostLoginState: mocks.bootstrapPostLoginState,
    waitSyncPrepared: mocks.waitSyncPrepared,
    resetLocalSessionState: mocks.resetLocalSessionState,
    ...overrides
  } as unknown as SessionRuntimeHost

  return { host, mocks }
}

describe('SessionBootstrapService', () => {
  let state: SessionRuntimeState

  beforeEach(() => {
    state = new SessionRuntimeState()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('ensureClientReady', () => {
    it('returns immediately when client already exists', async () => {
      const { host, mocks } = createMockHost()
      mocks.getClient.mockReturnValue({})

      const service = new SessionBootstrapService(host, state)
      await service.ensureClientReady()

      expect(mocks.getStoredTokens).not.toHaveBeenCalled()
      expect(mocks.restoreWithAccessToken).not.toHaveBeenCalled()
    })

    it('restores session using stored tokens when no runtime token', async () => {
      const { host, mocks } = createMockHost()
      mocks.getAccessToken.mockReturnValue(undefined)

      const service = new SessionBootstrapService(host, state)
      await service.ensureClientReady()

      expect(mocks.getStoredTokens).toHaveBeenCalled()
      expect(mocks.restoreWithAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: '@alice:matrix.test',
          accessToken: 'stored-token',
          persistTokens: false,
          bootstrapAfterRestore: false
        })
      )
    })

    it('uses runtime access token when available', async () => {
      const { host, mocks } = createMockHost()
      mocks.getAccessToken.mockReturnValue('runtime-token')
      mocks.getRefreshToken.mockReturnValue('runtime-refresh')

      const service = new SessionBootstrapService(host, state)
      await service.ensureClientReady()

      expect(mocks.getStoredTokens).not.toHaveBeenCalled()
      expect(mocks.restoreWithAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'runtime-token',
          refreshToken: 'runtime-refresh'
        })
      )
    })

    it('returns early when uid is empty and no stored uid', async () => {
      const { host, mocks } = createMockHost()
      mocks.getUserId.mockReturnValue('')
      mocks.getUserInfo.mockReturnValue(undefined)
      mocks.getStoredTokens.mockResolvedValue({ uid: null, token: 'tok' })

      const service = new SessionBootstrapService(host, state)
      await service.ensureClientReady()

      expect(mocks.restoreWithAccessToken).not.toHaveBeenCalled()
    })

    it('uses stored uid when runtime uid is empty', async () => {
      const { host, mocks } = createMockHost()
      mocks.getUserId.mockReturnValue('')
      mocks.getUserInfo.mockReturnValue(undefined)
      mocks.getStoredTokens.mockResolvedValue({ uid: '@stored:matrix.test', token: 'tok' })

      const service = new SessionBootstrapService(host, state)
      await service.ensureClientReady()

      expect(mocks.restoreWithAccessToken).toHaveBeenCalledWith(expect.objectContaining({ uid: '@stored:matrix.test' }))
    })

    it('throws when stored token is missing', async () => {
      const { host, mocks } = createMockHost()
      mocks.getAccessToken.mockReturnValue(undefined)
      mocks.getStoredTokens.mockResolvedValue({ uid: '@alice:matrix.test', token: null })

      const service = new SessionBootstrapService(host, state)
      await expect(service.ensureClientReady()).rejects.toThrow('matrix_error.auth.access_token_missing')
    })

    it('passes options through to restoreWithAccessToken', async () => {
      const { host, mocks } = createMockHost()
      mocks.getAccessToken.mockReturnValue('runtime-token')
      const opts: MatrixPostLoginBootstrapOptions = {
        displayName: 'Alice',
        account: 'alice',
        avatar: 'mxc://test/abc',
        client: 'PC'
      }

      const service = new SessionBootstrapService(host, state)
      await service.ensureClientReady(opts)

      expect(mocks.restoreWithAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'Alice',
          account: 'alice',
          avatar: 'mxc://test/abc',
          client: 'PC'
        })
      )
    })
  })

  describe('bootstrapPostLoginState', () => {
    it('throws when uid is missing', async () => {
      const { host, mocks } = createMockHost()
      mocks.getUserId.mockReturnValue('')
      mocks.getUserInfo.mockReturnValue(undefined)

      const service = new SessionBootstrapService(host, state)
      await expect(service.bootstrapPostLoginState()).rejects.toThrow('matrix_error.auth.user_id_missing_for_init')
    })

    it('completes the full bootstrap flow', async () => {
      const { host, mocks } = createMockHost()
      mocks.getClient.mockReturnValue({})
      const { matrixClientService } = await import('@/services/matrix/MatrixClientService')
      vi.mocked(matrixClientService.waitForClientReady).mockResolvedValue({} as never)

      const service = new SessionBootstrapService(host, state)
      await service.bootstrapPostLoginState({ displayName: 'Alice', account: 'alice' })

      expect(mocks.waitSyncPrepared).toHaveBeenCalled()
      expect(mocks.clearUserLocalStorage).toHaveBeenCalled()
      expect(mocks.clearMessageCache).toHaveBeenCalled()
      expect(mocks.resetState).toHaveBeenCalled()
      expect(mocks.setupEventListeners).toHaveBeenCalled()
      expect(mocks.loadRooms).toHaveBeenCalled()
      expect(mocks.getSessionList).toHaveBeenCalledWith(true)
      expect(mocks.setUserInfo).toHaveBeenCalled()
      expect(mocks.addLoginHistory).toHaveBeenCalled()
    })

    it('sets current session room id when none is set and sessions exist', async () => {
      const { host, mocks } = createMockHost()
      mocks.getClient.mockReturnValue({})
      mocks.getCurrentSessionRoomId.mockReturnValue(undefined)
      mocks.getSessionListValue.mockReturnValue([{ roomId: '!room1:matrix.test' }])

      const service = new SessionBootstrapService(host, state)
      await service.bootstrapPostLoginState()

      expect(mocks.updateCurrentSessionRoomId).toHaveBeenCalledWith('!room1:matrix.test')
    })

    it('does not set current session room id when already set', async () => {
      const { host, mocks } = createMockHost()
      mocks.getClient.mockReturnValue({})
      mocks.getCurrentSessionRoomId.mockReturnValue('!existing:matrix.test')

      const service = new SessionBootstrapService(host, state)
      await service.bootstrapPostLoginState()

      expect(mocks.updateCurrentSessionRoomId).not.toHaveBeenCalled()
    })

    it('uses idempotency guard for concurrent invocations', async () => {
      const { host, mocks } = createMockHost()
      mocks.getClient.mockReturnValue({})

      const service = new SessionBootstrapService(host, state)
      const p1 = service.bootstrapPostLoginState()
      const p2 = service.bootstrapPostLoginState()

      await Promise.all([p1, p2])

      // IdempotencyGuard should ensure bootstrap only runs once
      expect(mocks.waitSyncPrepared).toHaveBeenCalledTimes(1)
    })

    it('rethrows errors from bootstrap sub-steps', async () => {
      const { host, mocks } = createMockHost()
      mocks.getClient.mockReturnValue({})
      mocks.waitSyncPrepared.mockRejectedValue(new Error('sync failed'))

      const service = new SessionBootstrapService(host, state)
      await expect(service.bootstrapPostLoginState()).rejects.toThrow('sync failed')
    })
  })

  describe('bootstrapPostLoginState - search index', () => {
    it('bootstraps search index with rooms and messages', async () => {
      const { host, mocks } = createMockHost()
      mocks.getClient.mockReturnValue({
        getRoom: () => ({ getJoinedMembers: () => [] })
      })
      const { matrixClientService } = await import('@/services/matrix/MatrixClientService')
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: () => ({ getJoinedMembers: () => [] })
      } as never)
      mocks.getRoomList.mockReturnValue([
        {
          roomId: '!room1:matrix.test',
          name: 'Room 1',
          avatarUrl: '',
          detail: { joinedCount: 5 }
        }
      ])
      mocks.getMessages.mockReturnValue([
        {
          message: {
            id: 'evt1',
            roomId: '!room1:matrix.test',
            type: MsgEnum.TEXT,
            body: 'hello',
            sendTime: 1700000000
          },
          fromUser: { uid: '@alice:matrix.test' }
        }
      ])

      const service = new SessionBootstrapService(host, state)
      await service.bootstrapPostLoginState()

      const { matrixWorkerHost } = await import('@/services/matrix/MatrixWorkerHost')
      expect(vi.mocked(matrixWorkerHost.bootstrapSearchRooms)).toHaveBeenCalled()
      expect(vi.mocked(matrixWorkerHost.bootstrapSearchEvents)).toHaveBeenCalled()
    })
  })
})
