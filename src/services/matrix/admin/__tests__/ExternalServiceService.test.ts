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

const externalServiceManager = {
  listServices: vi.fn(),
  registerService: vi.fn(),
  updateService: vi.fn(),
  deleteService: vi.fn(),
  getAllHealth: vi.fn(),
  getServiceHealth: vi.fn(),
  checkServiceHealth: vi.fn()
}

const makeClient = () =>
  ({ getAdminManager: () => ({ externalService: externalServiceManager }) }) as unknown as MatrixClient

const makeService = () => {
  const client = makeClient()
  const service = new AdminExternalServiceService(() => client)
  return { service }
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

  it('listServices 委托 listServices()', async () => {
    const { service } = makeService()
    externalServiceManager.listServices.mockResolvedValue([sampleService])

    const result = await service.listServices()
    expect(externalServiceManager.listServices).toHaveBeenCalledWith(undefined)
    expect(result).toHaveLength(1)
    expect(result[0].as_id).toBe('trendradar_news-bot')
  })

  it('listServices 支持按 service_type 过滤', async () => {
    const { service } = makeService()
    externalServiceManager.listServices.mockResolvedValue([sampleService])

    await service.listServices({ serviceType: 'trendradar' })
    expect(externalServiceManager.listServices).toHaveBeenCalledWith('trendradar')
  })

  it('listServices 在出错时降级为空数组', async () => {
    const { service } = makeService()
    externalServiceManager.listServices.mockRejectedValue(new Error('boom'))
    const result = await service.listServices()
    expect(result).toEqual([])
  })

  it('registerService 委托 registerService(request)', async () => {
    const { service } = makeService()
    externalServiceManager.registerService.mockResolvedValue(sampleService)

    const request = {
      service_type: 'trendradar',
      service_id: 'news-bot',
      display_name: 'News Bot',
      webhook_url: 'https://example.com/webhook'
    }
    const result = await service.registerService(request)
    expect(externalServiceManager.registerService).toHaveBeenCalledWith(request)
    expect(result.as_id).toBe('trendradar_news-bot')
  })

  it('updateService 委托 updateService(asId, request)', async () => {
    const { service } = makeService()
    externalServiceManager.updateService.mockResolvedValue({ ...sampleService, is_enabled: false })

    const result = await service.updateService('trendradar_news-bot', { is_enabled: false })
    expect(externalServiceManager.updateService).toHaveBeenCalledWith('trendradar_news-bot', {
      is_enabled: false
    })
    expect(result.is_enabled).toBe(false)
  })

  it('deleteService 委托 deleteService(asId)', async () => {
    const { service } = makeService()
    externalServiceManager.deleteService.mockResolvedValue(undefined)

    await service.deleteService('trendradar_news-bot')
    expect(externalServiceManager.deleteService).toHaveBeenCalledWith('trendradar_news-bot')
  })

  it('getAllHealth 委托 getAllHealth()', async () => {
    const { service } = makeService()
    externalServiceManager.getAllHealth.mockResolvedValue([sampleHealth])

    const result = await service.getAllHealth()
    expect(externalServiceManager.getAllHealth).toHaveBeenCalled()
    expect(result).toHaveLength(1)
    expect(result[0].is_healthy).toBe(true)
  })

  it('getAllHealth 在出错时降级为空数组', async () => {
    const { service } = makeService()
    externalServiceManager.getAllHealth.mockRejectedValue(new Error('boom'))
    const result = await service.getAllHealth()
    expect(result).toEqual([])
  })

  it('getServiceHealth 委托 getServiceHealth(asId)', async () => {
    const { service } = makeService()
    externalServiceManager.getServiceHealth.mockResolvedValue(sampleHealth)

    const result = await service.getServiceHealth('trendradar_news-bot')
    expect(externalServiceManager.getServiceHealth).toHaveBeenCalledWith('trendradar_news-bot')
    expect(result?.is_healthy).toBe(true)
  })

  it('getServiceHealth 404 时返回 null', async () => {
    const { service } = makeService()
    const err = Object.assign(new Error('not found'), { httpStatus: 404 })
    externalServiceManager.getServiceHealth.mockRejectedValue(err)

    const result = await service.getServiceHealth('unknown_service')
    expect(result).toBeNull()
  })

  it('checkServiceHealth 委托 checkServiceHealth(asId)', async () => {
    const { service } = makeService()
    externalServiceManager.checkServiceHealth.mockResolvedValue({
      as_id: 'trendradar_news-bot',
      is_healthy: true
    })

    const result = await service.checkServiceHealth('trendradar_news-bot')
    expect(externalServiceManager.checkServiceHealth).toHaveBeenCalledWith('trendradar_news-bot')
    expect(result.is_healthy).toBe(true)
  })
})
