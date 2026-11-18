import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { checkQuotaMock, getQuotaStatsMock, getQuotaAlertsMock, getServerQuotaMock } = vi.hoisted(() => ({
  checkQuotaMock: vi.fn(),
  getQuotaStatsMock: vi.fn(),
  getQuotaAlertsMock: vi.fn(),
  getServerQuotaMock: vi.fn()
}))

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    checkQuota: checkQuotaMock,
    getQuotaStats: getQuotaStatsMock,
    getQuotaAlerts: getQuotaAlertsMock,
    getServerQuota: getServerQuotaMock
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

import { useQuotaStore } from '../quota'

describe('useQuotaStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('initializes with empty state', () => {
    const store = useQuotaStore()
    expect(store.quotaStatus).toBeNull()
    expect(store.quotaStats).toBeNull()
    expect(store.alerts).toEqual([])
    expect(store.serverQuota).toBeNull()
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('computed getters return zeros when quotaStatus is null', () => {
    const store = useQuotaStore()
    expect(store.quotaUsed).toBe(0)
    expect(store.quotaLimit).toBe(0)
    expect(store.quotaRemaining).toBe(0)
    expect(store.quotaPercentage).toBe(0)
    expect(store.isExceeded).toBe(false)
    expect(store.hasAlerts).toBe(false)
  })

  describe('fetchQuotaStatus', () => {
    it('loads quotaStatus and clears loading on success', async () => {
      const status = {
        used: 50,
        limit: 100,
        remaining: 50,
        percentage: 50,
        exceeded: false
      }
      checkQuotaMock.mockResolvedValue(status)

      const store = useQuotaStore()
      await store.fetchQuotaStatus()

      expect(store.quotaStatus).toEqual(status)
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
      expect(store.quotaUsed).toBe(50)
      expect(store.quotaLimit).toBe(100)
      expect(store.quotaRemaining).toBe(50)
      expect(store.quotaPercentage).toBe(50)
      expect(store.isExceeded).toBe(false)
    })

    it('sets error and clears loading on failure', async () => {
      checkQuotaMock.mockRejectedValue(new Error('network error'))

      const store = useQuotaStore()
      await store.fetchQuotaStatus()

      expect(store.loading).toBe(false)
      expect(store.error).toBe('network error')
      expect(store.quotaStatus).toBeNull()
    })

    it('sets generic error message for non-Error throws', async () => {
      checkQuotaMock.mockRejectedValue('string error')

      const store = useQuotaStore()
      await store.fetchQuotaStatus()

      expect(store.error).toBe('Failed to fetch quota status')
    })

    it('sets loading to true during fetch', async () => {
      let resolveFn: (v: unknown) => void
      checkQuotaMock.mockReturnValue(
        new Promise((resolve) => {
          resolveFn = resolve
        })
      )

      const store = useQuotaStore()
      const promise = store.fetchQuotaStatus()
      expect(store.loading).toBe(true)
      resolveFn!({})
      await promise
      expect(store.loading).toBe(false)
    })
  })

  describe('fetchQuotaStats', () => {
    it('loads quotaStats on success', async () => {
      const stats = { daily: [{ date: '2026-01-01', used: 10 }] }
      getQuotaStatsMock.mockResolvedValue(stats)

      const store = useQuotaStore()
      await store.fetchQuotaStats()

      expect(store.quotaStats).toEqual(stats)
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('sets error on failure', async () => {
      getQuotaStatsMock.mockRejectedValue(new Error('stats failed'))

      const store = useQuotaStore()
      await store.fetchQuotaStats()

      expect(store.error).toBe('stats failed')
      expect(store.loading).toBe(false)
    })

    it('sets generic error for non-Error throws', async () => {
      getQuotaStatsMock.mockRejectedValue(42)

      const store = useQuotaStore()
      await store.fetchQuotaStats()

      expect(store.error).toBe('Failed to fetch quota stats')
    })
  })

  describe('fetchAlerts', () => {
    it('loads alerts on success', async () => {
      const alerts = [{ level: 'warn' }, { level: 'error' }]
      getQuotaAlertsMock.mockResolvedValue(alerts)

      const store = useQuotaStore()
      await store.fetchAlerts()

      expect(store.alerts).toEqual(alerts)
      expect(store.hasAlerts).toBe(true)
    })

    it('does not throw on failure (records alertsError instead)', async () => {
      getQuotaAlertsMock.mockRejectedValue(new Error('alerts failed'))

      const store = useQuotaStore()
      await expect(store.fetchAlerts()).resolves.toBeUndefined()
      expect(store.alerts).toEqual([])
      expect(store.hasAlerts).toBe(false)
      // 失败必须留下可判定状态，UI 才能显示「暂不可用」而不是「暂无告警」
      expect(store.alertsError).toBe('alerts failed')
    })

    it('clears alertsError before a new attempt', async () => {
      getQuotaAlertsMock.mockRejectedValueOnce(new Error('alerts failed'))
      getQuotaAlertsMock.mockResolvedValueOnce([{ level: 'warn' }])

      const store = useQuotaStore()
      await store.fetchAlerts()
      expect(store.alertsError).toBe('alerts failed')

      await store.fetchAlerts()
      expect(store.alertsError).toBeNull()
      expect(store.alerts).toEqual([{ level: 'warn' }])
    })

    it('hasAlerts is false when alerts array is empty', async () => {
      getQuotaAlertsMock.mockResolvedValue([])

      const store = useQuotaStore()
      await store.fetchAlerts()

      expect(store.hasAlerts).toBe(false)
    })
  })

  describe('fetchServerQuota', () => {
    it('loads server quota from the admin endpoint', async () => {
      const serverQuota = { totalSize: 2048, totalCount: 12, defaultSizeLimit: 1024, defaultCountLimit: 100 }
      getServerQuotaMock.mockResolvedValue(serverQuota)

      const store = useQuotaStore()
      await store.fetchServerQuota()

      expect(store.serverQuota).toEqual(serverQuota)
      expect(getServerQuotaMock).toHaveBeenCalledTimes(1)
    })

    it('keeps server quota empty when the endpoint fails', async () => {
      getServerQuotaMock.mockRejectedValue(new Error('forbidden'))

      const store = useQuotaStore()
      await expect(store.fetchServerQuota()).resolves.toBeUndefined()
      expect(store.serverQuota).toBeNull()
    })
  })

  describe('fetchAllQuota', () => {
    it('loads user quota, stats, alerts and server quota together', async () => {
      checkQuotaMock.mockResolvedValue({ used: 1, limit: 2, remaining: 1, percentage: 50, exceeded: false })
      getQuotaStatsMock.mockResolvedValue({ storageBytes: 10, mediaCount: 1, limitBytes: 100 })
      getQuotaAlertsMock.mockResolvedValue([])
      getServerQuotaMock.mockResolvedValue({
        totalSize: 10,
        totalCount: 1,
        defaultSizeLimit: 100,
        defaultCountLimit: 10
      })

      const store = useQuotaStore()
      await store.fetchAllQuota()

      expect(checkQuotaMock).toHaveBeenCalledTimes(1)
      expect(getQuotaStatsMock).toHaveBeenCalledTimes(1)
      expect(getQuotaAlertsMock).toHaveBeenCalledTimes(1)
      expect(getServerQuotaMock).toHaveBeenCalledTimes(1)
      expect(store.serverQuota).not.toBeNull()
    })

    it('does not reject when one of the quota requests fails', async () => {
      checkQuotaMock.mockRejectedValue(new Error('boom'))
      getQuotaStatsMock.mockResolvedValue({ storageBytes: 0, mediaCount: 0, limitBytes: 0 })
      getQuotaAlertsMock.mockResolvedValue([])
      getServerQuotaMock.mockResolvedValue({ totalSize: 0, totalCount: 0, defaultSizeLimit: 0, defaultCountLimit: 0 })

      const store = useQuotaStore()
      await expect(store.fetchAllQuota()).resolves.toBeUndefined()
      expect(store.quotaStats).not.toBeNull()
    })
  })

  describe('clearError', () => {
    it('clears the error state', async () => {
      checkQuotaMock.mockRejectedValue(new Error('err'))
      const store = useQuotaStore()
      await store.fetchQuotaStatus()
      expect(store.error).toBe('err')

      store.clearError()
      expect(store.error).toBeNull()
    })
  })

  describe('$reset', () => {
    it('resets all state to initial values', async () => {
      checkQuotaMock.mockResolvedValue({ used: 1, limit: 2 })
      getQuotaAlertsMock.mockResolvedValue([{ level: 'warn' }])

      const store = useQuotaStore()
      await store.fetchQuotaStatus()
      await store.fetchAlerts()
      store.clearError()

      store.$reset()
      expect(store.quotaStatus).toBeNull()
      expect(store.quotaStats).toBeNull()
      expect(store.alerts).toEqual([])
      expect(store.serverQuota).toBeNull()
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
      expect(store.alertsError).toBeNull()
    })
  })

  describe('isExceeded getter', () => {
    it('returns true when quotaStatus.exceeded is true', async () => {
      checkQuotaMock.mockResolvedValue({
        used: 110,
        limit: 100,
        remaining: 0,
        percentage: 110,
        exceeded: true
      })

      const store = useQuotaStore()
      await store.fetchQuotaStatus()

      expect(store.isExceeded).toBe(true)
    })
  })
})
