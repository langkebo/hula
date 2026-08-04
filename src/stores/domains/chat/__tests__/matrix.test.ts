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
    startClient: vi.fn(),
    stopClient: vi.fn(),
    getSSOLoginUrl: vi.fn()
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

vi.mock('@/stores/domains/admin/admin', () => ({
  useAdminStore: () => ({
    clearAdminState: vi.fn()
  })
}))

describe('MatrixStore', () => {
  beforeEach(() => {
    vi.useRealTimers()
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

    it('should have DISCONNECTED connection state initially', () => {
      const store = useMatrixStore()
      expect(store.connectionState).toBe('DISCONNECTED')
    })

    it('should not be connected initially', () => {
      const store = useMatrixStore()
      expect(store.isConnected).toBe(false)
    })

    it('should have null lastError initially', () => {
      const store = useMatrixStore()
      expect(store.lastError).toBeNull()
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

  describe('initialize', () => {
    it('should set homeserverUrl and mark initialized after initialize', async () => {
      const store = useMatrixStore()
      matrixClientServiceMock.initialize.mockResolvedValue(undefined)

      await store.initialize({
        homeserverUrl: 'https://matrix.test',
        userId: '@init:matrix.test',
        deviceId: 'INITDEV',
        accessToken: 'init-token'
      })

      expect(store.homeserverUrl).toBe('https://matrix.test')
      expect(store.userId).toBe('@init:matrix.test')
      expect(store.deviceId).toBe('INITDEV')
      expect(store.accessToken).toBe('init-token')
      expect(store.isInitialized).toBe(true)
      expect(store.connectionState).toBe('CONNECTING')
    })

    it('should register connectionState and sync event listeners', async () => {
      const store = useMatrixStore()
      matrixClientServiceMock.initialize.mockResolvedValue(undefined)

      await store.initialize({ homeserverUrl: 'https://matrix.test' })

      expect(matrixClientServiceMock.on).toHaveBeenCalledWith('connectionState', expect.any(Function))
      expect(matrixClientServiceMock.on).toHaveBeenCalledWith('sync', expect.any(Function))
    })

    it('should set ERROR state when initialize throws', async () => {
      const store = useMatrixStore()
      matrixClientServiceMock.initialize.mockRejectedValue(new Error('init failed'))

      await expect(store.initialize({ homeserverUrl: 'https://matrix.test' })).rejects.toThrow('init failed')
      expect(store.connectionState).toBe('ERROR')
      expect(store.isInitialized).toBe(false)
    })
  })

  describe('login', () => {
    it('should set credentials and return true on successful login', async () => {
      const store = useMatrixStore()
      matrixClientServiceMock.login.mockResolvedValue({
        success: true,
        userId: '@alice:matrix.test',
        deviceId: 'ALICEDEVICE',
        accessToken: 'alice-token'
      })
      matrixClientServiceMock.startClient.mockResolvedValue(undefined)
      matrixCapabilityServiceMock.refreshCapabilities.mockResolvedValue(undefined)

      const result = await store.login('alice', 'pw', 'Test Device')

      expect(result).toBe(true)
      expect(store.userId).toBe('@alice:matrix.test')
      expect(store.deviceId).toBe('ALICEDEVICE')
      expect(store.accessToken).toBe('alice-token')
      expect(store.connectionState).toBe('CONNECTED')
      expect(store.lastError).toBeNull()
    })

    it('should set lastError and return false on failed login', async () => {
      const store = useMatrixStore()
      matrixClientServiceMock.login.mockResolvedValue({
        success: false,
        error: 'Invalid password'
      })

      const result = await store.login('alice', 'wrong-pw')

      expect(result).toBe(false)
      expect(store.connectionState).toBe('ERROR')
      expect(store.lastError).toBe('Invalid password')
    })

    it('should set lastError and return false when login throws', async () => {
      const store = useMatrixStore()
      matrixClientServiceMock.login.mockRejectedValue(new Error('Network error'))

      const result = await store.login('alice', 'pw')

      expect(result).toBe(false)
      expect(store.connectionState).toBe('ERROR')
      expect(store.lastError).toBe('Network error')
    })
  })

  describe('loginWithToken', () => {
    it('should set credentials and return true on successful token login', async () => {
      const store = useMatrixStore()
      matrixClientServiceMock.loginWithToken.mockResolvedValue({
        success: true,
        userId: '@restore:matrix.test',
        deviceId: 'RESTOREDEVICE',
        accessToken: 'restore-token'
      })
      matrixClientServiceMock.startClient.mockResolvedValue(undefined)
      matrixCapabilityServiceMock.refreshCapabilities.mockResolvedValue(undefined)

      const result = await store.loginWithToken('restore-token', '@restore:matrix.test')

      expect(result).toBe(true)
      expect(store.userId).toBe('@restore:matrix.test')
      expect(store.deviceId).toBe('RESTOREDEVICE')
      expect(store.accessToken).toBe('restore-token')
      expect(store.connectionState).toBe('CONNECTED')
    })

    it('should set lastError and return false on failed token login', async () => {
      const store = useMatrixStore()
      matrixClientServiceMock.loginWithToken.mockResolvedValue({
        success: false,
        error: 'Token expired'
      })

      const result = await store.loginWithToken('expired-token', '@user:matrix.test')

      expect(result).toBe(false)
      expect(store.lastError).toBe('Token expired')
    })
  })

  describe('completeSSOLogin', () => {
    it('should set credentials and return true on successful SSO login', async () => {
      const store = useMatrixStore()
      matrixClientServiceMock.completeSSOLogin.mockResolvedValue({
        success: true,
        userId: '@sso:matrix.test',
        deviceId: 'SSODEVICE',
        accessToken: 'sso-token'
      })
      matrixClientServiceMock.startClient.mockResolvedValue(undefined)
      matrixCapabilityServiceMock.refreshCapabilities.mockResolvedValue(undefined)

      const result = await store.completeSSOLogin('sso-login-token')

      expect(result).toBe(true)
      expect(store.userId).toBe('@sso:matrix.test')
      expect(store.connectionState).toBe('CONNECTED')
    })

    it('should set lastError and return false on failed SSO login', async () => {
      const store = useMatrixStore()
      matrixClientServiceMock.completeSSOLogin.mockResolvedValue({
        success: false,
        error: 'Invalid login token'
      })

      const result = await store.completeSSOLogin('bad-token')

      expect(result).toBe(false)
      expect(store.lastError).toBe('Invalid login token')
    })
  })

  describe('logout', () => {
    it('should clear all credentials and reset state', async () => {
      const store = useMatrixStore()
      store.userId = '@test:matrix.test'
      store.deviceId = 'DEV1'
      store.accessToken = 'token123'
      store.connectionState = 'CONNECTED'
      store.isInitialized = true

      matrixClientServiceMock.logout.mockResolvedValue(undefined)

      await store.logout()

      expect(store.userId).toBeNull()
      expect(store.deviceId).toBeNull()
      expect(store.accessToken).toBeNull()
      expect(store.connectionState).toBe('DISCONNECTED')
      expect(store.syncState).toBeNull()
      expect(store.lastError).toBeNull()
      expect(store.isInitialized).toBe(false)
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

    it('should throw if client is not initialized', async () => {
      const store = useMatrixStore()
      store.isInitialized = false

      await expect(store.startClient()).rejects.toThrow('客户端未初始化')
    })
  })

  describe('stopClient', () => {
    it('should delegate to matrixClientService.stopClient', async () => {
      const store = useMatrixStore()
      matrixClientServiceMock.stopClient.mockResolvedValue(undefined)

      await store.stopClient()

      expect(matrixClientServiceMock.stopClient).toHaveBeenCalled()
    })
  })

  describe('post-login startup budget', () => {
    it('returns from token restore when client startup does not settle in time', async () => {
      vi.useFakeTimers()
      const store = useMatrixStore()

      matrixClientServiceMock.loginWithToken.mockResolvedValue({
        success: true,
        userId: '@restore:matrix.test',
        deviceId: 'RESTOREDEVICE',
        accessToken: 'restore-token'
      })
      matrixClientServiceMock.startClient.mockReturnValue(new Promise(() => {}))

      const loginPromise = store.loginWithToken('restore-token', '@restore:matrix.test')
      await vi.advanceTimersByTimeAsync(15_000)

      await expect(loginPromise).resolves.toBe(true)
      expect(store.userId).toBe('@restore:matrix.test')
      expect(store.deviceId).toBe('RESTOREDEVICE')
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

      const loginPromise = store.login('alice', 'pw', 'Tjg Test Device')
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

  describe('connection state transitions', () => {
    it('isLoggedIn is true only when both userId and accessToken are set', () => {
      const store = useMatrixStore()

      store.userId = '@test:matrix.test'
      store.accessToken = null
      expect(store.isLoggedIn).toBe(false)

      store.accessToken = 'token'
      expect(store.isLoggedIn).toBe(true)

      store.userId = null
      expect(store.isLoggedIn).toBe(false)
    })

    it('isConnected is true only when connectionState is CONNECTED', () => {
      const store = useMatrixStore()

      expect(store.isConnected).toBe(false)

      store.connectionState = 'CONNECTING'
      expect(store.isConnected).toBe(false)

      store.connectionState = 'CONNECTED'
      expect(store.isConnected).toBe(true)

      store.connectionState = 'ERROR'
      expect(store.isConnected).toBe(false)
    })
  })
})
