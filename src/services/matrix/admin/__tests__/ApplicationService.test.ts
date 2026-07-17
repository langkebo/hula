import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminApplicationService, type ApplicationServiceAdmin } from '../ApplicationService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const makeAdmin = () => ({
  listApplicationServices: vi.fn(),
  registerApplicationService: vi.fn(),
  getApplicationService: vi.fn(),
  updateApplicationService: vi.fn(),
  deleteApplicationService: vi.fn(),
  pingApplicationService: vi.fn()
})

describe('AdminApplicationService', () => {
  let admin: ReturnType<typeof makeAdmin>
  let service: AdminApplicationService

  beforeEach(() => {
    admin = makeAdmin()
    service = new AdminApplicationService(async () => admin as unknown as ApplicationServiceAdmin)
  })

  it('getApplicationServices 传递分页参数并映射 nextToken', async () => {
    admin.listApplicationServices.mockResolvedValueOnce({
      services: [{ id: 'as1' }],
      next_token: 'tok'
    })

    await expect(service.getApplicationServices(10, 'from-1')).resolves.toEqual({
      services: [{ id: 'as1' }],
      nextToken: 'tok'
    })
    expect(admin.listApplicationServices).toHaveBeenCalledWith({ limit: 10, from: 'from-1' })
  })

  it('getApplicationServices 出错时降级为空列表', async () => {
    admin.listApplicationServices.mockRejectedValueOnce(new Error('boom'))
    await expect(service.getApplicationServices()).resolves.toEqual({ services: [] })
  })

  it('registerApplicationService 透传配置且失败时向上抛出', async () => {
    admin.registerApplicationService.mockResolvedValueOnce({ id: 'as2' })
    await expect(service.registerApplicationService('token', { url: 'https://as.test' })).resolves.toEqual({
      id: 'as2'
    })
    expect(admin.registerApplicationService).toHaveBeenCalledWith('token', { url: 'https://as.test' })

    admin.registerApplicationService.mockRejectedValueOnce(new Error('M_UNKNOWN'))
    await expect(service.registerApplicationService('token', {})).rejects.toThrow('M_UNKNOWN')
  })

  it('getApplicationService 出错时返回 null', async () => {
    admin.getApplicationService.mockRejectedValueOnce(new Error('boom'))
    await expect(service.getApplicationService('as1')).resolves.toBeNull()
  })

  it('updateApplicationService/deleteApplicationService 失败时向上抛出', async () => {
    admin.updateApplicationService.mockRejectedValueOnce(new Error('update-fail'))
    await expect(service.updateApplicationService('as1', {})).rejects.toThrow('update-fail')

    admin.deleteApplicationService.mockRejectedValueOnce(new Error('delete-fail'))
    await expect(service.deleteApplicationService('as1')).rejects.toThrow('delete-fail')
  })

  it('pingApplicationService 映射 duration_ms 且出错时返回 ok:false', async () => {
    admin.pingApplicationService.mockResolvedValueOnce({ ok: true, duration_ms: 42 })
    await expect(service.pingApplicationService('as1')).resolves.toEqual({ ok: true, durationMs: 42 })

    admin.pingApplicationService.mockRejectedValueOnce(new Error('timeout'))
    await expect(service.pingApplicationService('as1')).resolves.toEqual({ ok: false })
  })
})
