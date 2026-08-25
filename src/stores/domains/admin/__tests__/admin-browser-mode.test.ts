import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// C-1 反馈回路：模拟浏览器 dev 模式（无 Tauri runtime）
// 预期：前端校验通过时，即使 Tauri 不可用，isAdmin 也应为 true
// 当前：RED — 因 backendResult(false) !== frontendResult(true) → isAdmin 被强制 false

const { getUserMock, checkAdminApiAvailabilityMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  checkAdminApiAvailabilityMock: vi.fn(() => Promise.resolve(true))
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn()
}))

// 关键：模拟浏览器 dev 模式 — Tauri 不可用
vi.mock('@/utils/AppHarness', () => ({
  hasTauriRuntime: () => false,
  isBrowser: () => true
}))

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    getUser: getUserMock,
    checkAdminApiAvailability: checkAdminApiAvailabilityMock
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('../../chat/matrix', () => ({
  useMatrixStore: () => ({
    isLoggedIn: true,
    isInitialized: true,
    userId: '@admin1:matrix.test',
    accessToken: 'syt_admin_token',
    homeserverUrl: 'https://matrix.test'
  })
}))

import { useAdminStore } from '../admin'

describe('AdminStore — C-1 浏览器 dev 模式（无 Tauri runtime）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('Tauri 不可用时，前端校验通过 → isAdmin 应为 true', async () => {
    // 前端校验返回 admin=true
    getUserMock.mockResolvedValue({ userId: '@admin1:matrix.test', admin: true } as never)

    const store = useAdminStore()
    const result = await store.checkAdminStatus()

    // 预期：浏览器 dev 模式下应跳过后端校验，仅依赖前端校验
    expect(result).toBe(true)
    expect(store.isAdmin).toBe(true)
  })

  it('Tauri 不可用时，前端校验也失败 → isAdmin 应为 false', async () => {
    getUserMock.mockResolvedValue({ userId: '@user:matrix.test', admin: false } as never)

    const store = useAdminStore()
    const result = await store.checkAdminStatus()

    expect(result).toBe(false)
    expect(store.isAdmin).toBe(false)
  })

  it('Tauri 不可用时，canAccessAdmin 在前端校验通过后应为 true', async () => {
    getUserMock.mockResolvedValue({ userId: '@admin1:matrix.test', admin: true } as never)

    const store = useAdminStore()
    await store.checkAdminStatus()

    expect(store.canAccessAdmin).toBe(true)
  })
})
