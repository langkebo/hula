import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminExternalServices } from '../useAdminExternalServices'

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    externalServices: {
      listServices: vi.fn(),
      getAllHealth: vi.fn(),
      registerService: vi.fn(),
      updateService: vi.fn(),
      deleteService: vi.fn(),
      checkServiceHealth: vi.fn(),
      getClientHealth: vi.fn(),
      updateClientService: vi.fn(),
      deleteClientService: vi.fn()
    }
  }
}))

import { adminService } from '@/services/matrix/admin'

const externalServices = adminService.externalServices

const sampleService = {
  as_id: 'as-1',
  service_type: 'webhook',
  service_id: 'hook-a',
  display_name: 'Hook A',
  is_enabled: true,
  is_healthy: true,
  created_ts: 1700000000000
}

const sampleHealth = {
  service_id: 'hook-a',
  service_type: 'webhook',
  is_healthy: true,
  last_check_ts: 1700000001000,
  last_success_ts: 1700000001000,
  last_error: null,
  consecutive_failures: 0
}

const sampleClientHealth = {
  status: 'ok',
  services: [{ id: 'svc-1', type: 'webhook', status: 'healthy', last_check: 1700000002000 }]
}

describe('useAdminExternalServices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(externalServices.listServices).mockResolvedValue([sampleService])
    vi.mocked(externalServices.getAllHealth).mockResolvedValue([sampleHealth])
    vi.mocked(externalServices.getClientHealth).mockResolvedValue(sampleClientHealth)
  })

  it('loadServices 默认按全部类型拉取并合并健康状态', async () => {
    const c = useAdminExternalServices()
    await c.loadServices()

    expect(externalServices.listServices).toHaveBeenCalledWith({ serviceType: 'all' })
    expect(c.services.value).toHaveLength(1)
    expect(c.healthMap.value['hook-a']).toEqual(sampleHealth)
    expect(c.loading.value).toBe(false)
  })

  it('loadServices 传入类型时透传并记录当前过滤值', async () => {
    const c = useAdminExternalServices()
    await c.loadServices('slack')

    expect(externalServices.listServices).toHaveBeenCalledWith({ serviceType: 'slack' })
    expect(c.serviceType.value).toBe('slack')
  })

  it('loadServices 失败时清空数据并记录错误', async () => {
    vi.mocked(externalServices.listServices).mockRejectedValueOnce(new Error('network down'))
    const c = useAdminExternalServices()

    await c.loadServices()

    expect(c.services.value).toEqual([])
    expect(c.healthMap.value).toEqual({})
    expect(c.error.value).toBe('network down')
    expect(c.loading.value).toBe(false)
  })

  it('registerService 去除空白并剔空的可选字段，随后重新拉取', async () => {
    vi.mocked(externalServices.registerService).mockResolvedValue(sampleService)
    const c = useAdminExternalServices()

    const ok = await c.registerService({
      service_type: 'webhook',
      service_id: '  hook-a  ',
      display_name: ' Hook A ',
      webhook_url: '   ',
      api_key: ''
    })

    expect(ok).toBe(true)
    expect(externalServices.registerService).toHaveBeenCalledWith({
      service_type: 'webhook',
      service_id: 'hook-a',
      display_name: 'Hook A'
    })
    expect(externalServices.listServices).toHaveBeenCalledTimes(1)
  })

  it('registerService 失败返回 false 并保留错误', async () => {
    vi.mocked(externalServices.registerService).mockRejectedValueOnce(new Error('conflict'))
    const c = useAdminExternalServices()

    const ok = await c.registerService({ service_type: 'webhook', service_id: 'hook-a', display_name: 'Hook A' })

    expect(ok).toBe(false)
    expect(c.error.value).toBe('conflict')
    expect(c.mutating.value).toBe(false)
  })

  it('setEnabled 用返回实体就地替换列表项', async () => {
    vi.mocked(externalServices.updateService).mockResolvedValue({ ...sampleService, is_enabled: false })
    const c = useAdminExternalServices()
    await c.loadServices()

    const ok = await c.setEnabled(sampleService, false)

    expect(ok).toBe(true)
    expect(externalServices.updateService).toHaveBeenCalledWith('as-1', { is_enabled: false })
    expect(c.services.value[0]?.is_enabled).toBe(false)
  })

  it('checkHealth 期间标记 checkingId 并刷新健康状态', async () => {
    vi.mocked(externalServices.checkServiceHealth).mockResolvedValue({ as_id: 'as-1', is_healthy: false })
    vi.mocked(externalServices.getAllHealth).mockResolvedValue([{ ...sampleHealth, is_healthy: false }])
    const c = useAdminExternalServices()

    const pending = c.checkHealth(sampleService)
    expect(c.checkingId.value).toBe('as-1')
    await pending

    expect(c.checkingId.value).toBeNull()
    expect(externalServices.checkServiceHealth).toHaveBeenCalledWith('as-1')
    expect(c.healthMap.value['hook-a']?.is_healthy).toBe(false)
  })

  it('removeService 注销后重新拉取列表', async () => {
    vi.mocked(externalServices.deleteService).mockResolvedValue(undefined)
    const c = useAdminExternalServices()
    await c.loadServices()
    vi.mocked(externalServices.listServices).mockClear()

    const ok = await c.removeService(sampleService)

    expect(ok).toBe(true)
    expect(externalServices.deleteService).toHaveBeenCalledWith('as-1')
    expect(externalServices.listServices).toHaveBeenCalledTimes(1)
  })

  it('loadClientHealth 记录 client 健康状态与派生服务列表', async () => {
    const c = useAdminExternalServices()

    const pending = c.loadClientHealth()
    expect(c.clientLoading.value).toBe(true)
    await pending

    expect(c.clientLoading.value).toBe(false)
    expect(c.clientHealth.value).toEqual(sampleClientHealth)
    expect(c.clientServices.value).toHaveLength(1)
    expect(c.clientServices.value[0]?.id).toBe('svc-1')
  })

  it('clientServices 在无 services 字段时为空数组', async () => {
    vi.mocked(externalServices.getClientHealth).mockResolvedValue({ status: 'unknown' })
    const c = useAdminExternalServices()

    await c.loadClientHealth()

    expect(c.clientServices.value).toEqual([])
  })

  it('setClientEnabled 更新后重载 client 健康', async () => {
    vi.mocked(externalServices.updateClientService).mockResolvedValue({ id: 'svc-1' })
    const c = useAdminExternalServices()

    const pending = c.setClientEnabled('svc-1', false)
    expect(c.clientMutatingId.value).toBe('svc-1')
    const ok = await pending

    expect(ok).toBe(true)
    expect(externalServices.updateClientService).toHaveBeenCalledWith('svc-1', { is_enabled: false })
    expect(externalServices.getClientHealth).toHaveBeenCalledTimes(1)
    expect(c.clientMutatingId.value).toBeNull()
  })

  it('setClientEnabled 失败返回 false 并记录错误', async () => {
    vi.mocked(externalServices.updateClientService).mockRejectedValueOnce(new Error('forbidden'))
    const c = useAdminExternalServices()

    const ok = await c.setClientEnabled('svc-1', true)

    expect(ok).toBe(false)
    expect(c.error.value).toBe('forbidden')
    expect(c.clientMutatingId.value).toBeNull()
  })

  it('removeClientService 注销后重载 client 健康', async () => {
    vi.mocked(externalServices.deleteClientService).mockResolvedValue(undefined)
    const c = useAdminExternalServices()

    const ok = await c.removeClientService('svc-1')

    expect(ok).toBe(true)
    expect(externalServices.deleteClientService).toHaveBeenCalledWith('svc-1')
    expect(externalServices.getClientHealth).toHaveBeenCalledTimes(1)
    expect(c.clientMutatingId.value).toBeNull()
  })

  it('removeClientService 失败返回 false 并记录错误', async () => {
    vi.mocked(externalServices.deleteClientService).mockRejectedValueOnce(new Error('not found'))
    const c = useAdminExternalServices()

    const ok = await c.removeClientService('svc-1')

    expect(ok).toBe(false)
    expect(c.error.value).toBe('not found')
    expect(c.clientMutatingId.value).toBeNull()
  })
})
