import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'

vi.mock('@vueuse/core', () => ({
  createSharedComposable: (fn: () => unknown) => fn,
  tryOnScopeDispose: vi.fn(),
  useOnline: vi.fn(() => ref(true))
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(vi.fn()))
}))

vi.mock('@/stores/domains/chat/matrix', () => ({
  useMatrixStore: vi.fn(() => ({
    connectionState: 'CONNECTED',
    isInitialized: true
  }))
}))

const { useNetworkStatus } = await import('../useNetworkStatus')

describe('useNetworkStatus', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('connection status', () => {
    it('should return isOnline as true when browser is online and ws is connected', () => {
      const status = useNetworkStatus()
      expect(status.isOnline.value).toBe(true)
    })

    it('should return isOffline as false when online', () => {
      const status = useNetworkStatus()
      expect(status.isOffline.value).toBe(false)
    })

    it('should return wsStatus as connected when matrix store is CONNECTED', () => {
      const status = useNetworkStatus()
      expect(status.wsStatus.value).toBe('connected')
    })

    it('should return wsOnline as true when connected', () => {
      const status = useNetworkStatus()
      expect(status.wsOnline.value).toBe(true)
    })

    it('should return isWsConnecting as false when connected', () => {
      const status = useNetworkStatus()
      expect(status.isWsConnecting.value).toBe(false)
    })
  })
})
