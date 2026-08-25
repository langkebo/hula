import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ok } from '@/common/result'

// --- hoisted mocks ---
const { getUserMock, checkAdminApiAvailabilityMock, invokeWithResultMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  checkAdminApiAvailabilityMock: vi.fn(),
  invokeWithResultMock: vi.fn()
}))

// mock MatrixStore（admin store 的前置依赖）
const matrixStoreMock = {
  isLoggedIn: true,
  isInitialized: true,
  userId: '@admin:example.com',
  accessToken: 'syt_test_token',
  homeserverUrl: 'https://matrix.test'
}

vi.mock('@/stores/domains/chat/matrix', () => ({
  useMatrixStore: () => matrixStoreMock
}))

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    getUser: getUserMock,
    checkAdminApiAvailability: checkAdminApiAvailabilityMock
  }
}))

vi.mock('@/utils/TauriInvokeHandler', () => ({
  invokeWithResult: invokeWithResultMock
}))

vi.mock('@/utils/AppHarness', () => ({
  hasTauriRuntime: () => true
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

// --- import after mocks ---
import { useAdminStore } from '../admin'

describe('AdminStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    matrixStoreMock.isLoggedIn = true
    matrixStoreMock.isInitialized = true
    matrixStoreMock.userId = '@admin:example.com'
    matrixStoreMock.accessToken = 'syt_test_token'
    matrixStoreMock.homeserverUrl = 'https://matrix.test'
    checkAdminApiAvailabilityMock.mockResolvedValue(true)
    getUserMock.mockResolvedValue({ userId: '@admin:example.com', admin: true })
    invokeWithResultMock.mockResolvedValue(ok({ is_admin: true, user_id: '@admin:example.com' }))
  })

  describe('checkAdminStatus()', () => {
    it('未登录时直接返回 false', async () => {
      matrixStoreMock.isLoggedIn = false
      const store = useAdminStore()
      const result = await store.checkAdminStatus()
      expect(result).toBe(false)
      expect(store.isAdmin).toBe(false)
    })

    it('客户端未初始化时跳过检查', async () => {
      matrixStoreMock.isInitialized = false
      const store = useAdminStore()
      const result = await store.checkAdminStatus()
      expect(result).toBe(false)
      expect(getUserMock).not.toHaveBeenCalled()
    })

    it('前后端均确认 admin → isAdmin 为 true', async () => {
      const store = useAdminStore()
      const result = await store.checkAdminStatus()
      expect(result).toBe(true)
      expect(store.isAdmin).toBe(true)
    })

    it('前端确认 admin 但后端不确认 → isAdmin 为 false（不一致降级）', async () => {
      invokeWithResultMock.mockResolvedValueOnce(ok({ is_admin: false, user_id: '@admin:example.com' }))

      const store = useAdminStore()
      const result = await store.checkAdminStatus()
      expect(result).toBe(false)
      expect(store.isAdmin).toBe(false)
    })

    it('getUser 抛异常时 isAdmin 为 false', async () => {
      getUserMock.mockRejectedValueOnce(new Error('network'))
      const store = useAdminStore()
      const result = await store.checkAdminStatus()
      expect(result).toBe(false)
      expect(store.isAdmin).toBe(false)
    })

    it('缓存期内重复调用不重复请求', async () => {
      const store = useAdminStore()
      await store.checkAdminStatus()
      checkAdminApiAvailabilityMock.mockClear()
      getUserMock.mockClear()
      invokeWithResultMock.mockClear()
      await store.checkAdminStatus()
      expect(getUserMock).not.toHaveBeenCalled()
    })
  })

  describe('verifyAdminAccess()', () => {
    it('委托给 checkAdminStatus', async () => {
      const store = useAdminStore()
      const result = await store.verifyAdminAccess()
      expect(result).toBe(true)
    })
  })

  describe('clearAdminState()', () => {
    it('重置管理员状态', async () => {
      const store = useAdminStore()
      await store.checkAdminStatus()
      expect(store.isAdmin).toBe(true)

      store.clearAdminState()
      expect(store.isAdmin).toBe(false)
    })
  })
})
