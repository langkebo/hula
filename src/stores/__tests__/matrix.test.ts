import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMatrixStore } from '@/stores/matrix'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('@/services/matrix', () => ({
  matrixClientService: {
    getClient: vi.fn(() => null),
    isLoggedIn: vi.fn(() => false),
    loginWithPassword: vi.fn(),
    logout: vi.fn(),
    on: vi.fn(),
    initialize: vi.fn()
  }
}))

describe('MatrixStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
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
})
