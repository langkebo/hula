import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/matrix/admin', () => ({
  adminPushService: {
    getConfig: vi.fn(),
    setConfig: vi.fn(),
    processQueue: vi.fn(),
    cleanupLogs: vi.fn()
  }
}))

import { adminPushService } from '@/services/matrix/admin'
import { useAdminPush } from '../useAdminPush'

const configResponse = {
  config: { poll_timeout: '30', apns_secret: '***' },
  initialized_providers: ['apns'],
  supported_keys: ['poll_timeout', 'apns_secret']
}

describe('useAdminPush', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('读取配置成功后写入 config', async () => {
    vi.mocked(adminPushService.getConfig).mockResolvedValue(configResponse)

    const state = useAdminPush()
    await state.loadConfig()

    expect(state.config.value).toEqual(configResponse)
    expect(state.configError.value).toBeNull()
  })

  it('读取配置失败时清空并记录错误', async () => {
    vi.mocked(adminPushService.getConfig).mockRejectedValue(new Error('HTTP 500'))

    const state = useAdminPush()
    await state.loadConfig()

    expect(state.config.value).toBeNull()
    expect(state.configError.value).toBe('HTTP 500')
  })

  it('保存配置成功后回读配置', async () => {
    vi.mocked(adminPushService.setConfig).mockResolvedValue(configResponse)
    vi.mocked(adminPushService.getConfig).mockResolvedValue(configResponse)

    const state = useAdminPush()
    const ok = await state.saveConfig({ config: { poll_timeout: '60' } })

    expect(ok).toBe(true)
    expect(adminPushService.setConfig).toHaveBeenCalledWith({ config: { poll_timeout: '60' } })
    expect(adminPushService.getConfig).toHaveBeenCalledTimes(1)
  })

  it('消费队列写入结果', async () => {
    vi.mocked(adminPushService.processQueue).mockResolvedValue({ processed: 9, message: 'ok' })

    const state = useAdminPush()
    const ok = await state.processQueue(20)

    expect(ok).toBe(true)
    expect(adminPushService.processQueue).toHaveBeenCalledWith(20)
    expect(state.processResult.value).toEqual({ processed: 9, message: 'ok' })
  })

  it('清理日志失败时返回 false 并记录错误', async () => {
    vi.mocked(adminPushService.cleanupLogs).mockRejectedValue(new Error('HTTP 500'))

    const state = useAdminPush()
    const ok = await state.cleanupLogs(30)

    expect(ok).toBe(false)
    expect(state.cleanupError.value).toBe('HTTP 500')
    expect(state.cleanupResult.value).toBeNull()
  })
})
