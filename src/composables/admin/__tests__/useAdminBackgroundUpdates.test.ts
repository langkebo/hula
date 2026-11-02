import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BackgroundUpdate, BackgroundUpdateStatusSummary } from '@/services/matrix/admin/BackgroundUpdateService'
import { AUTO_REFRESH_INTERVAL_MS, useAdminBackgroundUpdates } from '../useAdminBackgroundUpdates'

const { backgroundUpdatesMock } = vi.hoisted(() => ({
  backgroundUpdatesMock: {
    listUpdates: vi.fn(),
    getStatus: vi.fn(),
    startUpdate: vi.fn(),
    cancelUpdate: vi.fn(),
    retryFailed: vi.fn(),
    cleanupLocks: vi.fn()
  }
}))

vi.mock('@/services/matrix/admin', () => ({
  adminService: { backgroundUpdates: backgroundUpdatesMock }
}))

function update(overrides: Partial<BackgroundUpdate> = {}): BackgroundUpdate {
  return {
    job_name: 'index_rebuild',
    job_type: 'index',
    status: 'running',
    progress: null,
    total_items: 100,
    processed_items: 20,
    created_ts: 1_700_000_000,
    retry_count: 0,
    ...overrides
  }
}

const SUMMARY: BackgroundUpdateStatusSummary = {
  pending_count: 1,
  running_count: 1,
  completed_count: 2,
  failed_count: 0,
  total_count: 4,
  current_update: update()
}

describe('useAdminBackgroundUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    backgroundUpdatesMock.listUpdates.mockResolvedValue({ updates: [update()] })
    backgroundUpdatesMock.getStatus.mockResolvedValue(SUMMARY)
    backgroundUpdatesMock.startUpdate.mockResolvedValue(update({ status: 'running' }))
    backgroundUpdatesMock.cancelUpdate.mockResolvedValue(update({ status: 'cancelled' }))
    backgroundUpdatesMock.retryFailed.mockResolvedValue({ retried_count: 2 })
    backgroundUpdatesMock.cleanupLocks.mockResolvedValue({ cleaned_count: 3 })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loadAll 拉取任务列表与汇总状态', async () => {
    const c = useAdminBackgroundUpdates()
    await c.loadAll()

    expect(c.updates.value).toHaveLength(1)
    expect(c.summary.value).toEqual(SUMMARY)
    expect(backgroundUpdatesMock.listUpdates).toHaveBeenCalledTimes(1)
    expect(backgroundUpdatesMock.getStatus).toHaveBeenCalledTimes(1)
  })

  it('任一接口失败时以空列表/空汇总降级', async () => {
    backgroundUpdatesMock.listUpdates.mockRejectedValue(new Error('boom'))
    backgroundUpdatesMock.getStatus.mockRejectedValue(new Error('boom'))

    const c = useAdminBackgroundUpdates()
    await c.loadAll()

    expect(c.updates.value).toEqual([])
    expect(c.summary.value).toBeNull()
  })

  it('startUpdate 后重新加载列表', async () => {
    const c = useAdminBackgroundUpdates()
    await c.startUpdate('index_rebuild')

    expect(backgroundUpdatesMock.startUpdate).toHaveBeenCalledWith('index_rebuild')
    expect(backgroundUpdatesMock.listUpdates).toHaveBeenCalledTimes(1)
    expect(c.actionLoading.value).toBe(false)
  })

  it('cancelUpdate 失败时复位 actionLoading 并向上抛出', async () => {
    backgroundUpdatesMock.cancelUpdate.mockRejectedValue(new Error('cancel failed'))

    const c = useAdminBackgroundUpdates()
    await expect(c.cancelUpdate('index_rebuild')).rejects.toThrow('cancel failed')
    expect(c.actionLoading.value).toBe(false)
  })

  it('retryFailed / cleanupLocks 返回操作数量并刷新', async () => {
    const c = useAdminBackgroundUpdates()

    await expect(c.retryFailed()).resolves.toBe(2)
    await expect(c.cleanupLocks()).resolves.toBe(3)
    expect(backgroundUpdatesMock.listUpdates).toHaveBeenCalledTimes(2)
    expect(c.actionLoading.value).toBe(false)
  })

  it('setAutoRefresh 按固定间隔轮询，stopAutoRefresh 可随时停止', async () => {
    vi.useFakeTimers()
    const c = useAdminBackgroundUpdates()

    c.setAutoRefresh(true)
    expect(c.autoRefresh.value).toBe(true)
    expect(backgroundUpdatesMock.listUpdates).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(AUTO_REFRESH_INTERVAL_MS)
    expect(backgroundUpdatesMock.listUpdates).toHaveBeenCalledTimes(1)

    c.stopAutoRefresh()
    expect(c.autoRefresh.value).toBe(false)

    await vi.advanceTimersByTimeAsync(AUTO_REFRESH_INTERVAL_MS)
    expect(backgroundUpdatesMock.listUpdates).toHaveBeenCalledTimes(1)
  })

  it('重复开启不会叠加定时器', async () => {
    vi.useFakeTimers()
    const c = useAdminBackgroundUpdates()

    c.setAutoRefresh(true)
    c.setAutoRefresh(true)
    await vi.advanceTimersByTimeAsync(AUTO_REFRESH_INTERVAL_MS)

    expect(backgroundUpdatesMock.listUpdates).toHaveBeenCalledTimes(1)
  })

  it('操作进行中跳过本轮轮询', async () => {
    vi.useFakeTimers()
    const c = useAdminBackgroundUpdates()
    c.setAutoRefresh(true)

    backgroundUpdatesMock.startUpdate.mockImplementation(() => new Promise(() => {}))
    void c.startUpdate('index_rebuild')

    await vi.advanceTimersByTimeAsync(AUTO_REFRESH_INTERVAL_MS)
    expect(backgroundUpdatesMock.listUpdates).not.toHaveBeenCalled()
  })
})
