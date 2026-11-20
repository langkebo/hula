import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminAppServices } from '../useAdminAppServices'

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    getApplicationServices: vi.fn().mockResolvedValue({ services: [] }),
    getApplicationService: vi.fn().mockResolvedValue(null),
    pingApplicationService: vi.fn().mockResolvedValue({ ok: true }),
    registerApplicationService: vi.fn().mockResolvedValue({ id: 'as1' }),
    updateApplicationService: vi.fn().mockResolvedValue(undefined),
    deleteApplicationService: vi.fn().mockResolvedValue(undefined)
  }
}))

import { adminService } from '@/services/matrix/admin'
import { makeApplicationService, makeApplicationServicesResponse } from './fixtures/admin'

describe('useAdminAppServices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadServices 归一化服务端字段', async () => {
    vi.mocked(adminService.getApplicationServices).mockResolvedValueOnce(
      makeApplicationServicesResponse([
        makeApplicationService({ as_id: 'as1', url: 'https://x', sender_localpart: 'bot' })
      ])
    )
    const c = useAdminAppServices()
    await c.loadServices()
    expect(c.services.value).toHaveLength(1)
    expect(c.services.value[0]).toMatchObject({
      id: 'as1',
      url: 'https://x',
      senderLocalpart: 'bot'
    })
  })

  it('registerService 调用 SDK 注册并刷新列表', async () => {
    vi.mocked(adminService.getApplicationServices).mockResolvedValueOnce(
      makeApplicationServicesResponse([makeApplicationService({ as_id: 'as1' })])
    )
    const c = useAdminAppServices()
    const config = { url: 'https://x', sender_localpart: 'bot' }

    const ok = await c.registerService('tok', config)

    expect(ok).toBe(true)
    expect(adminService.registerApplicationService).toHaveBeenCalledWith('tok', config)
    expect(adminService.getApplicationServices).toHaveBeenCalledTimes(1)
    expect(c.services.value).toHaveLength(1)
    expect(c.registering.value).toBe(false)
  })

  it('registerService 失败时抛出错误并复位 loading', async () => {
    vi.mocked(adminService.registerApplicationService).mockRejectedValueOnce(new Error('boom'))
    const c = useAdminAppServices()

    await expect(c.registerService('tok', {})).rejects.toThrow('boom')
    expect(c.registering.value).toBe(false)
    expect(adminService.getApplicationServices).not.toHaveBeenCalled()
  })
})
