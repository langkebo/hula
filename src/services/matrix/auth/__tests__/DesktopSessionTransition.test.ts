import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DesktopSessionTransition } from '../DesktopSessionTransition'
import type { SessionRuntimeHost } from '../sessionRuntimeInternal'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('@/utils/AppHarness', () => ({
  hasTauriRuntime: vi.fn().mockReturnValue(true)
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isDesktop: vi.fn().mockReturnValue(true)
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: {
    getByLabel: vi.fn().mockResolvedValue(null)
  }
}))

const mockGetByLabel = vi.mocked((await import('@tauri-apps/api/webviewWindow')).WebviewWindow.getByLabel)

const { hasTauriRuntime } = await import('@/utils/AppHarness')
const { isDesktop } = await import('@/utils/PlatformConstants')

const hasTauriRuntimeMock = vi.mocked(hasTauriRuntime)
const isDesktopMock = vi.mocked(isDesktop)

vi.mock('@/composables/common/useWindow', () => ({
  useWindow: vi.fn()
}))

const { useWindow } = await import('@/composables/common/useWindow')
const useWindowMock = vi.mocked(useWindow)

function createMockHost(overrides?: Partial<SessionRuntimeHost>): SessionRuntimeHost {
  const port = {
    matrix: {
      getClient: vi.fn(),
      getUserId: vi.fn().mockReturnValue('@alice:test'),
      isLoggedIn: vi.fn().mockReturnValue(true),
      isInitialized: vi.fn().mockReturnValue(true),
      getLastError: vi.fn(),
      getAccessToken: vi.fn(),
      getRefreshToken: vi.fn(),
      getHomeserverUrl: vi.fn(),
      initialize: vi.fn().mockResolvedValue(undefined),
      login: vi.fn().mockResolvedValue(true),
      completeSSOLogin: vi.fn().mockResolvedValue(true),
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

  return host
}

describe('DesktopSessionTransition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isDesktopMock.mockReturnValue(true)
    hasTauriRuntimeMock.mockReturnValue(true)
    mockGetByLabel.mockResolvedValue(null)
  })

  describe('applyDesktopLoginState', () => {
    it('shows the tray menu and resizes the tray window on desktop', async () => {
      const resizeWindow = vi.fn().mockResolvedValue(undefined)
      useWindowMock.mockReturnValue({
        resizeWindow
      } as unknown as ReturnType<typeof useWindow>)

      const host = createMockHost()
      const service = new DesktopSessionTransition(host)

      await service.applyDesktopLoginState()

      expect(host.port.global.setTrayMenuShow).toHaveBeenCalledWith(true)
      expect(resizeWindow).toHaveBeenCalledWith('tray', 130, 356)
    })

    it('is a no-op on mobile', async () => {
      isDesktopMock.mockReturnValue(false)
      const host = createMockHost()
      const service = new DesktopSessionTransition(host)

      await service.applyDesktopLoginState()

      expect(host.port.global.setTrayMenuShow).not.toHaveBeenCalled()
      expect(useWindowMock).not.toHaveBeenCalled()
    })

    it('is a no-op without a Tauri runtime', async () => {
      hasTauriRuntimeMock.mockReturnValue(false)
      const host = createMockHost()
      const service = new DesktopSessionTransition(host)

      await service.applyDesktopLoginState()

      expect(host.port.global.setTrayMenuShow).not.toHaveBeenCalled()
      expect(useWindowMock).not.toHaveBeenCalled()
    })

    it('swallows errors from the resize step', async () => {
      const resizeWindow = vi.fn().mockRejectedValue(new Error('resize failed'))
      useWindowMock.mockReturnValue({
        resizeWindow
      } as unknown as ReturnType<typeof useWindow>)

      const host = createMockHost()
      const service = new DesktopSessionTransition(host)

      await expect(service.applyDesktopLoginState()).resolves.toBeUndefined()
      expect(host.port.global.setTrayMenuShow).toHaveBeenCalledWith(true)
    })
  })

  describe('openDesktopHomeWindow', () => {
    it('closes the register window and opens the home window on desktop', async () => {
      const registerWindow = { close: vi.fn().mockResolvedValue(undefined) }
      mockGetByLabel.mockResolvedValue(registerWindow as never)
      const createWebviewWindow = vi.fn().mockResolvedValue(undefined)
      useWindowMock.mockReturnValue({
        createWebviewWindow
      } as unknown as ReturnType<typeof useWindow>)

      const host = createMockHost()
      const service = new DesktopSessionTransition(host)

      await service.openDesktopHomeWindow()

      expect(mockGetByLabel).toHaveBeenCalledWith('register')
      expect(registerWindow.close).toHaveBeenCalled()
      expect(createWebviewWindow).toHaveBeenCalledWith(
        'Tjg',
        'home',
        1280,
        800,
        'login',
        true,
        1024,
        600,
        undefined,
        false
      )
    })

    it('skips closing when no register window exists', async () => {
      mockGetByLabel.mockResolvedValue(null)
      const createWebviewWindow = vi.fn().mockResolvedValue(undefined)
      useWindowMock.mockReturnValue({
        createWebviewWindow
      } as unknown as ReturnType<typeof useWindow>)

      const host = createMockHost()
      const service = new DesktopSessionTransition(host)

      await service.openDesktopHomeWindow()

      expect(createWebviewWindow).toHaveBeenCalled()
    })

    it('is a no-op on mobile', async () => {
      isDesktopMock.mockReturnValue(false)
      const host = createMockHost()
      const service = new DesktopSessionTransition(host)

      await service.openDesktopHomeWindow()

      expect(useWindowMock).not.toHaveBeenCalled()
    })

    it('swallows register window close errors', async () => {
      const registerWindow = { close: vi.fn().mockRejectedValue(new Error('close failed')) }
      mockGetByLabel.mockResolvedValue(registerWindow as never)
      const createWebviewWindow = vi.fn().mockResolvedValue(undefined)
      useWindowMock.mockReturnValue({
        createWebviewWindow
      } as unknown as ReturnType<typeof useWindow>)

      const host = createMockHost()
      const service = new DesktopSessionTransition(host)

      await expect(service.openDesktopHomeWindow()).resolves.toBeUndefined()
      expect(createWebviewWindow).toHaveBeenCalled()
    })

    it('swallows errors when creating the home window fails', async () => {
      const createWebviewWindow = vi.fn().mockRejectedValue(new Error('create failed'))
      useWindowMock.mockReturnValue({
        createWebviewWindow
      } as unknown as ReturnType<typeof useWindow>)

      const host = createMockHost()
      const service = new DesktopSessionTransition(host)

      await expect(service.openDesktopHomeWindow()).resolves.toBeUndefined()
    })
  })

  describe('completeDesktopLoginTransition', () => {
    it('applies desktop state then opens the home window', async () => {
      const resizeWindow = vi.fn().mockResolvedValue(undefined)
      const createWebviewWindow = vi.fn().mockResolvedValue(undefined)
      useWindowMock.mockReturnValue({
        resizeWindow,
        createWebviewWindow
      } as unknown as ReturnType<typeof useWindow>)

      const host = createMockHost()
      const service = new DesktopSessionTransition(host)

      await service.completeDesktopLoginTransition()

      expect(host.port.global.setTrayMenuShow).toHaveBeenCalledWith(true)
      expect(resizeWindow).toHaveBeenCalledWith('tray', 130, 356)
      expect(createWebviewWindow).toHaveBeenCalled()
    })

    it('swallows errors from the transition steps', async () => {
      isDesktopMock.mockReturnValue(true)
      const resizeWindow = vi.fn().mockRejectedValue(new Error('resize failed'))
      useWindowMock.mockReturnValue({
        resizeWindow,
        createWebviewWindow: vi.fn().mockResolvedValue(undefined)
      } as unknown as ReturnType<typeof useWindow>)

      const host = createMockHost()
      const service = new DesktopSessionTransition(host)

      await expect(service.completeDesktopLoginTransition()).resolves.toBeUndefined()
    })
  })
})
