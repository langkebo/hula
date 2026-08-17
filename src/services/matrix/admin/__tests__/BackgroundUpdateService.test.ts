import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminBackgroundUpdateService } from '../BackgroundUpdateService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const manager = {
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

const makeClient = () => ({ getBackgroundUpdateManager: () => manager }) as unknown as MatrixClient

const makeService = () => {
  const client = makeClient()
  const service = new AdminBackgroundUpdateService(() => client)
  return { service, client }
}

describe('AdminBackgroundUpdateService — P1-1 后台更新管理', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listUpdates 委托 listBackgroundUpdates 并透传 limit/from', async () => {
    const { service } = makeService()
    manager.listBackgroundUpdates.mockResolvedValue({
      updates: [{ job_name: 'job-1', status: 'pending' }],
      next_batch: 'token-abc'
    })

    const result = await service.listUpdates({ limit: 50, from: 'cursor' })

    expect(manager.listBackgroundUpdates).toHaveBeenCalledWith({ limit: 50, from: 'cursor' })
    expect(result.updates).toHaveLength(1)
    expect(result.updates[0].job_name).toBe('job-1')
    expect(result.next_batch).toBe('token-abc')
  })

  it('listUpdates 在出错时降级为空列表', async () => {
    const { service } = makeService()
    manager.listBackgroundUpdates.mockRejectedValue(new Error('boom'))

    const result = await service.listUpdates()
    expect(result.updates).toEqual([])
    expect(result.next_batch).toBeUndefined()
  })

  it('getUpdate 委托 getUpdate(jobName)', async () => {
    const { service } = makeService()
    manager.getUpdate.mockResolvedValue({ job_name: 'job-x', status: 'running' })

    const result = await service.getUpdate('job-x')
    expect(manager.getUpdate).toHaveBeenCalledWith('job-x')
    expect(result?.job_name).toBe('job-x')
  })

  it('getUpdate 在 404 时返回 null', async () => {
    const { service } = makeService()
    const err = Object.assign(new Error('not found'), { httpStatus: 404 })
    manager.getUpdate.mockRejectedValue(err)

    const result = await service.getUpdate('missing')
    expect(result).toBeNull()
  })

  it('createUpdate 委托 createBackgroundUpdate 并透传 body', async () => {
    const { service } = makeService()
    manager.createBackgroundUpdate.mockResolvedValue({ job_name: 'new-job', status: 'pending' })

    const result = await service.createUpdate({
      job_name: 'new-job',
      job_type: 'index_rebuild',
      description: 'rebuild index'
    })

    expect(manager.createBackgroundUpdate).toHaveBeenCalledWith({
      job_name: 'new-job',
      job_type: 'index_rebuild',
      description: 'rebuild index'
    })
    expect(result.job_name).toBe('new-job')
  })

  it('startUpdate 委托 startUpdate(jobName)', async () => {
    const { service } = makeService()
    manager.startUpdate.mockResolvedValue({ job_name: 'job-1', status: 'running' })

    await service.startUpdate('job-1')
    expect(manager.startUpdate).toHaveBeenCalledWith('job-1')
  })

  it('cancelUpdate 委托 cancelUpdate(jobName)', async () => {
    const { service } = makeService()
    manager.cancelUpdate.mockResolvedValue({ job_name: 'job-1', status: 'cancelled' })

    await service.cancelUpdate('job-1')
    expect(manager.cancelUpdate).toHaveBeenCalledWith('job-1')
  })

  it('completeUpdate 委托 completeUpdate(jobName)', async () => {
    const { service } = makeService()
    manager.completeUpdate.mockResolvedValue({ job_name: 'job-1', status: 'completed' })

    await service.completeUpdate('job-1')
    expect(manager.completeUpdate).toHaveBeenCalledWith('job-1')
  })

  it('failUpdate 委托 failUpdate(jobName, {error_message})', async () => {
    const { service } = makeService()
    manager.failUpdate.mockResolvedValue({ job_name: 'job-1', status: 'failed' })

    await service.failUpdate('job-1', 'disk full')
    expect(manager.failUpdate).toHaveBeenCalledWith('job-1', { error_message: 'disk full' })
  })

  it('deleteUpdate 委托 deleteUpdate(jobName)', async () => {
    const { service } = makeService()
    manager.deleteUpdate.mockResolvedValue(undefined)

    await service.deleteUpdate('job-1')
    expect(manager.deleteUpdate).toHaveBeenCalledWith('job-1')
  })

  it('retryFailed 委托 retryFailedUpdates', async () => {
    const { service } = makeService()
    manager.retryFailedUpdates.mockResolvedValue({ retried_count: 3 })

    const result = await service.retryFailed()
    expect(manager.retryFailedUpdates).toHaveBeenCalled()
    expect(result.retried_count).toBe(3)
  })

  it('cleanupLocks 委托 cleanupLocks', async () => {
    const { service } = makeService()
    manager.cleanupLocks.mockResolvedValue({ cleaned_count: 5 })

    const result = await service.cleanupLocks()
    expect(result.cleaned_count).toBe(5)
  })

  it('getStatus 委托 getStatus', async () => {
    const { service } = makeService()
    manager.getStatus.mockResolvedValue({
      pending_count: 1,
      running_count: 1,
      completed_count: 5,
      failed_count: 2,
      total_count: 9,
      current_update: null
    })

    const result = await service.getStatus()
    expect(result.pending_count).toBe(1)
    expect(result.total_count).toBe(9)
  })

  it('getStatus 在出错时返回零值状态', async () => {
    const { service } = makeService()
    manager.getStatus.mockRejectedValue(new Error('boom'))

    const result = await service.getStatus()
    expect(result.pending_count).toBe(0)
    expect(result.total_count).toBe(0)
  })

  it('getHistory 委托 getHistory(jobName, {limit})', async () => {
    const { service } = makeService()
    manager.getHistory.mockResolvedValue([{ id: 1, job_name: 'job-1', status: 'completed' }])

    const result = await service.getHistory('job-1', { limit: 10 })
    expect(manager.getHistory).toHaveBeenCalledWith('job-1', { limit: 10 })
    expect(result).toHaveLength(1)
  })

  it('getStats 委托 getStats(days)', async () => {
    const { service } = makeService()
    manager.getStats.mockResolvedValue([{ job_name: 'job-1', total_updates: 10, completed_updates: 8 }])

    const result = await service.getStats({ limit: 30 })
    expect(manager.getStats).toHaveBeenCalledWith(30)
    expect(result[0].total_updates).toBe(10)
  })
})
