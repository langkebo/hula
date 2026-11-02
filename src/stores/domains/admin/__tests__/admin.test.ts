import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ok } from '@/common/result'

// --- hoisted mocks ---
const { getUserMock, probeAdminApiMock, invokeWithResultMock, logSpies } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  probeAdminApiMock: vi.fn(),
  invokeWithResultMock: vi.fn(),
  logSpies: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

const ADMIN_API_AVAILABLE = {
  status: 'available',
  statusCode: 200,
  errorCode: null,
  apiPresent: true,
  authorized: true
}

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
    apiProbe: { probe: probeAdminApiMock }
  }
}))

vi.mock('@/utils/TauriInvokeHandler', () => ({
  invokeWithResult: invokeWithResultMock
}))

vi.mock('@/utils/AppHarness', () => ({
  hasTauriRuntime: () => true
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => logSpies
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
    probeAdminApiMock.mockResolvedValue(ADMIN_API_AVAILABLE)
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
      probeAdminApiMock.mockClear()
      getUserMock.mockClear()
      invokeWithResultMock.mockClear()
      await store.checkAdminStatus()
      expect(getUserMock).not.toHaveBeenCalled()
    })
  })

  describe('Admin API 不可用/无权限时的日志分类', () => {
    function allLogMessages(): string[] {
      return [...logSpies.warn.mock.calls, ...logSpies.info.mock.calls, ...logSpies.error.mock.calls].map(([msg]) =>
        String(msg)
      )
    }

    it('403（无权限）不得被报成「后端 Admin API 不可用」', async () => {
      probeAdminApiMock.mockResolvedValue({
        status: 'forbidden',
        statusCode: 403,
        errorCode: 'M_FORBIDDEN',
        apiPresent: true,
        authorized: false
      })
      // 前端也判 false：让"前后端不一致"分支不参与，避免噪声掩盖本用例的判据
      getUserMock.mockResolvedValue({ userId: '@admin:example.com', admin: false })

      const store = useAdminStore()
      const result = await store.checkAdminStatus()

      expect(result).toBe(false)
      const messages = allLogMessages().join('\n')
      expect(messages).not.toContain('不可用')
      // 必须点明"可达但无权限"，否则排障会去查后端部署
      expect(messages).toContain('可达')
      expect(messages).toContain('管理员权限')
      // 无权限是业务事实，不是异常 ⇒ 不该打 warn
      expect(logSpies.warn).not.toHaveBeenCalled()
    })

    it('404（该 homeserver 无 Admin API）报告为未提供，而不是网络故障', async () => {
      probeAdminApiMock.mockResolvedValue({
        status: 'unsupported',
        statusCode: 404,
        errorCode: 'M_UNRECOGNIZED',
        apiPresent: false,
        authorized: false
      })

      const store = useAdminStore()
      await store.checkAdminStatus()

      const messages = allLogMessages().join('\n')
      expect(messages).toContain('未提供 Admin API')
      expect(messages).not.toContain('不可用')
    })

    it('真正无法判定（网络/5xx）才用 warn 且明确说"无法判定"', async () => {
      probeAdminApiMock.mockResolvedValue({
        status: 'unavailable',
        statusCode: null,
        errorCode: null,
        apiPresent: null,
        authorized: false
      })

      const store = useAdminStore()
      await store.checkAdminStatus()

      expect(logSpies.warn.mock.calls.map(([msg]) => String(msg)).join('\n')).toContain('无法判定')
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

  describe('Admin API 五态与入口判定', () => {
    it('探测结果写入 store，并标记已加载', async () => {
      probeAdminApiMock.mockResolvedValue({
        status: 'forbidden',
        statusCode: 403,
        errorCode: 'M_FORBIDDEN',
        apiPresent: true,
        authorized: false
      })
      getUserMock.mockResolvedValue({ userId: '@admin:example.com', admin: false })

      const store = useAdminStore()
      await store.checkAdminStatus()

      expect(store.apiAvailability?.status).toBe('forbidden')
      expect(store.availabilityLoaded).toBe(true)
    })

    it('available 且为管理员时展示入口', async () => {
      const store = useAdminStore()
      await store.checkAdminStatus()
      expect(store.isAdmin).toBe(true)
      expect(store.canShowAdminEntry).toBe(true)
    })

    it('unsupported（homeserver 无 Admin API）时隐藏入口', async () => {
      const store = useAdminStore()
      await store.checkAdminStatus()
      expect(store.canShowAdminEntry).toBe(true)

      store.apiAvailability = {
        status: 'unsupported',
        statusCode: 404,
        errorCode: 'M_UNRECOGNIZED',
        apiPresent: false,
        authorized: false
      }
      expect(store.canShowAdminEntry).toBe(false)
    })

    it('unavailable 时保留入口，便于进入后台重试探测', async () => {
      const store = useAdminStore()
      await store.checkAdminStatus()

      store.apiAvailability = {
        status: 'unavailable',
        statusCode: null,
        errorCode: null,
        apiPresent: null,
        authorized: false
      }
      expect(store.canShowAdminEntry).toBe(true)
    })

    it('retryApiProbe() 清缓存并重新探测', async () => {
      const store = useAdminStore()
      await store.checkAdminStatus()
      expect(probeAdminApiMock).toHaveBeenCalledTimes(1)

      await store.checkAdminStatus()
      expect(probeAdminApiMock).toHaveBeenCalledTimes(1)

      await store.retryApiProbe()
      expect(probeAdminApiMock).toHaveBeenCalledTimes(2)
    })

    it('clearAdminState() 同时重置探测状态', async () => {
      const store = useAdminStore()
      await store.checkAdminStatus()
      expect(store.availabilityLoaded).toBe(true)

      store.clearAdminState()
      expect(store.apiAvailability).toBeNull()
      expect(store.availabilityLoaded).toBe(false)
    })
  })
})
