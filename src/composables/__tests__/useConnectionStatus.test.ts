import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

const matrixStoreMock = reactive<{
  connectionState: string
  isInitialized: boolean
  startClient: ReturnType<typeof vi.fn>
}>({
  connectionState: 'DISCONNECTED',
  isInitialized: false,
  startClient: vi.fn(() => Promise.resolve())
})

vi.mock('@/stores/domains/chat/matrix', () => ({
  useMatrixStore: () => matrixStoreMock
}))

const { useConnectionStatus } = await import('@/composables/useConnectionStatus')

describe('useConnectionStatus', () => {
  beforeEach(() => {
    matrixStoreMock.connectionState = 'DISCONNECTED'
    matrixStoreMock.isInitialized = false
    matrixStoreMock.startClient = vi.fn(() => Promise.resolve())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('state 映射', () => {
    it('CONNECTED 映射为 online', () => {
      matrixStoreMock.connectionState = 'CONNECTED'
      matrixStoreMock.isInitialized = true
      const { state } = useConnectionStatus()
      expect(state.value).toBe('online')
    })

    it('CONNECTING 且未初始化时映射为 idle（首次登录不显示横幅）', () => {
      matrixStoreMock.connectionState = 'CONNECTING'
      matrixStoreMock.isInitialized = false
      const { state } = useConnectionStatus()
      expect(state.value).toBe('idle')
    })

    it('CONNECTING 且已初始化时映射为 connecting', () => {
      matrixStoreMock.connectionState = 'CONNECTING'
      matrixStoreMock.isInitialized = true
      const { state } = useConnectionStatus()
      expect(state.value).toBe('connecting')
    })

    it('RECONNECTING 映射为 reconnecting', () => {
      matrixStoreMock.connectionState = 'RECONNECTING'
      matrixStoreMock.isInitialized = true
      const { state } = useConnectionStatus()
      expect(state.value).toBe('reconnecting')
    })

    it('CATCHUP 映射为 syncing（同步历史消息瞬态）', () => {
      matrixStoreMock.connectionState = 'CATCHUP'
      matrixStoreMock.isInitialized = true
      const { state } = useConnectionStatus()
      expect(state.value).toBe('syncing')
    })

    it('ERROR 映射为 error', () => {
      matrixStoreMock.connectionState = 'ERROR'
      matrixStoreMock.isInitialized = true
      const { state } = useConnectionStatus()
      expect(state.value).toBe('error')
    })

    it('DISCONNECTED 且未初始化时映射为 idle（不应显示网络已断开）', () => {
      matrixStoreMock.connectionState = 'DISCONNECTED'
      matrixStoreMock.isInitialized = false
      const { state } = useConnectionStatus()
      expect(state.value).toBe('idle')
    })

    it('DISCONNECTED 且已初始化时映射为 offline', () => {
      matrixStoreMock.connectionState = 'DISCONNECTED'
      matrixStoreMock.isInitialized = true
      const { state } = useConnectionStatus()
      expect(state.value).toBe('offline')
    })

    it('未知状态映射为 idle', () => {
      matrixStoreMock.connectionState = 'UNKNOWN_STATE'
      matrixStoreMock.isInitialized = true
      const { state } = useConnectionStatus()
      expect(state.value).toBe('idle')
    })
  })

  describe('state 响应式', () => {
    it('store 状态变化时 state 计算属性同步更新', () => {
      matrixStoreMock.connectionState = 'DISCONNECTED'
      matrixStoreMock.isInitialized = true
      const { state } = useConnectionStatus()
      expect(state.value).toBe('offline')

      matrixStoreMock.connectionState = 'CONNECTED'
      expect(state.value).toBe('online')

      matrixStoreMock.connectionState = 'ERROR'
      expect(state.value).toBe('error')
    })
  })

  describe('retry', () => {
    it('调用 retry 时递增 retryCount 并调用 startClient', async () => {
      matrixStoreMock.connectionState = 'DISCONNECTED'
      matrixStoreMock.isInitialized = true
      const { retry, retryCount } = useConnectionStatus()
      expect(retryCount.value).toBe(0)

      await retry()
      expect(retryCount.value).toBe(1)
      expect(matrixStoreMock.startClient).toHaveBeenCalledTimes(1)
    })

    it('多次调用 retry 累加 retryCount', async () => {
      const { retry, retryCount } = useConnectionStatus()
      await retry()
      await retry()
      await retry()
      expect(retryCount.value).toBe(3)
      expect(matrixStoreMock.startClient).toHaveBeenCalledTimes(3)
    })

    it('startClient 抛错时 retry 不抛出，retryCount 仍递增', async () => {
      matrixStoreMock.startClient = vi.fn(() => Promise.reject(new Error('network error')))
      const { retry, retryCount } = useConnectionStatus()
      await expect(retry()).resolves.toBeUndefined()
      expect(retryCount.value).toBe(1)
    })
  })
})
