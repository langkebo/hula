import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
    userId: '@admin:example.com',
    accessToken: 'syt_test_token',
    homeserverUrl: 'https://matrix.test'
  })
}))

import { invoke } from '@tauri-apps/api/core'
import { useAdminStore } from '../admin'

describe('AdminStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('initializes with non-admin state', () => {
    const store = useAdminStore()
    expect(store.isAdmin).toBe(false)
    expect(store.isCheckingAdmin).toBe(false)
  })

  it('canAccessAdmin is false when not admin', () => {
    const store = useAdminStore()
    expect(store.canAccessAdmin).toBe(false)
  })

  it('checkAdminStatus returns true when both checks pass', async () => {
    vi.mocked(invoke).mockResolvedValue({ is_admin: true, user_id: '@admin:example.com' })
    getUserMock.mockResolvedValue({ userId: '@admin:example.com', admin: true } as never)

    const store = useAdminStore()
    const result = await store.checkAdminStatus()
    expect(result).toBe(true)
    expect(store.isAdmin).toBe(true)
    expect(invoke).toHaveBeenCalledWith('check_admin_status', {
      userId: '@admin:example.com',
      accessToken: 'syt_test_token',
      homeserverUrl: 'https://matrix.test'
    })
  })

  it('checkAdminStatus returns false when backend says no', async () => {
    vi.mocked(invoke).mockResolvedValue({ is_admin: false, user_id: '@user:example.com' })
    getUserMock.mockResolvedValue({ userId: '@user:example.com', admin: true } as never)

    const store = useAdminStore()
    const result = await store.checkAdminStatus()
    expect(result).toBe(false)
  })

  it('checkAdminStatus returns false when frontend says no', async () => {
    vi.mocked(invoke).mockResolvedValue({ is_admin: true, user_id: '@admin:example.com' })
    getUserMock.mockResolvedValue({ userId: '@admin:example.com', admin: false } as never)

    const store = useAdminStore()
    const result = await store.checkAdminStatus()
    expect(result).toBe(false)
  })

  it('checkAdminStatus handles backend error', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('Network error'))
    getUserMock.mockResolvedValue({ userId: '@admin:example.com', admin: true } as never)

    const store = useAdminStore()
    const result = await store.checkAdminStatus()
    expect(result).toBe(false)
  })

  it('checkAdminStatus caches result within interval', async () => {
    vi.mocked(invoke).mockResolvedValue({ is_admin: true, user_id: '@admin:example.com' })
    getUserMock.mockResolvedValue({ userId: '@admin:example.com', admin: true } as never)

    const store = useAdminStore()
    await store.checkAdminStatus()
    expect(invoke).toHaveBeenCalledTimes(1)

    const result = await store.checkAdminStatus()
    expect(result).toBe(true)
    expect(invoke).toHaveBeenCalledTimes(1)
  })

  it('clearAdminState resets state', async () => {
    vi.mocked(invoke).mockResolvedValue({ is_admin: true, user_id: '@admin:example.com' })
    getUserMock.mockResolvedValue({ userId: '@admin:example.com', admin: true } as never)

    const store = useAdminStore()
    await store.checkAdminStatus()
    expect(store.isAdmin).toBe(true)

    store.clearAdminState()
    expect(store.isAdmin).toBe(false)
  })

  it('verifyAdminAccess delegates to checkAdminStatus', async () => {
    vi.mocked(invoke).mockResolvedValue({ is_admin: true, user_id: '@admin:example.com' })
    getUserMock.mockResolvedValue({ userId: '@admin:example.com', admin: true } as never)

    const store = useAdminStore()
    const result = await store.verifyAdminAccess()
    expect(result).toBe(true)
  })
})
