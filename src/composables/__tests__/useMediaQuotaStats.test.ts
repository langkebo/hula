import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMediaQuotaStats } from '../useMediaQuotaStats'

const { getQuotaStatsMock } = vi.hoisted(() => ({
  getQuotaStatsMock: vi.fn()
}))

vi.mock('@/services/matrix/media/MatrixMediaService', () => ({
  matrixMediaService: { getQuotaStats: getQuotaStatsMock }
}))

describe('useMediaQuotaStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('取到配额时进入 ready 并保留用量', async () => {
    getQuotaStatsMock.mockResolvedValue({ ok: true, stats: { storageBytes: 1, mediaCount: 2, limitBytes: 3 } })

    const quota = useMediaQuotaStats()
    void quota.load()
    await flushPromises()

    expect(quota.state.value).toBe('ready')
    expect(quota.stats.value).toEqual({ storageBytes: 1, mediaCount: 2, limitBytes: 3 })
  })

  it('服务端不支持时进入 unsupported，用量清空', async () => {
    getQuotaStatsMock.mockResolvedValue({ ok: false, reason: 'unsupported' })

    const quota = useMediaQuotaStats()
    void quota.load()
    await flushPromises()

    expect(quota.state.value).toBe('unsupported')
    expect(quota.stats.value).toBeNull()
  })

  it('本次取不到时进入 unavailable，重试成功后回到 ready', async () => {
    getQuotaStatsMock
      .mockResolvedValueOnce({ ok: false, reason: 'unavailable' })
      .mockResolvedValueOnce({ ok: true, stats: { storageBytes: 5, mediaCount: 1, limitBytes: 10 } })

    const quota = useMediaQuotaStats()
    void quota.load()
    await flushPromises()
    expect(quota.state.value).toBe('unavailable')

    void quota.load()
    await flushPromises()
    expect(quota.state.value).toBe('ready')
    expect(quota.stats.value?.mediaCount).toBe(1)
  })
})
