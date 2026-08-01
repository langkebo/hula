import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminBackgroundUpdateService } from '../BackgroundUpdateService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const makeService = () => {
  const backgroundUpdateManager = {
    listBackgroundUpdates: vi.fn(),
    getUpdate: vi.fn(),
    createBackgroundUpdate: vi.fn(),
    startUpdate: vi.fn(),
    cancelUpdate: vi.fn(),
    completeUpdate: vi.fn(),
    failUpdate: vi.fn(),
    deleteUpdate: vi.fn(),
    retryFailedUpdates: vi.fn(),
    cleanupLocks: vi.fn(),
    getStatus: vi.fn(),
    getHistory: vi.fn(),
    getStats: vi.fn()
  }
  const client = {
    getBackgroundUpdateManager: () => backgroundUpdateManager
  } as unknown as MatrixClient
  const service = new AdminBackgroundUpdateService(() => client)
  return { service, client, backgroundUpdateManager }
}

describe('AdminBackgroundUpdateService — P1-1 后台更新管理', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listUpdates 委托 listBackgroundUpdates 并映射结果', async () => {
    const { service, backgroundUpdateManager } = makeService()
    backgroundUpdateManager.listBackgroundUpdates.mockResolvedValue({
      updates: [{ job_name: 'job-1', status: 'pending' }],
      next_batch: 'token-abc'
    })

    const result = await service.listUpdates({ limit: 50, from: 'cursor' })

    expect(backgroundUpdateManager.listBackgroundUpdates).toHaveBeenCalledWith({ limit: 50, from: 'cursor' })
    expect(result.updates).toHaveLength(1)
    expect(result.updates[0].job_name).toBe('job-1')
    expect(result.next_batch).toBe('token-abc')
  })

  it('listUpdates 默认 limit=100 且出错时降级为空列表', async () => {
    const { service, backgroundUpdateManager } = makeService()
    backgroundUpdateManager.listBackgroundUpdates.mockRejectedValue(new Error('boom'))

    const result = await service.listUpdates()
    expect(backgroundUpdateManager.listBackgroundUpdates).toHaveBeenCalledWith({ limit: 100, from: undefined })
    expect(result.updates).toEqual([])
    expect(result.next_batch).toBeUndefined()
  })

  it('getUpdate 委托 manager 并透传 job_name', async () => {
    const { service, backgroundUpdateManager } = makeService()
    backgroundUpdateManager.getUpdate.mockResolvedValue({ job_name: 'job-x', status: 'running' })

    const result = await service.getUpdate('job-x')
    expect(backgroundUpdateManager.getUpdate).toHaveBeenCalledWith('job-x')
    expect(result?.job_name).toBe('job-x')
  })

  it('getUpdate 在 404 时返回 null', async () => {
    const { service, backgroundUpdateManager } = makeService()
    const err = Object.assign(new Error('not found'), { httpStatus: 404 })
    backgroundUpdateManager.getUpdate.mockRejectedValue(err)

    const result = await service.getUpdate('missing')
    expect(result).toBeNull()
  })

  it('createUpdate 委托 createBackgroundUpdate 并透传 body', async () => {
    const { service, backgroundUpdateManager } = makeService()
    backgroundUpdateManager.createBackgroundUpdate.mockResolvedValue({ job_name: 'new-job', status: 'pending' })

    const result = await service.createUpdate({
      job_name: 'new-job',
      job_type: 'index_rebuild',
      description: 'rebuild index'
    })

    expect(backgroundUpdateManager.createBackgroundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        job_name: 'new-job',
        job_type: 'index_rebuild',
        description: 'rebuild index'
      })
    )
    expect(result.job_name).toBe('new-job')
  })

  it('startUpdate 委托 startUpdate 并透传 job_name', async () => {
    const { service, backgroundUpdateManager } = makeService()
    backgroundUpdateManager.startUpdate.mockResolvedValue({ job_name: 'job-1', status: 'running' })

    await service.startUpdate('job-1')
    expect(backgroundUpdateManager.startUpdate).toHaveBeenCalledWith('job-1')
  })

  it('cancelUpdate 委托 cancelUpdate 并透传 job_name', async () => {
    const { service, backgroundUpdateManager } = makeService()
    backgroundUpdateManager.cancelUpdate.mockResolvedValue({ job_name: 'job-1', status: 'cancelled' })

    await service.cancelUpdate('job-1')
    expect(backgroundUpdateManager.cancelUpdate).toHaveBeenCalledWith('job-1')
  })

  it('completeUpdate 委托 completeUpdate 并透传 job_name', async () => {
    const { service, backgroundUpdateManager } = makeService()
    backgroundUpdateManager.completeUpdate.mockResolvedValue({ job_name: 'job-1', status: 'completed' })

    await service.completeUpdate('job-1')
    expect(backgroundUpdateManager.completeUpdate).toHaveBeenCalledWith('job-1')
  })

  it('failUpdate 委托 failUpdate 并携带 error_message', async () => {
    const { service, backgroundUpdateManager } = makeService()
    backgroundUpdateManager.failUpdate.mockResolvedValue({ job_name: 'job-1', status: 'failed' })

    await service.failUpdate('job-1', 'disk full')
    expect(backgroundUpdateManager.failUpdate).toHaveBeenCalledWith('job-1', { error_message: 'disk full' })
  })

  it('deleteUpdate 委托 deleteUpdate 并透传 job_name', async () => {
    const { service, backgroundUpdateManager } = makeService()
    backgroundUpdateManager.deleteUpdate.mockResolvedValue(undefined)

    await service.deleteUpdate('job-1')
    expect(backgroundUpdateManager.deleteUpdate).toHaveBeenCalledWith('job-1')
  })

  it('retryFailed 委托 retryFailedUpdates 并映射 retried_count', async () => {
    const { service, backgroundUpdateManager } = makeService()
    backgroundUpdateManager.retryFailedUpdates.mockResolvedValue({ retried_count: 3 })

    const result = await service.retryFailed()
    expect(backgroundUpdateManager.retryFailedUpdates).toHaveBeenCalledTimes(1)
    expect(result.retried_count).toBe(3)
  })

  it('cleanupLocks 委托 cleanupLocks 并映射 cleaned_count', async () => {
    const { service, backgroundUpdateManager } = makeService()
    backgroundUpdateManager.cleanupLocks.mockResolvedValue({ cleaned_count: 5 })

    const result = await service.cleanupLocks()
    expect(backgroundUpdateManager.cleanupLocks).toHaveBeenCalledTimes(1)
    expect(result.cleaned_count).toBe(5)
  })

  it('getStatus 委托 manager.getStatus 并映射结果', async () => {
    const { service, backgroundUpdateManager } = makeService()
    backgroundUpdateManager.getStatus.mockResolvedValue({
      pending_count: 1,
      running_count: 1,
      completed_count: 5,
      failed_count: 2,
      total_count: 9,
      current_update: null
    })

    const result = await service.getStatus()
    expect(backgroundUpdateManager.getStatus).toHaveBeenCalledTimes(1)
    expect(result.pending_count).toBe(1)
    expect(result.total_count).toBe(9)
  })

  it('getStatus 在出错时返回零值状态', async () => {
    const { service, backgroundUpdateManager } = makeService()
    backgroundUpdateManager.getStatus.mockRejectedValue(new Error('boom'))

    const result = await service.getStatus()
    expect(result.pending_count).toBe(0)
    expect(result.total_count).toBe(0)
  })

  it('getHistory 委托 manager.getHistory 并透传 limit', async () => {
    const { service, backgroundUpdateManager } = makeService()
    backgroundUpdateManager.getHistory.mockResolvedValue([{ id: 1, job_name: 'job-1', status: 'completed' }])

    const result = await service.getHistory('job-1', { limit: 10 })
    expect(backgroundUpdateManager.getHistory).toHaveBeenCalledWith('job-1', { limit: 10 })
    expect(result).toHaveLength(1)
  })

  it('getStats 委托 manager.getStats 并透传 limit', async () => {
    const { service, backgroundUpdateManager } = makeService()
    backgroundUpdateManager.getStats.mockResolvedValue([
      { job_name: 'job-1', total_updates: 10, completed_updates: 8 }
    ])

    const result = await service.getStats({ limit: 30 })
    expect(backgroundUpdateManager.getStats).toHaveBeenCalledWith(30)
    expect(result[0].total_updates).toBe(10)
  })
})
