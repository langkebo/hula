import type { AdminManager } from 'matrix-js-sdk/admin'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const { checkQuotaMock, getQuotaStatsMock, getQuotaAlertsMock } = vi.hoisted(() => ({
  checkQuotaMock: vi.fn(),
  getQuotaStatsMock: vi.fn(),
  getQuotaAlertsMock: vi.fn()
}))

vi.mock('@/services/matrix/media/MatrixMediaService', () => ({
  matrixMediaService: {
    checkQuota: checkQuotaMock,
    getQuotaStats: getQuotaStatsMock,
    getQuotaAlerts: getQuotaAlertsMock
  }
}))

const { AdminQuotaService } = await import('../QuotaService')

/**
 * 2026-10-11 重写（审计 §13）：旧测试整篇围绕 `client.getMediaQuotaManager()` /
 * `client.quotaManager` 这两个**不存在的**口子（以及 `getUploadSizeLimit` /
 * `getUserStorageUsage` / `hasStorageSpace` / `getQuotaConfigs` / `setUserQuota` 这些
 * 后端没有的路由）。现在断言的是真实来源：
 *   - 用户侧配额 → `matrixMediaService`（内部走 `MediaManager` 的
 *     `/_matrix/media/v1/quota/{check,stats,alerts}`）；
 *   - 服务端总配额 → `getAdminManager().media.getMediaQuota()`（`/_synapse/admin/v1/media/quota`）。
 */
describe('AdminQuotaService', () => {
  const getMediaQuota = vi.fn()
  const sdkAdmin = async () => ({ media: { getMediaQuota } }) as unknown as AdminManager
  const service = new AdminQuotaService(sdkAdmin, () => ({}) as never)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('checkQuota 走媒体管理器并补出 percentage / exceeded', async () => {
    checkQuotaMock.mockResolvedValueOnce({ limit: 100, used: 25, remaining: 75 })

    await expect(service.checkQuota()).resolves.toEqual({
      limit: 100,
      used: 25,
      remaining: 75,
      percentage: 25,
      exceeded: false
    })
  })

  it('checkQuota 在 used 达到 limit 时标记 exceeded', async () => {
    checkQuotaMock.mockResolvedValueOnce({ limit: 100, used: 100, remaining: 0 })

    await expect(service.checkQuota()).resolves.toMatchObject({ percentage: 100, exceeded: true })
  })

  it('媒体管理器未就绪（返回 null）时抛错，不吞成 0', async () => {
    checkQuotaMock.mockResolvedValueOnce(null)

    await expect(service.checkQuota()).rejects.toThrow('配额检查失败')
  })

  it('getQuotaStats 透传真实字段（storageBytes / mediaCount / limitBytes）', async () => {
    getQuotaStatsMock.mockResolvedValueOnce({ storageBytes: 2048, mediaCount: 3, limitBytes: 4096 })

    await expect(service.getQuotaStats()).resolves.toEqual({
      storageBytes: 2048,
      mediaCount: 3,
      limitBytes: 4096
    })

    getQuotaStatsMock.mockResolvedValueOnce(null)
    await expect(service.getQuotaStats()).rejects.toThrow('获取配额统计失败')
  })

  it('getQuotaAlerts 透传媒体管理器的告警数组', async () => {
    const alert = { alert_id: 'a1', alert_type: 'quota_warning' }
    getQuotaAlertsMock.mockResolvedValueOnce([alert])

    await expect(service.getQuotaAlerts()).resolves.toEqual([alert])
  })

  it('getServerQuota 走 admin media 端点并映射 total_size 等字段', async () => {
    getMediaQuota.mockResolvedValueOnce({
      total_size: 1000,
      total_count: 5,
      default_size_limit: 100,
      default_count_limit: 10
    })

    await expect(service.getServerQuota()).resolves.toEqual({
      totalSize: 1000,
      totalCount: 5,
      defaultSizeLimit: 100,
      defaultCountLimit: 10
    })
    expect(getMediaQuota).toHaveBeenCalledTimes(1)
  })

  it('getServerQuota 失败时向上抛出', async () => {
    getMediaQuota.mockRejectedValueOnce(new Error('quota-fail'))

    await expect(service.getServerQuota()).rejects.toThrow('quota-fail')
  })

  // 回归防护：这些方法依赖的端点/访问器在 SDK 与后端都不存在，已随本批删除。
  // 若有人把它们加回来，本条会失败，提醒先确认后端确有对应路由。
  it('不再暴露无后端支撑的方法（getQuotaConfigs/setUserQuota/getUploadSizeLimit/getUserStorageUsage/hasStorageSpace）', () => {
    const surface = service as unknown as Record<string, unknown>
    for (const removed of [
      'getQuotaConfigs',
      'setUserQuota',
      'getUploadSizeLimit',
      'getUploadFileSizeLimit',
      'getUserStorageUsage',
      'hasStorageSpace'
    ]) {
      expect(surface[removed]).toBeUndefined()
    }
  })
})
