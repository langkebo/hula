import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/matrix/admin', () => ({
  adminCasService: {
    listServices: vi.fn(),
    createService: vi.fn(),
    deleteService: vi.fn(),
    getUserAttributes: vi.fn(),
    setUserAttribute: vi.fn()
  }
}))

import { adminCasService } from '@/services/matrix/admin'
import { useAdminCas } from '../useAdminCas'

const serviceItem = {
  id: 'svc',
  name: 'Svc',
  service_url: 'https://app.example.com/*',
  enabled: true
}

describe('useAdminCas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('读取服务列表写入状态', async () => {
    vi.mocked(adminCasService.listServices).mockResolvedValue({ services: [serviceItem], total: 1 })

    const state = useAdminCas()
    await state.loadServices()

    expect(state.services.value).toEqual([serviceItem])
    expect(state.servicesError.value).toBeNull()
  })

  it('读取服务列表失败时清空并记录错误', async () => {
    vi.mocked(adminCasService.listServices).mockRejectedValue(new Error('HTTP 500'))

    const state = useAdminCas()
    await state.loadServices()

    expect(state.services.value).toEqual([])
    expect(state.servicesError.value).toBe('HTTP 500')
  })

  it('注册服务成功后回读列表', async () => {
    const request = { service_id: 'svc', name: 'Svc', service_url_pattern: 'https://app.example.com/*' }
    vi.mocked(adminCasService.createService).mockResolvedValue({ id: 'svc', name: 'Svc' })
    vi.mocked(adminCasService.listServices).mockResolvedValue({ services: [serviceItem], total: 1 })

    const state = useAdminCas()
    const ok = await state.createService(request)

    expect(ok).toBe(true)
    expect(adminCasService.createService).toHaveBeenCalledWith(request)
    expect(adminCasService.listServices).toHaveBeenCalledTimes(1)
    expect(state.services.value).toEqual([serviceItem])
  })

  it('删除服务成功后回读列表', async () => {
    vi.mocked(adminCasService.deleteService).mockResolvedValue({ id: 'svc' })
    vi.mocked(adminCasService.listServices).mockResolvedValue({ services: [], total: 0 })

    const state = useAdminCas()
    const ok = await state.deleteService('svc')

    expect(ok).toBe(true)
    expect(adminCasService.deleteService).toHaveBeenCalledWith('svc')
    expect(adminCasService.listServices).toHaveBeenCalledTimes(1)
  })

  it('读取用户属性写入状态', async () => {
    vi.mocked(adminCasService.getUserAttributes).mockResolvedValue([{ name: 'role', value: 'admin' }])

    const state = useAdminCas()
    const ok = await state.loadUserAttributes('@alice:example.org')

    expect(ok).toBe(true)
    expect(state.attributes.value).toEqual([{ name: 'role', value: 'admin' }])
  })

  it('写入属性成功后回读属性列表', async () => {
    const body = { attribute_name: 'role', attribute_value: 'admin' }
    vi.mocked(adminCasService.setUserAttribute).mockResolvedValue({
      user_id: '@alice:example.org',
      ...body
    })
    vi.mocked(adminCasService.getUserAttributes).mockResolvedValue([{ name: 'role', value: 'admin' }])

    const state = useAdminCas()
    const ok = await state.saveUserAttribute('@alice:example.org', body)

    expect(ok).toBe(true)
    expect(adminCasService.setUserAttribute).toHaveBeenCalledWith('@alice:example.org', body)
    expect(state.attributes.value).toEqual([{ name: 'role', value: 'admin' }])
  })

  it('写入属性失败时返回 false 并记录错误', async () => {
    vi.mocked(adminCasService.setUserAttribute).mockRejectedValue(new Error('HTTP 400'))

    const state = useAdminCas()
    const ok = await state.saveUserAttribute('@alice:example.org', {
      attribute_name: 'role',
      attribute_value: 'admin'
    })

    expect(ok).toBe(false)
    expect(state.attributesError.value).toBe('HTTP 400')
  })
})
