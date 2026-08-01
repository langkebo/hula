import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AdminExternalServiceService,
  type ExternalService,
  type ExternalServiceHealth
} from '../ExternalServiceService'

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
  const service = new AdminExternalServiceService(() => client)
  return { service, client }
}

const sampleService: ExternalService = {
  as_id: 'trendradar_news-bot',
  service_type: 'trendradar',
  service_id: 'news-bot',
  display_name: 'news-bot',
  is_enabled: true,
  is_healthy: true,
  created_ts: 1700000000000
}

const sampleHealth: ExternalServiceHealth = {
  service_id: 'trendradar_news-bot',
  service_type: 'trendradar',
  is_healthy: true,
  last_check_ts: 1700000001000,
  last_success_ts: 1700000001000,
  last_error: null,
  consecutive_failures: 0
}

describe('AdminExternalServiceService — P1-3 外部服务管理', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listServices 使用 GET /external_services', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockResolvedValue([sampleService])

    const result = await service.listServices()
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'GET',
      '/external_services',
      undefined,
      undefined,
      expect.objectContaining({ prefix: '/_synapse/admin/v1' })
    )
    expect(result).toHaveLength(1)
    expect(result[0].as_id).toBe('trendradar_news-bot')
  })

  it('listServices 支持按 service_type 过滤', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockResolvedValue([sampleService])

    await service.listServices({ serviceType: 'trendradar' })
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'GET',
      '/external_services',
      { service_type: 'trendradar' },
      undefined,
      expect.any(Object)
    )
  })

  it('listServices 在出错时降级为空数组', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockRejectedValue(new Error('boom'))
    const result = await service.listServices()
    expect(result).toEqual([])
  })

  it('registerService 使用 POST /external_services', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockResolvedValue(sampleService)

    const result = await service.registerService({
      service_type: 'trendradar',
      service_id: 'news-bot',
      display_name: 'News Bot',
      webhook_url: 'https://example.com/webhook'
    })
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'POST',
      '/external_services',
      undefined,
      expect.objectContaining({
        service_type: 'trendradar',
        service_id: 'news-bot',
        display_name: 'News Bot'
      }),
      expect.any(Object)
    )
    expect(result.as_id).toBe('trendradar_news-bot')
  })

  it('updateService 使用 PUT /external_services/{as_id}', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockResolvedValue({ ...sampleService, is_enabled: false })

    const result = await service.updateService('trendradar_news-bot', { is_enabled: false })
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'PUT',
      '/external_services/trendradar_news-bot',
      undefined,
      expect.objectContaining({ is_enabled: false }),
      expect.any(Object)
    )
    expect(result.is_enabled).toBe(false)
  })

  it('deleteService 使用 DELETE /external_services/{as_id}', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockResolvedValue(undefined)

    await service.deleteService('trendradar_news-bot')
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'DELETE',
      '/external_services/trendradar_news-bot',
      undefined,
      undefined,
      expect.any(Object)
    )
  })

  it('getAllHealth 使用 GET /external_services/health', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockResolvedValue([sampleHealth])

    const result = await service.getAllHealth()
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'GET',
      '/external_services/health',
      undefined,
      undefined,
      expect.any(Object)
    )
    expect(result).toHaveLength(1)
    expect(result[0].is_healthy).toBe(true)
  })

  it('getAllHealth 在出错时降级为空数组', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockRejectedValue(new Error('boom'))
    const result = await service.getAllHealth()
    expect(result).toEqual([])
  })

  it('getServiceHealth 使用 GET /external_services/{as_id}/health', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockResolvedValue(sampleHealth)

    const result = await service.getServiceHealth('trendradar_news-bot')
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'GET',
      '/external_services/trendradar_news-bot/health',
      undefined,
      undefined,
      expect.any(Object)
    )
    expect(result?.is_healthy).toBe(true)
  })

  it('getServiceHealth 404 时返回 null', async () => {
    const { service, client } = makeService()
    const err = Object.assign(new Error('not found'), { httpStatus: 404 })
    client.http.authedRequest.mockRejectedValue(err)

    const result = await service.getServiceHealth('unknown_service')
    expect(result).toBeNull()
  })

  it('checkServiceHealth 使用 POST /external_services/{as_id}/health/check', async () => {
    const { service, client } = makeService()
    client.http.authedRequest.mockResolvedValue({ as_id: 'trendradar_news-bot', is_healthy: true })

    const result = await service.checkServiceHealth('trendradar_news-bot')
    expect(client.http.authedRequest).toHaveBeenCalledWith(
      'POST',
      '/external_services/trendradar_news-bot/health/check',
      undefined,
      undefined,
      expect.any(Object)
    )
    expect(result.is_healthy).toBe(true)
  })
})
