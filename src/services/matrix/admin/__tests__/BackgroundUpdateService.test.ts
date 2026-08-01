import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminBackgroundUpdateService } from '../BackgroundUpdateService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const makeClient = () => {
  const authedRequest = vi.fn()
  return {
    authedRequest,
    http: { authedRequest }
  } as unknown as MatrixClient & {
    http: { authedRequest: typeof authedRequest }
  }
}

const makeService = () => {
  const client = makeClient()
  const service = new AdminBackgroundUpdateService(() => client)
  return { service, client }
}

describe('AdminBackgroundUpdateService — P1-1 后台更新管理', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listUpdates 使用 GET /background_updates 拉取列表', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockResolvedValue({
      updates: [{ job_name: 'job-1', status: 'pending' }],
      next_batch: 'token-abc'
    })

    const result = await service.listUpdates({ limit: 50, from: 'cursor' })

    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'GET',
      '/background_updates',
      expect.objectContaining({ limit: 50, from: 'cursor' }),
      undefined,
      expect.objectContaining({ prefix: '/_synapse/admin/v1' })
    )
    expect(result.updates).toHaveLength(1)
    expect(result.updates[0].job_name).toBe('job-1')
    expect(result.next_batch).toBe('token-abc')
  })

  it('listUpdates 在出错时降级为空列表', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockRejectedValue(new Error('boom'))

    const result = await service.listUpdates()
    expect(result.updates).toEqual([])
    expect(result.next_batch).toBeUndefined()
  })

  it('getUpdate 路径包含 job_name', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockResolvedValue({ job_name: 'job-x', status: 'running' })

    const result = await service.getUpdate('job-x')
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'GET',
      '/background_updates/job-x',
      undefined,
      undefined,
      expect.any(Object)
    )
    expect(result?.job_name).toBe('job-x')
  })

  it('getUpdate 在 404 时返回 null', async () => {
    const { service, client } = makeService()
    const err = Object.assign(new Error('not found'), { httpStatus: 404 })
    client.http.authedRequest.mockRejectedValue(err)

    const result = await service.getUpdate('missing')
    expect(result).toBeNull()
  })

  it('createUpdate 使用 POST 并透传 body', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockResolvedValue({ job_name: 'new-job', status: 'pending' })

    const result = await service.createUpdate({
      job_name: 'new-job',
      job_type: 'index_rebuild',
      description: 'rebuild index'
    })

    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'POST',
      '/background_updates',
      undefined,
      expect.objectContaining({
        job_name: 'new-job',
        job_type: 'index_rebuild',
        description: 'rebuild index'
      }),
      expect.any(Object)
    )
    expect(result.job_name).toBe('new-job')
  })

  it('startUpdate 使用 POST /background_updates/{job_name}/start', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockResolvedValue({ job_name: 'job-1', status: 'running' })

    await service.startUpdate('job-1')
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'POST',
      '/background_updates/job-1/start',
      undefined,
      undefined,
      expect.any(Object)
    )
  })

  it('cancelUpdate 使用 POST /background_updates/{job_name}/cancel', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockResolvedValue({ job_name: 'job-1', status: 'cancelled' })

    await service.cancelUpdate('job-1')
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'POST',
      '/background_updates/job-1/cancel',
      undefined,
      undefined,
      expect.any(Object)
    )
  })

  it('completeUpdate 使用 POST /background_updates/{job_name}/complete', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockResolvedValue({ job_name: 'job-1', status: 'completed' })

    await service.completeUpdate('job-1')
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'POST',
      '/background_updates/job-1/complete',
      undefined,
      undefined,
      expect.any(Object)
    )
  })

  it('failUpdate 使用 POST /background_updates/{job_name}/fail 并携带 error_message', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockResolvedValue({ job_name: 'job-1', status: 'failed' })

    await service.failUpdate('job-1', 'disk full')
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'POST',
      '/background_updates/job-1/fail',
      undefined,
      { error_message: 'disk full' },
      expect.any(Object)
    )
  })

  it('deleteUpdate 使用 DELETE /background_updates/{job_name}', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockResolvedValue(undefined)

    await service.deleteUpdate('job-1')
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'DELETE',
      '/background_updates/job-1',
      undefined,
      undefined,
      expect.any(Object)
    )
  })

  it('retryFailed 使用 POST /background_updates/retry_failed', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockResolvedValue({ retried_count: 3 })

    const result = await service.retryFailed()
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'POST',
      '/background_updates/retry_failed',
      undefined,
      undefined,
      expect.any(Object)
    )
    expect(result.retried_count).toBe(3)
  })

  it('cleanupLocks 使用 POST /background_updates/cleanup_locks', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockResolvedValue({ cleaned_count: 5 })

    const result = await service.cleanupLocks()
    expect(result.cleaned_count).toBe(5)
  })

  it('getStatus 使用 GET /background_updates/status', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockResolvedValue({
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
    const { service, client } = makeService()
    client.http.authedRequest.mockRejectedValue(new Error('boom'))

    const result = await service.getStatus()
    expect(result.pending_count).toBe(0)
    expect(result.total_count).toBe(0)
  })

  it('getHistory 使用 GET /background_updates/{job_name}/history', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockResolvedValue([{ id: 1, job_name: 'job-1', status: 'completed' }])

    const result = await service.getHistory('job-1', { limit: 10 })
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'GET',
      '/background_updates/job-1/history',
      expect.objectContaining({ limit: 10 }),
      undefined,
      expect.any(Object)
    )
    expect(result).toHaveLength(1)
  })

  it('getStats 使用 GET /background_updates/stats', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockResolvedValue([{ job_name: 'job-1', total_updates: 10, completed_updates: 8 }])

    const result = await service.getStats({ limit: 30 })
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'GET',
      '/background_updates/stats',
      expect.objectContaining({ limit: 30 }),
      undefined,
      expect.any(Object)
    )
    expect(result[0].total_updates).toBe(10)
  })
})
