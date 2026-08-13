import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TauriCommand } from '@/enums'
import { SessionLoginService } from '../SessionLoginService'
import type { SessionRuntimeHost } from '../sessionRuntimeInternal'

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
  saveMatrixSessionEndpointConfig: vi.fn(),
  resolveMatrixSessionEndpointConfig: () => ({
    homeserverUrl: 'https://matrix.test',
    identityServerUrl: 'https://id.test'
  })
}))

vi.mock('@/services/backend/tauriCommand', () => ({
  switchUserDatabase: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    stopClient: vi.fn().mockResolvedValue(undefined)
  }
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
  invokeWithErrorHandler: vi.fn().mockResolvedValue(undefined)
}))

const { saveMatrixSessionEndpointConfig } = await import('@/services/backend/config')
const { switchUserDatabase } = await import('@/services/backend/tauriCommand')
const { matrixClientService } = await import('@/services/matrix/MatrixClientService')
const { patchMatrixSessionSnapshot } = await import('@/services/matrix/matrixSessionState')
const { hasTauriRuntime } = await import('@/utils/AppHarness')
const { ensureAppStateReady } = await import('@/utils/AppStateReady')
const { invokeWithErrorHandler } = await import('@/utils/TauriInvokeHandler')

const saveMatrixSessionEndpointConfigMock = vi.mocked(saveMatrixSessionEndpointConfig)
const switchUserDatabaseMock = vi.mocked(switchUserDatabase)
const stopClientMock = vi.mocked(matrixClientService.stopClient)
const patchMatrixSessionSnapshotMock = vi.mocked(patchMatrixSessionSnapshot)
const hasTauriRuntimeMock = vi.mocked(hasTauriRuntime)
const ensureAppStateReadyMock = vi.mocked(ensureAppStateReady)
const invokeWithErrorHandlerMock = vi.mocked(invokeWithErrorHandler)

function createMockHost(overrides?: Partial<SessionRuntimeHost>): {
  host: SessionRuntimeHost
  mocks: Record<string, ReturnType<typeof vi.fn>>
} {
  const mocks = {
    initialize: vi.fn().mockResolvedValue(undefined),
    login: vi.fn().mockResolvedValue(true),
    completeSSOLogin: vi.fn().mockResolvedValue(true),
    getUserId: vi.fn().mockReturnValue('@alice:test'),
    getAccessToken: vi.fn().mockReturnValue('access-token'),
    getRefreshToken: vi.fn().mockReturnValue('refresh-token'),
    getLastError: vi.fn().mockReturnValue(undefined),
    getCurrentClientDeviceId: vi.fn().mockReturnValue('DEV1'),
    bootstrapPostLoginState: vi.fn().mockResolvedValue(undefined)
  }

  const port = {
    matrix: {
      getClient: vi.fn(),
      getUserId: mocks.getUserId,
      isLoggedIn: vi.fn().mockReturnValue(true),
      isInitialized: vi.fn().mockReturnValue(true),
      getLastError: mocks.getLastError,
      getAccessToken: mocks.getAccessToken,
      getRefreshToken: mocks.getRefreshToken,
      getHomeserverUrl: vi.fn().mockReturnValue('https://matrix.test'),
      initialize: mocks.initialize,
      login: mocks.login,
      completeSSOLogin: mocks.completeSSOLogin,
      loginWithToken: vi.fn().mockResolvedValue(true),
      logout: vi.fn().mockResolvedValue(undefined)
    },
    user: {
      getUserInfo: vi.fn(),
      setUserInfo: vi.fn(),
      initUserInfo: vi.fn(),
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
    resolveDisplayName: vi.fn().mockReturnValue('Alice'),
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

describe('SessionLoginService.loginWithPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('authenticates with password and bootstraps the session', async () => {
    const { host, mocks } = createMockHost()
    const service = new SessionLoginService(host)

    const result = await service.loginWithPassword({
      username: 'alice',
      password: 'secret',
      homeserverUrl: 'https://matrix.test',
      identityServerUrl: 'https://id.test',
      deviceName: 'web'
    })

    expect(result).toEqual({ uid: '@alice:test', accessToken: 'access-token' })
    expect(ensureAppStateReadyMock).toHaveBeenCalled()
    expect(saveMatrixSessionEndpointConfigMock).toHaveBeenCalledWith({
      homeserverUrl: 'https://matrix.test',
      identityServerUrl: 'https://id.test'
    })
    expect(mocks.initialize).toHaveBeenCalledWith({
      homeserverUrl: 'https://matrix.test',
      identityServerUrl: 'https://id.test',
      allowInsecureHttp: false
    })
    expect(mocks.login).toHaveBeenCalledWith('alice', 'secret', 'web')
    expect(patchMatrixSessionSnapshotMock).toHaveBeenCalledWith({
      userId: '@alice:test',
      deviceId: 'DEV1',
      accessToken: 'access-token',
      homeserverUrl: 'https://matrix.test'
    })
    expect(switchUserDatabaseMock).toHaveBeenCalledWith('@alice:test')
    expect(invokeWithErrorHandlerMock).toHaveBeenCalledWith(TauriCommand.UPDATE_TOKEN, {
      req: { uid: '@alice:test', token: 'access-token', refreshToken: 'refresh-token' }
    })
    expect(invokeWithErrorHandlerMock).toHaveBeenCalledWith(TauriCommand.SAVE_USER_INFO, {
      userInfo: { uid: '@alice:test' }
    })
    expect(mocks.bootstrapPostLoginState).toHaveBeenCalledWith({
      account: 'alice',
      displayName: undefined,
      avatar: undefined,
      client: undefined
    })
  })

  it('sets allowInsecureHttp when homeserver uses http scheme', async () => {
    const { host, mocks } = createMockHost()
    const service = new SessionLoginService(host)

    await service.loginWithPassword({
      username: 'alice',
      password: 'secret',
      homeserverUrl: 'http://localhost:8008'
    })

    expect(mocks.initialize).toHaveBeenCalledWith(expect.objectContaining({ allowInsecureHttp: true }))
  })

  it('throws when the login fails, using getLastError message', async () => {
    const { host, mocks } = createMockHost()
    mocks.login.mockResolvedValue(false)
    mocks.getLastError.mockReturnValue('bad credentials')

    const service = new SessionLoginService(host)
    await expect(
      service.loginWithPassword({
        username: 'alice',
        password: 'wrong',
        homeserverUrl: 'https://matrix.test'
      })
    ).rejects.toThrow('bad credentials')
    expect(stopClientMock).toHaveBeenCalled()
  })

  it('throws the generic i18n message when login fails without a last error', async () => {
    const { host, mocks } = createMockHost()
    mocks.login.mockResolvedValue(false)
    mocks.getLastError.mockReturnValue(undefined)

    const service = new SessionLoginService(host)
    await expect(
      service.loginWithPassword({
        username: 'alice',
        password: 'wrong',
        homeserverUrl: 'https://matrix.test'
      })
    ).rejects.toThrow('matrix_error.auth.login_failed_check_network')
  })

  it('throws when session info is incomplete (missing uid or accessToken)', async () => {
    const { host, mocks } = createMockHost()
    mocks.getAccessToken.mockReturnValue(undefined)

    const service = new SessionLoginService(host)
    await expect(
      service.loginWithPassword({
        username: 'alice',
        password: 'secret',
        homeserverUrl: 'https://matrix.test'
      })
    ).rejects.toThrow('matrix_error.auth.session_info_incomplete')
  })

  it('skips token persistence when persistTokens is false', async () => {
    const { host } = createMockHost()
    const service = new SessionLoginService(host)

    await service.loginWithPassword({
      username: 'alice',
      password: 'secret',
      homeserverUrl: 'https://matrix.test',
      persistTokens: false
    })

    expect(invokeWithErrorHandlerMock).not.toHaveBeenCalledWith(TauriCommand.UPDATE_TOKEN, expect.anything())
  })

  it('skips user info persistence when persistUserInfo is false', async () => {
    const { host } = createMockHost()
    const service = new SessionLoginService(host)

    await service.loginWithPassword({
      username: 'alice',
      password: 'secret',
      homeserverUrl: 'https://matrix.test',
      persistUserInfo: false
    })

    expect(invokeWithErrorHandlerMock).not.toHaveBeenCalledWith(TauriCommand.SAVE_USER_INFO, expect.anything())
  })

  it('skips database switch when switchDatabase is false', async () => {
    const { host } = createMockHost()
    const service = new SessionLoginService(host)

    await service.loginWithPassword({
      username: 'alice',
      password: 'secret',
      homeserverUrl: 'https://matrix.test',
      switchDatabase: false
    })

    expect(switchUserDatabaseMock).not.toHaveBeenCalled()
  })

  it('skips Tauri persistence calls outside of a Tauri runtime', async () => {
    hasTauriRuntimeMock.mockReturnValue(false)
    const { host } = createMockHost()
    const service = new SessionLoginService(host)

    await service.loginWithPassword({
      username: 'alice',
      password: 'secret',
      homeserverUrl: 'https://matrix.test'
    })

    expect(invokeWithErrorHandlerMock).not.toHaveBeenCalled()
  })

  it('cleans up the client and rethrows when bootstrap fails', async () => {
    const { host, mocks } = createMockHost()
    mocks.bootstrapPostLoginState.mockRejectedValue(new Error('bootstrap boom'))

    const service = new SessionLoginService(host)
    await expect(
      service.loginWithPassword({
        username: 'alice',
        password: 'secret',
        homeserverUrl: 'https://matrix.test'
      })
    ).rejects.toThrow('bootstrap boom')
    expect(stopClientMock).toHaveBeenCalled()
  })

  it('rethrows the original error on any failure', async () => {
    const { host, mocks } = createMockHost()
    mocks.initialize.mockRejectedValue(new Error('init failed'))

    const service = new SessionLoginService(host)
    await expect(
      service.loginWithPassword({
        username: 'alice',
        password: 'secret',
        homeserverUrl: 'https://matrix.test'
      })
    ).rejects.toThrow('init failed')
  })
})

describe('SessionLoginService.loginWithSsoToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws when the sso login token is empty', async () => {
    const { host } = createMockHost()
    const service = new SessionLoginService(host)

    await expect(service.loginWithSsoToken({ loginToken: '' })).rejects.toThrow('matrix_error.auth.sso_token_missing')
  })

  it('authenticates with an SSO token and bootstraps the session', async () => {
    const { host, mocks } = createMockHost()
    const service = new SessionLoginService(host)

    const result = await service.loginWithSsoToken({
      loginToken: 'sso-token',
      account: 'alice',
      displayName: 'Alice',
      avatar: 'mxc://test/abc',
      client: 'PC'
    })

    expect(result).toEqual({ uid: '@alice:test', accessToken: 'access-token' })
    expect(mocks.initialize).toHaveBeenCalled()
    expect(mocks.completeSSOLogin).toHaveBeenCalledWith('sso-token')
    expect(patchMatrixSessionSnapshotMock).toHaveBeenCalled()
    expect(mocks.bootstrapPostLoginState).toHaveBeenCalledWith({
      account: 'alice',
      displayName: 'Alice',
      avatar: 'mxc://test/abc',
      client: 'PC'
    })
  })

  it('throws when the SSO login fails', async () => {
    const { host, mocks } = createMockHost()
    mocks.completeSSOLogin.mockResolvedValue(false)

    const service = new SessionLoginService(host)
    await expect(service.loginWithSsoToken({ loginToken: 'sso-token' })).rejects.toThrow(
      'matrix_error.auth.sso_login_failed'
    )
  })

  it('throws when SSO session info is incomplete', async () => {
    const { host, mocks } = createMockHost()
    mocks.getUserId.mockReturnValue(null)

    const service = new SessionLoginService(host)
    await expect(service.loginWithSsoToken({ loginToken: 'sso-token' })).rejects.toThrow(
      'matrix_error.auth.sso_session_incomplete'
    )
  })

  it('rethrows the original failure', async () => {
    const { host, mocks } = createMockHost()
    mocks.completeSSOLogin.mockRejectedValue(new Error('sso down'))

    const service = new SessionLoginService(host)
    await expect(service.loginWithSsoToken({ loginToken: 'sso-token' })).rejects.toThrow('sso down')
  })
})
