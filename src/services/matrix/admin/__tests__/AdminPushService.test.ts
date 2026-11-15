import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminPushService, type PushConfigPatchRequest } from '../AdminPushService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const getConfig = vi.fn()
const setConfig = vi.fn()
const processQueue = vi.fn()
const cleanupLogs = vi.fn()

const makeDeps = () => {
  const client = {
    getAdminManager: () => ({
      push: { getConfig, setConfig, processQueue, cleanupLogs }
    })
  }
  return {
    getClient: () => client as never,
    waitForClientReady: async () => client as never
  }
}

const configResponse = {
  config: { poll_timeout: '30', apns_secret: '***' },
  initialized_providers: ['apns'],
  supported_keys: ['poll_timeout', 'apns_secret']
}

describe('AdminPushService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getConfig 返回配置、已初始化提供方与可配置键', async () => {
    getConfig.mockResolvedValueOnce(configResponse)

    const result = await new AdminPushService(makeDeps()).getConfig()

    expect(getConfig).toHaveBeenCalledWith()
    expect(result).toEqual(configResponse)
  })

  it('setConfig 透传按键补丁（null 表示清除）', async () => {
    const patch: PushConfigPatchRequest = { config: { poll_timeout: '60', apns_secret: null } }
    setConfig.mockResolvedValueOnce(configResponse)

    await new AdminPushService(makeDeps()).setConfig(patch)

    expect(setConfig).toHaveBeenCalledWith(patch)
  })

  it('processQueue 透传批量大小', async () => {
    processQueue.mockResolvedValueOnce({ processed: 12, message: 'ok' })

    const result = await new AdminPushService(makeDeps()).processQueue(50)

    expect(processQueue).toHaveBeenCalledWith(50)
    expect(result).toEqual({ processed: 12, message: 'ok' })
  })

  it('cleanupLogs 透传保留天数', async () => {
    cleanupLogs.mockResolvedValueOnce({ cleaned: 7, message: 'ok' })

    const result = await new AdminPushService(makeDeps()).cleanupLogs(30)

    expect(cleanupLogs).toHaveBeenCalledWith(30)
    expect(result).toEqual({ cleaned: 7, message: 'ok' })
  })

  it('后端失败时记录日志并重新抛出', async () => {
    setConfig.mockRejectedValueOnce(new Error('HTTP 400'))

    await expect(new AdminPushService(makeDeps()).setConfig({ config: {} })).rejects.toThrow('HTTP 400')
  })
})
