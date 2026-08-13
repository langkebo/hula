import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventEnum, TauriCommand } from '@/enums'
import { SessionLogoutService } from '../SessionLogoutService'
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
  clearMatrixSessionEndpointConfig: vi.fn()
}))

vi.mock('@/services/matrix/matrixSessionState', () => ({
  patchMatrixSessionSnapshot: vi.fn()
}))

vi.mock('@/utils/TauriInvokeHandler', () => ({
  invokeWithErrorHandler: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/composables/user/usePresenceHeartbeat', () => ({
  stopPresenceHeartbeat: vi.fn()
}))

vi.mock('@/services/matrix/MatrixWsBridge', () => ({
  matrixWsBridge: {
    stop: vi.fn()
  }
}))

vi.mock('@/services/matrix/MatrixWorkerHost', () => ({
  matrixWorkerHost: {
    resetSearchIndex: vi.fn().mockResolvedValue(undefined),
    terminate: vi.fn()
  }
}))

vi.mock('@/services/matrix/user/MatrixPresenceService', () => ({
  matrixPresenceService: {
    setPresence: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: {
    getByLabel: vi.fn().mockResolvedValue(null)
  }
}))

const mockGetByLabel = vi.mocked((await import('@tauri-apps/api/webviewWindow')).WebviewWindow.getByLabel)

const { clearMatrixSessionEndpointConfig } = await import('@/services/backend/config')
const { patchMatrixSessionSnapshot } = await import('@/services/matrix/matrixSessionState')
const { invokeWithErrorHandler } = await import('@/utils/TauriInvokeHandler')
const { stopPresenceHeartbeat } = await import('@/composables/user/usePresenceHeartbeat')
const { matrixWsBridge } = await import('@/services/matrix/MatrixWsBridge')
const { matrixWorkerHost } = await import('@/services/matrix/MatrixWorkerHost')
const { matrixPresenceService } = await import('@/services/matrix/user/MatrixPresenceService')
const { emit } = await import('@tauri-apps/api/event')

const clearMatrixSessionEndpointConfigMock = vi.mocked(clearMatrixSessionEndpointConfig)
const patchMatrixSessionSnapshotMock = vi.mocked(patchMatrixSessionSnapshot)
const invokeWithErrorHandlerMock = vi.mocked(invokeWithErrorHandler)
const stopPresenceHeartbeatMock = vi.mocked(stopPresenceHeartbeat)
const matrixWsBridgeStopMock = vi.mocked(matrixWsBridge.stop)
const resetSearchIndexMock = vi.mocked(matrixWorkerHost.resetSearchIndex)
const matrixWorkerTerminateMock = vi.mocked(matrixWorkerHost.terminate)
const setPresenceMock = vi.mocked(matrixPresenceService.setPresence)
const emitMock = vi.mocked(emit)

// useWindow is mocked per test so we can control isDesktop dependent branches.
vi.mock('@/composables/common/useWindow', () => ({
  useWindow: vi.fn(),
  __useWindowImplemented: true
}))

const { useWindow } = await import('@/composables/common/useWindow')
const useWindowMock = vi.mocked(useWindow)

vi.mock('@/utils/PlatformConstants', () => ({
  isDesktop: vi.fn().mockReturnValue(true),
  isMac: vi.fn().mockReturnValue(false)
}))

const { isDesktop, isMac } = await import('@/utils/PlatformConstants')
const isDesktopMock = vi.mocked(isDesktop)
const isMacMock = vi.mocked(isMac)

function createMockHost(overrides?: Partial<SessionRuntimeHost>): {
  host: SessionRuntimeHost
  mocks: Record<string, ReturnType<typeof vi.fn>>
} {
  const mocks = {
    logout: vi.fn().mockResolvedValue(undefined),
    closeAutoLogin: vi.fn(),
    clearUser: vi.fn(),
    updateCurrentSessionRoomId: vi.fn(),
    setTrayMenuShow: vi.fn()
  }

  const port = {
    matrix: {
      getClient: vi.fn(),
      getUserId: vi.fn().mockReturnValue('@alice:test'),
      isLoggedIn: vi.fn().mockReturnValue(true),
      isInitialized: vi.fn().mockReturnValue(true),
      getLastError: vi.fn(),
      getAccessToken: vi.fn().mockReturnValue('access-token'),
      getRefreshToken: vi.fn(),
      getHomeserverUrl: vi.fn(),
      initialize: vi.fn().mockResolvedValue(undefined),
      login: vi.fn().mockResolvedValue(true),
      completeSSOLogin: vi.fn().mockResolvedValue(true),
      loginWithToken: vi.fn().mockResolvedValue(true),
      logout: mocks.logout
    },
    user: {
      getUserInfo: vi.fn(),
      setUserInfo: vi.fn(),
      initUserInfo: vi.fn(),
      clearUser: mocks.clearUser,
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
      updateCurrentSessionRoomId: mocks.updateCurrentSessionRoomId,
      setTrayMenuShow: mocks.setTrayMenuShow
    },
    loginHistory: {
      addLoginHistory: vi.fn()
    },
    emoji: {
      initEmojis: vi.fn().mockResolvedValue(undefined),
      prefetchEmojiToLocal: vi.fn().mockResolvedValue(undefined)
    },
    setting: {
      closeAutoLogin: mocks.closeAutoLogin
    }
  }

  const host = {
    port,
    getCurrentClientDeviceId: vi.fn().mockReturnValue('DEV1'),
    resolveDisplayName: vi.fn().mockReturnValue('Alice'),
    clearUserLocalStorage: vi.fn(),
    clearMessageCache: vi.fn(),
    getStoredTokens: vi.fn().mockResolvedValue({ token: null, refreshToken: null }),
    restoreWithAccessToken: vi.fn().mockResolvedValue(undefined),
    bootstrapPostLoginState: vi.fn().mockResolvedValue(undefined),
    waitSyncPrepared: vi.fn().mockResolvedValue(undefined),
    resetLocalSessionState: vi.fn().mockResolvedValue(undefined),
    ...overrides
  } as unknown as SessionRuntimeHost

  return { host, mocks }
}

describe('SessionLogoutService.resetLocalSessionState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isMacMock.mockReturnValue(false)
    localStorage.clear()
  })

  it('clears tokens from localStorage and invokes REMOVE_TOKENS by default', async () => {
    localStorage.setItem('user', 'u')
    localStorage.setItem('TOKEN', 't')
    localStorage.setItem('REFRESH_TOKEN', 'r')

    const { host, mocks } = createMockHost()
    const state = new SessionRuntimeState()
    const service = new SessionLogoutService(host, state)

    await service.resetLocalSessionState()

    expect(localStorage.getItem('user')).toBeNull()
    expect(localStorage.getItem('TOKEN')).toBeNull()
    expect(localStorage.getItem('REFRESH_TOKEN')).toBeNull()
    expect(invokeWithErrorHandlerMock).toHaveBeenCalledWith(TauriCommand.REMOVE_TOKENS)
    expect(patchMatrixSessionSnapshotMock).toHaveBeenCalledWith({
      userId: null,
      deviceId: null,
      accessToken: null,
      homeserverUrl: null
    })
    expect(clearMatrixSessionEndpointConfigMock).toHaveBeenCalled()
    expect(mocks.closeAutoLogin).toHaveBeenCalled()
    expect(mocks.clearUser).toHaveBeenCalled()
    expect(mocks.updateCurrentSessionRoomId).toHaveBeenCalledWith('')
  })

  it('resets the bootstrap idempotency guard', async () => {
    const { host } = createMockHost()
    const state = new SessionRuntimeState()
    const resetSpy = vi.spyOn(state.bootstrapGuard, 'reset')
    const service = new SessionLogoutService(host, state)

    await service.resetLocalSessionState()

    expect(resetSpy).toHaveBeenCalled()
  })

  it('preserves tokens when preserveTokens is true', async () => {
    localStorage.setItem('user', 'u')
    localStorage.setItem('TOKEN', 't')

    const { host } = createMockHost()
    const state = new SessionRuntimeState()
    const service = new SessionLogoutService(host, state)

    await service.resetLocalSessionState({ preserveTokens: true })

    expect(localStorage.getItem('user')).toBe('u')
    expect(localStorage.getItem('TOKEN')).toBe('t')
    expect(invokeWithErrorHandlerMock).not.toHaveBeenCalledWith(TauriCommand.REMOVE_TOKENS)
  })

  it('clears the macOS badge count when on macOS', async () => {
    isMacMock.mockReturnValue(true)
    const homeWindow = { setBadgeCount: vi.fn().mockResolvedValue(undefined) }
    mockGetByLabel.mockResolvedValue(homeWindow as never)

    const { host } = createMockHost()
    const state = new SessionRuntimeState()
    const service = new SessionLogoutService(host, state)

    await service.resetLocalSessionState()

    expect(mockGetByLabel).toHaveBeenCalledWith('home')
    expect(homeWindow.setBadgeCount).toHaveBeenCalledWith(undefined)
  })

  it('skips badge clearing when the home window is not found', async () => {
    isMacMock.mockReturnValue(true)
    mockGetByLabel.mockResolvedValue(null)

    const { host } = createMockHost()
    const state = new SessionRuntimeState()
    const service = new SessionLogoutService(host, state)

    await expect(service.resetLocalSessionState()).resolves.toBeUndefined()
  })

  it('rethrows when token removal fails', async () => {
    invokeWithErrorHandlerMock.mockRejectedValue(new Error('remove failed'))

    const { host } = createMockHost()
    const state = new SessionRuntimeState()
    const service = new SessionLogoutService(host, state)

    await expect(service.resetLocalSessionState()).rejects.toThrow('remove failed')
  })
})

describe('SessionLogoutService.logoutCurrentSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isDesktopMock.mockReturnValue(true)
    isMacMock.mockReturnValue(false)
    useWindowMock.mockReturnValue({
      resizeWindow: vi.fn().mockResolvedValue(undefined),
      createWebviewWindow: vi.fn().mockResolvedValue(undefined)
    } as unknown as ReturnType<typeof useWindow>)
    // 恢复默认实现，避免前面测试设置的 mockRejectedValue 泄漏到 logout 流程
    invokeWithErrorHandlerMock.mockResolvedValue(undefined)
    localStorage.clear()
  })

  it('stops presence and ws, clears state, and logs out on desktop', async () => {
    const { host, mocks } = createMockHost()
    const state = new SessionRuntimeState()
    const cleanup = vi.fn()
    state.presenceChangeCleanup = cleanup
    state.cachedHasSession = true
    const service = new SessionLogoutService(host, state)

    await service.logoutCurrentSession()

    expect(stopPresenceHeartbeatMock).toHaveBeenCalled()
    expect(matrixWsBridgeStopMock).toHaveBeenCalled()
    expect(cleanup).toHaveBeenCalled()
    expect(state.presenceChangeCleanup).toBeNull()
    expect(state.cachedHasSession).toBeNull()
    expect(resetSearchIndexMock).toHaveBeenCalled()
    expect(matrixWorkerTerminateMock).toHaveBeenCalledWith('logout')
    expect(setPresenceMock).toHaveBeenCalledWith('unavailable')
    expect(mocks.logout).toHaveBeenCalled()
    expect(mocks.setTrayMenuShow).toHaveBeenCalledWith(false)
  })

  it('removes the beforeunload listener when it was registered', async () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    const { host } = createMockHost()
    const state = new SessionRuntimeState()
    state.beforeUnloadRegistered = true
    const service = new SessionLogoutService(host, state)

    await service.logoutCurrentSession()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', state.onBeforeUnload)
    expect(state.beforeUnloadRegistered).toBe(false)
  })

  it('creates the login window, emits logout, and resizes tray on desktop', async () => {
    const resizeWindow = vi.fn().mockResolvedValue(undefined)
    const createWebviewWindow = vi.fn().mockResolvedValue(undefined)
    useWindowMock.mockReturnValue({
      resizeWindow,
      createWebviewWindow
    } as unknown as ReturnType<typeof useWindow>)

    const { host } = createMockHost()
    const state = new SessionRuntimeState()
    const service = new SessionLogoutService(host, state)

    await service.logoutCurrentSession()

    expect(createWebviewWindow).toHaveBeenCalledWith('登录', 'login', 420, 640, undefined, false, 420, 640)
    expect(emitMock).toHaveBeenCalledWith(EventEnum.LOGOUT)
    expect(resizeWindow).toHaveBeenCalledWith('tray', 130, 44)
  })

  it('skips local state reset and only clears room id when resetLocalState is false', async () => {
    const { host, mocks } = createMockHost()
    const state = new SessionRuntimeState()
    const service = new SessionLogoutService(host, state)
    const resetSpy = vi.spyOn(
      service as unknown as { resetLocalSessionState: () => Promise<void> },
      'resetLocalSessionState'
    )

    await service.logoutCurrentSession({ resetLocalState: false })

    expect(resetSpy).not.toHaveBeenCalled()
    expect(mocks.updateCurrentSessionRoomId).toHaveBeenCalledWith('')
  })

  it('preserves tokens when preserveTokens option is passed down', async () => {
    const removeItemSpy = vi.spyOn(localStorage, 'removeItem')
    const { host } = createMockHost()
    const state = new SessionRuntimeState()
    const service = new SessionLogoutService(host, state)

    await service.logoutCurrentSession({ preserveTokens: true })

    expect(removeItemSpy).not.toHaveBeenCalled
    expect(invokeWithErrorHandlerMock).not.toHaveBeenCalledWith(TauriCommand.REMOVE_TOKENS)
  })

  it('emits logout without tray handling on mobile', async () => {
    isDesktopMock.mockReturnValue(false)
    const { host, mocks } = createMockHost()
    const state = new SessionRuntimeState()
    const service = new SessionLogoutService(host, state)

    await service.logoutCurrentSession()

    expect(mocks.logout).toHaveBeenCalled()
    expect(emitMock).toHaveBeenCalledWith(EventEnum.LOGOUT)
    expect(mocks.setTrayMenuShow).not.toHaveBeenCalled()
  })

  it('continues execution when resetSearchIndex fails', async () => {
    resetSearchIndexMock.mockRejectedValue(new Error('reset failed'))
    const { host, mocks } = createMockHost()
    const state = new SessionRuntimeState()
    const service = new SessionLogoutService(host, state)

    await expect(service.logoutCurrentSession()).resolves.toBeUndefined()
    expect(matrixWorkerTerminateMock).toHaveBeenCalledWith('logout')
    expect(mocks.logout).toHaveBeenCalled()
  })

  it('continues execution when setPresence fails', async () => {
    setPresenceMock.mockRejectedValue(new Error('presence failed'))
    const { host, mocks } = createMockHost()
    const state = new SessionRuntimeState()
    const service = new SessionLogoutService(host, state)

    await expect(service.logoutCurrentSession()).resolves.toBeUndefined()
    expect(mocks.logout).toHaveBeenCalled()
  })

  it('swallows desktop finishing errors', async () => {
    const createWebviewWindow = vi.fn().mockRejectedValue(new Error('window failed'))
    useWindowMock.mockReturnValue({
      resizeWindow: vi.fn().mockResolvedValue(undefined),
      createWebviewWindow
    } as unknown as ReturnType<typeof useWindow>)

    const { host, mocks } = createMockHost()
    const state = new SessionRuntimeState()
    const service = new SessionLogoutService(host, state)

    await expect(service.logoutCurrentSession()).resolves.toBeUndefined()
    expect(mocks.logout).toHaveBeenCalled()
  })
})
