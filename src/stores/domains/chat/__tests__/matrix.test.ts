import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMatrixStore } from '@/stores/domains/chat/matrix'

const { matrixClientServiceMock, getHomeserverUrlMock, matrixCapabilityServiceMock } = vi.hoisted(() => {
  const getHomeserverUrlMock = vi.fn(() => 'https://mock.homeserver.com')
  const getClientMock = vi.fn(() => ({
    getHomeserverUrl: getHomeserverUrlMock
  }))

  const matrixClientServiceMock = {
    getClient: getClientMock,
    isLoggedIn: vi.fn(() => false),
    login: vi.fn(),
    loginWithToken: vi.fn(),
    completeSSOLogin: vi.fn(),
    logout: vi.fn(),
    on: vi.fn(),
    initialize: vi.fn(),
    startClient: vi.fn()
  }

  const matrixCapabilityServiceMock = {
    refreshCapabilities: vi.fn()
  }
  return {
    matrixClientServiceMock,
    getHomeserverUrlMock,
    matrixCapabilityServiceMock
  }
})

vi.stubGlobal(
  'Worker',
  class {
    postMessage = vi.fn()
    terminate = vi.fn()
    addEventListener = vi.fn()
    removeEventListener = vi.fn()
    onmessage = null
    onerror = null
  }
)

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: matrixClientServiceMock
}))

vi.mock('@/services/matrix/MatrixCapabilityService', () => ({
  matrixCapabilityService: matrixCapabilityServiceMock
}))

describe('MatrixStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetAllMocks()
  })

  describe('initial state', () => {
    it('should have null userId initially', () => {
      const store = useMatrixStore()
      expect(store.userId).toBeNull()
    })

    it('should have null deviceId initially', () => {
      const store = useMatrixStore()
      expect(store.deviceId).toBeNull()
    })

    it('should have null accessToken initially', () => {
      const store = useMatrixStore()
      expect(store.accessToken).toBeNull()
    })

    it('should not be logged in initially', () => {
      const store = useMatrixStore()
      expect(store.isLoggedIn).toBe(false)
    })

    it('should have null homeserverUrl initially', () => {
      const store = useMatrixStore()
      expect(store.homeserverUrl).toBeNull()
    })
  })

  describe('setCredentials', () => {
    it('should set credentials correctly', () => {
      const store = useMatrixStore()
      store.userId = '@test:matrix.org'
      store.deviceId = 'DEVICE_ID'
      store.accessToken = 'ACCESS_TOKEN'

      expect(store.userId).toBe('@test:matrix.org')
      expect(store.deviceId).toBe('DEVICE_ID')
      expect(store.accessToken).toBe('ACCESS_TOKEN')
      expect(store.isLoggedIn).toBe(true)
    })
  })

  describe('clearCredentials', () => {
    it('should clear credentials correctly', () => {
      const store = useMatrixStore()
      store.userId = '@test:matrix.org'
      store.deviceId = 'DEVICE_ID'
      store.accessToken = 'ACCESS_TOKEN'

      expect(store.isLoggedIn).toBe(true)

      store.userId = null
      store.deviceId = null
      store.accessToken = null

      expect(store.userId).toBeNull()
      expect(store.deviceId).toBeNull()
      expect(store.accessToken).toBeNull()
      expect(store.isLoggedIn).toBe(false)
    })
  })

  describe('startClient', () => {
    it('should refresh capabilities after client starts', async () => {
      const store = useMatrixStore()

      store.isInitialized = true
      vi.mocked(matrixClientServiceMock.getClient).mockReturnValue({ getHomeserverUrl: getHomeserverUrlMock } as any)

      await store.startClient()

      expect(matrixClientServiceMock.startClient).toHaveBeenCalled()
      expect(matrixCapabilityServiceMock.refreshCapabilities).toHaveBeenCalled()
    })
  })

  describe('post-login startup budget', () => {
    it('returns from token restore when client startup does not settle in time', async () => {
      vi.useFakeTimers()
      const store = useMatrixStore()

      matrixClientServiceMock.loginWithToken.mockResolvedValue({
        success: true,
        userId: '@restore:matrix.test',
        accessToken: 'restore-token'
      })
      matrixClientServiceMock.startClient.mockReturnValue(new Promise(() => {}))

      const loginPromise = store.loginWithToken('restore-token', '@restore:matrix.test')
      await vi.advanceTimersByTimeAsync(15_000)

      await expect(loginPromise).resolves.toBe(true)
      expect(store.userId).toBe('@restore:matrix.test')
      expect(store.accessToken).toBe('restore-token')
      expect(matrixCapabilityServiceMock.refreshCapabilities).not.toHaveBeenCalled()
    })

    it('returns from password login when capability detection exceeds the startup budget', async () => {
      vi.useFakeTimers()
      const store = useMatrixStore()

      matrixClientServiceMock.login.mockResolvedValue({
        success: true,
        userId: '@alice:matrix.test',
        deviceId: 'ALICEDEVICE',
        accessToken: 'alice-token'
      })
      matrixClientServiceMock.startClient.mockResolvedValue(undefined)
      matrixCapabilityServiceMock.refreshCapabilities.mockReturnValue(new Promise(() => {}))

      const loginPromise = store.login('alice', 'pw', 'HuLa Test Device')
      await vi.advanceTimersByTimeAsync(15_000)

      await expect(loginPromise).resolves.toBe(true)
      expect(store.userId).toBe('@alice:matrix.test')
      expect(store.deviceId).toBe('ALICEDEVICE')
      expect(store.accessToken).toBe('alice-token')
      expect(matrixClientServiceMock.startClient).toHaveBeenCalledTimes(1)
      expect(matrixCapabilityServiceMock.refreshCapabilities).toHaveBeenCalledTimes(1)
    })

    it('returns from SSO login when post-login startup continues in the background', async () => {
      vi.useFakeTimers()
      const store = useMatrixStore()

      matrixClientServiceMock.completeSSOLogin.mockResolvedValue({
        success: true,
        userId: '@sso:matrix.test',
        deviceId: 'SSODEVICE',
        accessToken: 'sso-token'
      })
      matrixClientServiceMock.startClient.mockResolvedValue(undefined)
      matrixCapabilityServiceMock.refreshCapabilities.mockReturnValue(new Promise(() => {}))

      const loginPromise = store.completeSSOLogin('mock-login-token')
      await vi.advanceTimersByTimeAsync(15_000)

      await expect(loginPromise).resolves.toBe(true)
      expect(store.userId).toBe('@sso:matrix.test')
      expect(store.deviceId).toBe('SSODEVICE')
      expect(store.accessToken).toBe('sso-token')
      expect(matrixClientServiceMock.startClient).toHaveBeenCalledTimes(1)
      expect(matrixCapabilityServiceMock.refreshCapabilities).toHaveBeenCalledTimes(1)
    })
  })
})
