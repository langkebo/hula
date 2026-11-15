import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminCasService } from '../AdminCasService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const listServices = vi.fn()
const createService = vi.fn()
const deleteService = vi.fn()
const getUserAttributes = vi.fn()
const setUserAttribute = vi.fn()

const makeDeps = () => {
  const client = {
    getCasManager: () => ({ listServices, createService, deleteService, getUserAttributes, setUserAttribute })
  }
  return {
    getClient: () => client as never,
    waitForClientReady: async () => client as never
  }
}

describe('AdminCasService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listServices 返回服务列表', async () => {
    const response = {
      services: [{ id: 'svc', name: 'Svc', service_url: 'https://app.example.com/*', enabled: true }],
      total: 1
    }
    listServices.mockResolvedValueOnce(response)

    const result = await new AdminCasService(makeDeps()).listServices()

    expect(listServices).toHaveBeenCalledWith()
    expect(result).toEqual(response)
  })

  it('createService 透传注册请求体', async () => {
    const request = {
      service_id: 'svc',
      name: 'Svc',
      service_url_pattern: 'https://app.example.com/*'
    }
    createService.mockResolvedValueOnce({ id: 'svc', name: 'Svc' })

    const result = await new AdminCasService(makeDeps()).createService(request)

    expect(createService).toHaveBeenCalledWith(request)
    expect(result).toEqual({ id: 'svc', name: 'Svc' })
  })

  it('deleteService 透传服务 ID', async () => {
    deleteService.mockResolvedValueOnce({ id: 'svc' })

    const result = await new AdminCasService(makeDeps()).deleteService('svc')

    expect(deleteService).toHaveBeenCalledWith('svc')
    expect(result).toEqual({ id: 'svc' })
  })

  it('getUserAttributes 返回属性数组', async () => {
    getUserAttributes.mockResolvedValueOnce([{ name: 'role', value: 'admin' }])

    const result = await new AdminCasService(makeDeps()).getUserAttributes('@alice:example.org')

    expect(getUserAttributes).toHaveBeenCalledWith('@alice:example.org')
    expect(result).toEqual([{ name: 'role', value: 'admin' }])
  })

  it('setUserAttribute 透传单属性请求体', async () => {
    const body = { attribute_name: 'role', attribute_value: 'admin' }
    setUserAttribute.mockResolvedValueOnce(body)

    const result = await new AdminCasService(makeDeps()).setUserAttribute('@alice:example.org', body)

    expect(setUserAttribute).toHaveBeenCalledWith('@alice:example.org', body)
    expect(result).toEqual(body)
  })

  it('后端失败时记录日志并重新抛出', async () => {
    createService.mockRejectedValueOnce(new Error('HTTP 400'))

    await expect(
      new AdminCasService(makeDeps()).createService({
        service_id: 'svc',
        name: 'Svc',
        service_url_pattern: 'https://app.example.com/*'
      })
    ).rejects.toThrow('HTTP 400')
  })
})
