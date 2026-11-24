import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

const { ensureClientReady } = vi.hoisted(() => ({
  ensureClientReady: vi.fn(() => Promise.resolve())
}))

/** 当前窗口是否为登录类窗口（login/register/forgetPassword）。 */
const windowMock = vi.hoisted(() => ({ isLogin: false }))

const matrixStoreMock = reactive<{
  connectionState: string
  isInitialized: boolean
  isLoggedIn: boolean
  shouldOwnClient: boolean
  startClient: ReturnType<typeof vi.fn>
}>({
  connectionState: 'DISCONNECTED',
  isInitialized: false,
  isLoggedIn: false,
  // 默认 true = 主窗口（已声明要拥有 client）；登录窗口用例显式置 false
  shouldOwnClient: true,
  startClient: vi.fn(() => Promise.resolve())
})

vi.mock('@/stores/domains/chat/matrix', () => ({
  useMatrixStore: () => matrixStoreMock
}))

vi.mock('@/utils/windowLabels', () => ({
  isLoginWindow: () => windowMock.isLogin
}))

vi.mock('@/services/matrix/auth/SessionOrchestrator', () => ({
  sessionOrchestrator: { ensureClientReady }
}))

const { useConnectionStatus } = await import('@/composables/useConnectionStatus')

describe('useConnectionStatus', () => {
  beforeEach(() => {
    matrixStoreMock.connectionState = 'DISCONNECTED'
    matrixStoreMock.isInitialized = false
    matrixStoreMock.isLoggedIn = false
    matrixStoreMock.shouldOwnClient = true
    matrixStoreMock.startClient = vi.fn(() => Promise.resolve())
    windowMock.isLogin = false
    ensureClientReady.mockClear()
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

    it('DISCONNECTED 且未初始化、未登录时映射为 idle（不应显示网络已断开）', () => {
      matrixStoreMock.connectionState = 'DISCONNECTED'
      matrixStoreMock.isInitialized = false
      matrixStoreMock.isLoggedIn = false
      const { state } = useConnectionStatus()
      expect(state.value).toBe('idle')
    })

    it('DISCONNECTED 且未初始化但已登录时映射为 error（整页重载后必须提示断线，D12）', () => {
      matrixStoreMock.connectionState = 'DISCONNECTED'
      matrixStoreMock.isInitialized = false
      matrixStoreMock.isLoggedIn = true
      matrixStoreMock.shouldOwnClient = true
      const { state } = useConnectionStatus()
      expect(state.value).toBe('error')
    })

    it('DISCONNECTED + 未初始化 + 已登录，但本窗口未声明拥有 client 时映射为 idle', () => {
      // 登录窗口的真实情形：userId 由 persist 恢复 ⇒ isLoggedIn 为 true，
      // 但该窗口不建 client。若据此判 error，登录页会显示"连接失败"，与事实相反。
      matrixStoreMock.connectionState = 'DISCONNECTED'
      matrixStoreMock.isInitialized = false
      matrixStoreMock.isLoggedIn = true
      matrixStoreMock.shouldOwnClient = false
      const { state } = useConnectionStatus()
      expect(state.value).toBe('idle')
    })

    it('登录类窗口无论 store 什么状态都映射为 idle', () => {
      windowMock.isLogin = true
      for (const cs of ['CONNECTED', 'DISCONNECTED', 'ERROR', 'RECONNECTING', 'CATCHUP']) {
        matrixStoreMock.connectionState = cs
        matrixStoreMock.isInitialized = true
        matrixStoreMock.isLoggedIn = true
        const { state } = useConnectionStatus()
        expect(state.value, `connectionState=${cs}`).toBe('idle')
      }
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
      matrixStoreMock.isInitialized = true
      const { retry, retryCount } = useConnectionStatus()
      await retry()
      await retry()
      await retry()
      expect(retryCount.value).toBe(3)
      expect(matrixStoreMock.startClient).toHaveBeenCalledTimes(3)
    })

    it('startClient 抛错时 retry 不抛出，retryCount 仍递增', async () => {
      matrixStoreMock.isInitialized = true
      matrixStoreMock.startClient = vi.fn(() => Promise.reject(new Error('network error')))
      const { retry, retryCount } = useConnectionStatus()
      await expect(retry()).resolves.toBeUndefined()
      expect(retryCount.value).toBe(1)
    })

    it('client 未建立时 retry 走会话恢复而不是 startClient（D12）', async () => {
      matrixStoreMock.isInitialized = false
      const { retry, retryCount } = useConnectionStatus()

      await retry()

      expect(retryCount.value).toBe(1)
      expect(ensureClientReady).toHaveBeenCalledTimes(1)
      expect(matrixStoreMock.startClient).not.toHaveBeenCalled()
    })

    it('会话恢复失败时 retry 不抛出，retryCount 仍递增', async () => {
      matrixStoreMock.isInitialized = false
      ensureClientReady.mockRejectedValueOnce(new Error('restore failed'))
      const { retry, retryCount } = useConnectionStatus()
      await expect(retry()).resolves.toBeUndefined()
      expect(retryCount.value).toBe(1)
    })

    it('登录类窗口里 retry 是空操作（不允许用残留凭证恢复会话）', async () => {
      windowMock.isLogin = true
      matrixStoreMock.isInitialized = false
      matrixStoreMock.isLoggedIn = true
      const { retry, retryCount } = useConnectionStatus()

      await retry()

      expect(retryCount.value).toBe(0)
      expect(ensureClientReady).not.toHaveBeenCalled()
      expect(matrixStoreMock.startClient).not.toHaveBeenCalled()
    })
  })
})
