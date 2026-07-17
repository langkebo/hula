import type { MatrixClient } from 'matrix-js-sdk'
import type { AdminManager } from 'matrix-js-sdk/admin'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminQuotaService } from '../QuotaService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const makeQuotaManager = () => ({
  checkQuota: vi.fn(),
  getQuotaStats: vi.fn(),
  getUploadSizeLimit: vi.fn(),
  getUploadFileSizeLimit: vi.fn(),
  getUserStorageUsage: vi.fn(),
  hasStorageSpace: vi.fn(),
  getQuotaAlerts: vi.fn(),
  getQuotaConfigs: vi.fn(),
  setUserQuota: vi.fn(),
  getServerQuota: vi.fn()
})

const sdkAdmin = async () => ({}) as unknown as AdminManager

describe('AdminQuotaService', () => {
  let quotaManager: ReturnType<typeof makeQuotaManager>
  let service: AdminQuotaService

  beforeEach(() => {
    quotaManager = makeQuotaManager()
    const client = { getMediaQuotaManager: () => quotaManager } as unknown as MatrixClient
    service = new AdminQuotaService(sdkAdmin, () => client)
  })

  it('quotaManager 未初始化时抛错', async () => {
    const bareClient = {} as unknown as MatrixClient
    const bareService = new AdminQuotaService(sdkAdmin, () => bareClient)

    await expect(bareService.checkQuota()).rejects.toThrow('quotaManager 未初始化')
  })

  it('checkQuota/getQuotaStats 透传 manager 结果且失败时向上抛出', async () => {
    quotaManager.checkQuota.mockResolvedValueOnce({ used: 1, limit: 10 })
    await expect(service.checkQuota()).resolves.toEqual({ used: 1, limit: 10 })

    quotaManager.getQuotaStats.mockRejectedValueOnce(new Error('stats-fail'))
    await expect(service.getQuotaStats()).rejects.toThrow('stats-fail')
  })

  it('setUserQuota 透传参数', async () => {
    quotaManager.setUserQuota.mockResolvedValueOnce(undefined)
    await service.setUserQuota('@u:hs', 1024)
    expect(quotaManager.setUserQuota).toHaveBeenCalledWith('@u:hs', 1024)
  })

  it('getUploadSizeLimit throwOnError=false 时降级为 10MB 默认值', async () => {
    quotaManager.getUploadSizeLimit.mockRejectedValueOnce(new Error('boom'))
    await expect(service.getUploadSizeLimit(false)).resolves.toBe(10 * 1024 * 1024)

    quotaManager.getUploadSizeLimit.mockRejectedValueOnce(new Error('boom'))
    await expect(service.getUploadSizeLimit(true)).rejects.toThrow('boom')
  })

  it('getUploadSizeLimit 方法不存在时同样按 throwOnError 处理', async () => {
    const partialManager = makeQuotaManager() as Record<string, unknown>
    delete partialManager.getUploadSizeLimit
    const client = { getMediaQuotaManager: () => partialManager } as unknown as MatrixClient
    const partialService = new AdminQuotaService(sdkAdmin, () => client)

    await expect(partialService.getUploadSizeLimit(false)).resolves.toBe(10 * 1024 * 1024)
    await expect(partialService.getUploadSizeLimit(true)).rejects.toThrow('upload_size_limit_unavailable')
  })

  it('getUserStorageUsage throwOnError=false 时降级为 null', async () => {
    quotaManager.getUserStorageUsage.mockResolvedValueOnce({ size: 100, ntFiles: 2 })
    await expect(service.getUserStorageUsage()).resolves.toEqual({ size: 100, ntFiles: 2 })

    quotaManager.getUserStorageUsage.mockRejectedValueOnce(new Error('boom'))
    await expect(service.getUserStorageUsage(false)).resolves.toBeNull()
  })

  it('hasStorageSpace 出错时返回 false', async () => {
    quotaManager.hasStorageSpace.mockResolvedValueOnce(true)
    await expect(service.hasStorageSpace(2048)).resolves.toBe(true)
    expect(quotaManager.hasStorageSpace).toHaveBeenCalledWith(2048)

    quotaManager.hasStorageSpace.mockRejectedValueOnce(new Error('boom'))
    await expect(service.hasStorageSpace(2048)).resolves.toBe(false)
  })

  it('支持 client.quotaManager 备用访问路径', async () => {
    const client = { quotaManager } as unknown as MatrixClient
    const fallbackService = new AdminQuotaService(sdkAdmin, () => client)
    quotaManager.getQuotaAlerts.mockResolvedValueOnce([{ level: 'warn' }])

    await expect(fallbackService.getQuotaAlerts()).resolves.toEqual([{ level: 'warn' }])
  })
})
