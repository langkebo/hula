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

/** 构造一个 mock 的 AdminExternalServiceManager（SDK 子 Manager）。 */
const makeExternalServiceManager = () => ({
  listServices: vi.fn(),
  registerService: vi.fn(),
  updateService: vi.fn(),
  deleteService: vi.fn(),
  getAllHealth: vi.fn(),
  getServiceHealth: vi.fn(),
  checkServiceHealth: vi.fn()
})

type ExternalServiceManagerMock = ReturnType<typeof makeExternalServiceManager>

const makeClient = (manager: ExternalServiceManagerMock) => {
  return {
    getAdminManager: () => ({ externalService: manager })
  } as unknown as MatrixClient
}

const makeService = () => {
  const manager = makeExternalServiceManager()
  const client = makeClient(manager)
  const service = new AdminExternalServiceService(() => client)
  return { service, client, manager }
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

  it('listServices 委托到 AdminExternalServiceManager.listServices（无过滤）', async () => {
    const { service, manager } = makeService()
    manager.listServices.mockResolvedValue([sampleService])

    const result = await service.listServices()
    expect(manager.listServices).toHaveBeenCalledWith(undefined)
    expect(result).toHaveLength(1)
    expect(result[0].as_id).toBe('trendradar_news-bot')
  })

  it('listServices 支持按 service_type 过滤', async () => {
    const { service, manager } = makeService()
    manager.listServices.mockResolvedValue([sampleService])

    await service.listServices({ serviceType: 'trendradar' })
    expect(manager.listServices).toHaveBeenCalledWith('trendradar')
  })

  it('listServices 在出错时降级为空数组', async () => {
    const { service, manager } = makeService()
    manager.listServices.mockRejectedValue(new Error('boom'))
    const result = await service.listServices()
    expect(result).toEqual([])
  })

  it('registerService 委托到 AdminExternalServiceManager.registerService', async () => {
    const { service, manager } = makeService()
    manager.registerService.mockResolvedValue(sampleService)

    const payload = {
      service_type: 'trendradar',
      service_id: 'news-bot',
      display_name: 'News Bot',
      webhook_url: 'https://example.com/webhook'
    }
    const result = await service.registerService(payload)
    expect(manager.registerService).toHaveBeenCalledWith(payload)
    expect(result.as_id).toBe('trendradar_news-bot')
  })

  it('updateService 委托到 AdminExternalServiceManager.updateService', async () => {
    const { service, manager } = makeService()
    manager.updateService.mockResolvedValue({ ...sampleService, is_enabled: false })

    const result = await service.updateService('trendradar_news-bot', { is_enabled: false })
    expect(manager.updateService).toHaveBeenCalledWith('trendradar_news-bot', { is_enabled: false })
    expect(result.is_enabled).toBe(false)
  })

  it('deleteService 委托到 AdminExternalServiceManager.deleteService', async () => {
    const { service, manager } = makeService()
    manager.deleteService.mockResolvedValue(undefined)

    await service.deleteService('trendradar_news-bot')
    expect(manager.deleteService).toHaveBeenCalledWith('trendradar_news-bot')
  })

  it('getAllHealth 委托到 AdminExternalServiceManager.getAllHealth', async () => {
    const { service, manager } = makeService()
    manager.getAllHealth.mockResolvedValue([sampleHealth])

    const result = await service.getAllHealth()
    expect(manager.getAllHealth).toHaveBeenCalledWith()
    expect(result).toHaveLength(1)
    expect(result[0].is_healthy).toBe(true)
  })

  it('getAllHealth 在出错时降级为空数组', async () => {
    const { service, manager } = makeService()
    manager.getAllHealth.mockRejectedValue(new Error('boom'))
    const result = await service.getAllHealth()
    expect(result).toEqual([])
  })

  it('getServiceHealth 委托到 AdminExternalServiceManager.getServiceHealth', async () => {
    const { service, manager } = makeService()
    manager.getServiceHealth.mockResolvedValue(sampleHealth)

    const result = await service.getServiceHealth('trendradar_news-bot')
    expect(manager.getServiceHealth).toHaveBeenCalledWith('trendradar_news-bot')
    expect(result?.is_healthy).toBe(true)
  })

  it('getServiceHealth 404 时返回 null（由 SDK 处理 404）', async () => {
    const { service, manager } = makeService()
    // SDK 已经在 404 时返回 null
    manager.getServiceHealth.mockResolvedValue(null)

    const result = await service.getServiceHealth('unknown_service')
    expect(result).toBeNull()
  })

  it('getServiceHealth 其他错误时返回 null 并记录日志', async () => {
    const { service, manager } = makeService()
    manager.getServiceHealth.mockRejectedValue(new Error('server error'))

    const result = await service.getServiceHealth('trendradar_news-bot')
    expect(result).toBeNull()
  })

  it('checkServiceHealth 委托到 AdminExternalServiceManager.checkServiceHealth', async () => {
    const { service, manager } = makeService()
    manager.checkServiceHealth.mockResolvedValue({ as_id: 'trendradar_news-bot', is_healthy: true })

    const result = await service.checkServiceHealth('trendradar_news-bot')
    expect(manager.checkServiceHealth).toHaveBeenCalledWith('trendradar_news-bot')
    expect(result.is_healthy).toBe(true)
  })
})
