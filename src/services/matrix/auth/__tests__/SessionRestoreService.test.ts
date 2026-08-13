import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { err, ok } from '@/common/result'
import { TauriCommand } from '@/enums'
import { SessionRestoreService } from '../SessionRestoreService'
import type { SessionRuntimeHost } from '../sessionRuntimeInternal'
import { SessionRuntimeState } from '../sessionRuntimeInternal'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
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

vi.mock('@/services/backend/tauriCommand', () => ({
  switchUserDatabase: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/services/matrix/matrixSessionState', () => ({
  patchMatrixSessionSnapshot: vi.fn()
}))

vi.mock('@/utils/AppHarness', () => ({
  hasTauriRuntime: vi.fn().mockReturnValue(true)
}))

vi.mock('@/utils/AppStateReady', () => ({
  ensureAppStateReady: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/utils/TauriInvokeHandler', () => ({
  invokeWithErrorHandler: vi.fn().mockResolvedValue(undefined),
  invokeWithResult: vi.fn()
}))

// matrixClientService 仅用于 waitSyncPrepared 的事件监听与 poll 轮询
vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    on: vi.fn(),
    off: vi.fn(),
    getClient: vi.fn()
  }
}))

const { switchUserDatabase } = await import('@/services/backend/tauriCommand')
const { patchMatrixSessionSnapshot } = await import('@/services/matrix/matrixSessionState')
const { hasTauriRuntime } = await import('@/utils/AppHarness')
const { ensureAppStateReady } = await import('@/utils/AppStateReady')
const { invokeWithErrorHandler, invokeWithResult } = await import('@/utils/TauriInvokeHandler')
const { matrixClientService } = await import('@/services/matrix/MatrixClientService')

const switchUserDatabaseMock = vi.mocked(switchUserDatabase)
const patchMatrixSessionSnapshotMock = vi.mocked(patchMatrixSessionSnapshot)
const hasTauriRuntimeMock = vi.mocked(hasTauriRuntime)
const ensureAppStateReadyMock = vi.mocked(ensureAppStateReady)
const invokeWithErrorHandlerMock = vi.mocked(invokeWithErrorHandler)
const invokeWithResultMock = vi.mocked(invokeWithResult)
const clientOnMock = vi.mocked(matrixClientService.on)
const clientOffMock = vi.mocked(matrixClientService.off)
const clientGetMock = vi.mocked(matrixClientService.getClient)

function createMockHost(overrides?: Partial<SessionRuntimeHost>): {
  host: SessionRuntimeHost
  mocks: Record<string, ReturnType<typeof vi.fn>>
} {
  const mocks = {
    isLoggedIn: vi.fn().mockReturnValue(true),
    isInitialized: vi.fn().mockReturnValue(true),
    getAccessToken: vi.fn().mockReturnValue('access-token'),
    getCurrentClientDeviceId: vi.fn().mockReturnValue('DEV1'),
    resolveDisplayName: vi.fn().mockReturnValue('Alice'),
    initUserInfo: vi.fn(),
    bootstrapPostLoginState: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    loginWithToken: vi.fn().mockResolvedValue(true)
  }

  const port = {
    matrix: {
      getClient: vi.fn(),
      getUserId: vi.fn().mockReturnValue('@alice:test'),
      isLoggedIn: mocks.isLoggedIn,
      isInitialized: mocks.isInitialized,
      getLastError: vi.fn(),
      getAccessToken: mocks.getAccessToken,
      getRefreshToken: vi.fn().mockReturnValue('refresh-token'),
      getHomeserverUrl: vi.fn(),
      initialize: mocks.initialize,
      login: vi.fn().mockResolvedValue(true),
      completeSSOLogin: vi.fn().mockResolvedValue(true),
      loginWithToken: mocks.loginWithToken,
      logout: vi.fn().mockResolvedValue(undefined)
    },
    user: {
      getUserInfo: vi.fn(),
      setUserInfo: vi.fn(),
      initUserInfo: mocks.initUserInfo,
      clearUser: vi.fn(),
      fetchUserProfile: vi.fn().mockResolvedValue(null),
      updateProfileFields: vi.fn()
    },
    room: {
      getRoomList: vi.fn().mockReturnValue([]),
      getMessages: vi.fn().mockReturnValue([]),
      resetState: vi.fn(),
      setupEventListeners: vi.fn().mockResolvedValue(undefined),
      loadRooms: vi.fn().mockResolvedValue(true)
    },
    chat: {
      getSessionList: vi.fn().mockResolvedValue(undefined),
      getSessionListValue: vi.fn().mockReturnValue([])
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
      getCurrentSessionRoomId: vi.fn(),
      updateCurrentSessionRoomId: vi.fn(),
      setTrayMenuShow: vi.fn()
    },
    loginHistory: {
      addLoginHistory: vi.fn()
    },
    emoji: {
      initEmojis: vi.fn().mockResolvedValue(undefined),
      prefetchEmojiToLocal: vi.fn().mockResolvedValue(undefined)
    },
    setting: {
      closeAutoLogin: vi.fn()
    }
  }

  const host = {
    port,
    getCurrentClientDeviceId: mocks.getCurrentClientDeviceId,
    resolveDisplayName: mocks.resolveDisplayName,
    clearUserLocalStorage: vi.fn(),
    clearMessageCache: vi.fn(),
    getStoredTokens: vi.fn().mockResolvedValue({ token: null, refreshToken: null }),
    restoreWithAccessToken: vi.fn().mockResolvedValue(undefined),
    bootstrapPostLoginState: mocks.bootstrapPostLoginState,
    waitSyncPrepared: vi.fn().mockResolvedValue(undefined),
    resetLocalSessionState: vi.fn().mockResolvedValue(undefined),
    ...overrides
  } as unknown as SessionRuntimeHost

  return { host, mocks }
}

describe('SessionRestoreService.getStoredTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hasTauriRuntimeMock.mockReturnValue(true)
  })

  it('returns the runtime access token in non-Tauri environments', async () => {
    hasTauriRuntimeMock.mockReturnValue(false)
    const { host, mocks } = createMockHost()
    mocks.getAccessToken.mockReturnValue('web-token')

    const service = new SessionRestoreService(host, new SessionRuntimeState())
    const result = await service.getStoredTokens()

    expect(result).toEqual({ token: 'web-token', refreshToken: null })
    expect(ensureAppStateReadyMock).not.toHaveBeenCalled()
  })

  it('returns null tokens in non-Tauri environments without a token', async () => {
    hasTauriRuntimeMock.mockReturnValue(false)
    const { host, mocks } = createMockHost()
    mocks.getAccessToken.mockReturnValue(undefined)

    const service = new SessionRestoreService(host, new SessionRuntimeState())
    const result = await service.getStoredTokens()

    expect(result).toEqual({ token: null, refreshToken: null })
  })

  it('returns stored tokens from the backend in Tauri environments', async () => {
    invokeWithResultMock.mockResolvedValue(
      ok({ token: 'stored', refreshToken: 'refresh' }) as unknown as Awaited<ReturnType<typeof invokeWithResult>>
    )
    const { host } = createMockHost()

    const service = new SessionRestoreService(host, new SessionRuntimeState())
    const result = await service.getStoredTokens()

    expect(invokeWithResultMock).toHaveBeenCalledWith(TauriCommand.GET_USER_TOKENS)
    expect(result).toEqual({ token: 'stored', refreshToken: 'refresh' })
  })

  it('returns null tokens when the backend request fails', async () => {
    invokeWithResultMock.mockResolvedValue(
      err(new Error('backend down')) as unknown as Awaited<ReturnType<typeof invokeWithResult>>
    )
    const { host } = createMockHost()

    const service = new SessionRestoreService(host, new SessionRuntimeState())
    const result = await service.getStoredTokens()

    expect(result).toEqual({ token: null, refreshToken: null })
  })
})

describe('SessionRestoreService.hasAuthenticatedSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns true when already logged in', async () => {
    const { host, mocks } = createMockHost()
    mocks.isLoggedIn.mockReturnValue(true)
    const state = new SessionRuntimeState()
    state.cachedHasSession = false

    const service = new SessionRestoreService(host, state)
    const result = await service.hasAuthenticatedSession()

    expect(result).toBe(true)
    // 已登录快速路径会清空缓存
    expect(state.cachedHasSession).toBeNull()
    expect(service.getStoredTokens).toBeDefined()
    expect(invokeWithResultMock).not.toHaveBeenCalled()
  })

  it('returns false when initialized but not logged in', async () => {
    const { host, mocks } = createMockHost()
    mocks.isLoggedIn.mockReturnValue(false)
    mocks.isInitialized.mockReturnValue(true)

    const service = new SessionRestoreService(host, new SessionRuntimeState())
    const result = await service.hasAuthenticatedSession()

    expect(result).toBe(false)
  })

  it('returns the cached value when not logged in and not initialized', async () => {
    const { host, mocks } = createMockHost()
    mocks.isLoggedIn.mockReturnValue(false)
    mocks.isInitialized.mockReturnValue(false)
    const state = new SessionRuntimeState()
    state.cachedHasSession = true

    const service = new SessionRestoreService(host, state)
    const result = await service.hasAuthenticatedSession()

    expect(result).toBe(true)
  })

  it('computes hasSession from stored tokens and caches it', async () => {
    const { host, mocks } = createMockHost()
    mocks.isLoggedIn.mockReturnValue(false)
    mocks.isInitialized.mockReturnValue(false)
    const state = new SessionRuntimeState()
    const service = new SessionRestoreService(host, state)
    const getStoredTokensSpy = vi
      .spyOn(service, 'getStoredTokens')
      .mockResolvedValue({ token: 'found', refreshToken: null })

    const result = await service.hasAuthenticatedSession()

    expect(result).toBe(true)
    expect(state.cachedHasSession).toBe(true)
    expect(getStoredTokensSpy).toHaveBeenCalled()
    getStoredTokensSpy.mockRestore()
  })

  it('returns false when getStoredTokens throws', async () => {
    const { host, mocks } = createMockHost()
    mocks.isLoggedIn.mockReturnValue(false)
    mocks.isInitialized.mockReturnValue(false)
    const state = new SessionRuntimeState()
    const service = new SessionRestoreService(host, state)
    vi.spyOn(service, 'getStoredTokens').mockRejectedValue(new Error('boom'))

    const result = await service.hasAuthenticatedSession()

    expect(result).toBe(false)
  })
})

describe('SessionRestoreService.restoreWithAccessToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hasTauriRuntimeMock.mockReturnValue(true)
  })

  it('throws when uid is missing', async () => {
    const { host } = createMockHost()
    const service = new SessionRestoreService(host, new SessionRuntimeState())

    await expect(service.restoreWithAccessToken({ uid: '', accessToken: 'token' })).rejects.toThrow(
      'matrix_error.auth.user_id_missing'
    )
  })

  it('throws when accessToken is missing', async () => {
    const { host } = createMockHost()
    const service = new SessionRestoreService(host, new SessionRuntimeState())

    await expect(service.restoreWithAccessToken({ uid: '@a:test', accessToken: '' })).rejects.toThrow(
      'matrix_error.auth.access_token_missing'
    )
  })

  it('restores the session and initializes user info', async () => {
    const { host, mocks } = createMockHost()
    const service = new SessionRestoreService(host, new SessionRuntimeState())

    await service.restoreWithAccessToken({
      uid: '@alice:test',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      displayName: 'Alice',
      account: 'alice'
    })

    expect(ensureAppStateReadyMock).toHaveBeenCalled()
    expect(switchUserDatabaseMock).toHaveBeenCalledWith('@alice:test')
    expect(mocks.initialize).toHaveBeenCalledWith({
      homeserverUrl: 'https://matrix.test',
      identityServerUrl: 'https://id.test',
      accessToken: 'access-token',
      userId: '@alice:test',
      allowInsecureHttp: false
    })
    expect(mocks.loginWithToken).toHaveBeenCalledWith('access-token', '@alice:test', 'refresh-token')
    expect(patchMatrixSessionSnapshotMock).toHaveBeenCalled()
    expect(mocks.resolveDisplayName).toHaveBeenCalledWith('@alice:test', 'Alice', 'alice')
    expect(mocks.initUserInfo).toHaveBeenCalledWith('@alice:test', 'Alice')
    expect(invokeWithErrorHandlerMock).toHaveBeenCalledWith(TauriCommand.SAVE_USER_INFO, {
      userInfo: { uid: '@alice:test' }
    })
  })

  it('skips database switch when switchDatabase is false', async () => {
    const { host } = createMockHost()
    const service = new SessionRestoreService(host, new SessionRuntimeState())

    await service.restoreWithAccessToken({
      uid: '@alice:test',
      accessToken: 'token',
      switchDatabase: false
    })

    expect(switchUserDatabaseMock).not.toHaveBeenCalled()
  })

  it('persists tokens when persistTokens is true and on Tauri runtime', async () => {
    const { host } = createMockHost()
    const service = new SessionRestoreService(host, new SessionRuntimeState())

    await service.restoreWithAccessToken({
      uid: '@alice:test',
      accessToken: 'token',
      persistTokens: true
    })

    expect(invokeWithErrorHandlerMock).toHaveBeenCalledWith(TauriCommand.UPDATE_TOKEN, {
      req: { uid: '@alice:test', token: 'token', refreshToken: '' }
    })
  })

  it('skips token persistence outside Tauri or when persistTokens is false', async () => {
    hasTauriRuntimeMock.mockReturnValue(true)
    const { host } = createMockHost()
    const service = new SessionRestoreService(host, new SessionRuntimeState())

    await service.restoreWithAccessToken({ uid: '@alice:test', accessToken: 'token' })

    expect(invokeWithErrorHandlerMock).not.toHaveBeenCalledWith(TauriCommand.UPDATE_TOKEN, expect.anything())
  })

  it('bootstraps the session after restore when bootstrapAfterRestore is true', async () => {
    const { host, mocks } = createMockHost()
    const service = new SessionRestoreService(host, new SessionRuntimeState())

    await service.restoreWithAccessToken({
      uid: '@alice:test',
      accessToken: 'token',
      bootstrapAfterRestore: true,
      account: 'alice',
      avatar: 'mxc://test/abc',
      client: 'PC'
    })

    expect(mocks.bootstrapPostLoginState).toHaveBeenCalledWith({
      account: 'alice',
      displayName: 'Alice',
      avatar: 'mxc://test/abc',
      client: 'PC'
    })
  })

  it('does not bootstrap when bootstrapAfterRestore is false', async () => {
    const { host, mocks } = createMockHost()
    const service = new SessionRestoreService(host, new SessionRuntimeState())

    await service.restoreWithAccessToken({ uid: '@alice:test', accessToken: 'token' })

    expect(mocks.bootstrapPostLoginState).not.toHaveBeenCalled()
  })

  it('throws when loginWithToken fails', async () => {
    const { host, mocks } = createMockHost()
    mocks.loginWithToken.mockResolvedValue(false)
    const service = new SessionRestoreService(host, new SessionRuntimeState())

    await expect(service.restoreWithAccessToken({ uid: '@alice:test', accessToken: 'token' })).rejects.toThrow(
      'matrix_error.auth.session_restore_failed'
    )
  })

  it('rethrows the original failure', async () => {
    const { host, mocks } = createMockHost()
    mocks.loginWithToken.mockRejectedValue(new Error('restore down'))
    const service = new SessionRestoreService(host, new SessionRuntimeState())

    await expect(service.restoreWithAccessToken({ uid: '@alice:test', accessToken: 'token' })).rejects.toThrow(
      'restore down'
    )
  })
})

describe('SessionRestoreService.waitSyncPrepared', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves when the sync event reports PREPARED', async () => {
    const { host } = createMockHost()
    const service = new SessionRestoreService(host, new SessionRuntimeState())

    const promise = service.waitSyncPrepared(1000)
    const syncCallback = clientOnMock.mock.calls[0][1] as (data: { state?: string }) => void
    syncCallback({ state: 'PREPARED' })
    await expect(promise).resolves.toBeUndefined()

    expect(clientOffMock).toHaveBeenCalledWith('sync', expect.any(Function))
  })

  it('resolves when the sync event reports SYNCING', async () => {
    const { host } = createMockHost()
    const service = new SessionRestoreService(host, new SessionRuntimeState())

    const promise = service.waitSyncPrepared(1000)
    const syncCallback = clientOnMock.mock.calls[0][1] as (data: { state?: string }) => void
    syncCallback({ state: 'SYNCING' })
    await expect(promise).resolves.toBeUndefined()
  })

  it('resolves immediately when the client reports PREPARED via polling', async () => {
    const { host } = createMockHost()
    const service = new SessionRestoreService(host, new SessionRuntimeState())
    clientGetMock.mockReturnValue({ getSyncState: () => 'PREPARED' } as never)

    await expect(service.waitSyncPrepared(1000)).resolves.toBeUndefined()
    expect(clientOffMock).toHaveBeenCalledWith('sync', expect.any(Function))
  })

  it('resolves via polling when the client reports SYNCING', async () => {
    const { host } = createMockHost()
    const service = new SessionRestoreService(host, new SessionRuntimeState())
    clientGetMock.mockReturnValue({ getSyncState: () => 'SYNCING' } as never)

    await expect(service.waitSyncPrepared(1000)).resolves.toBeUndefined()
  })

  it('resolves after timeout when sync never reaches prepared', async () => {
    vi.useFakeTimers()
    const { host } = createMockHost()
    const service = new SessionRestoreService(host, new SessionRuntimeState())
    clientGetMock.mockReturnValue({ getSyncState: () => 'ERROR' } as never)

    const promise = service.waitSyncPrepared(1000)
    await vi.advanceTimersByTimeAsync(1000)
    await expect(promise).resolves.toBeUndefined()
    expect(clientOffMock).toHaveBeenCalled()
  })
})
