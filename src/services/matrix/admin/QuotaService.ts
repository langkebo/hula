import type { MatrixClient } from 'matrix-js-sdk'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import type { AdminManager } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import type { QuotaAlert, QuotaStats, QuotaStatus, ServerQuota } from './AdminTypes'

const logger = createLogger('QuotaService')

type SdkAdminGetter = () => Promise<AdminManager>
type GetClientGetter = () => MatrixClient

/**
 * 管理端「媒体配额」聚合服务。
 *
 * ⚠️ 2026-10-11 重写（审计报告 §13）：旧实现整个建立在一个**不存在的**
 * `client.getMediaQuotaManager()` 之上（SDK 里没有该方法，`client.quotaManager` 属性同样不存在），
 * 于是所有配额调用都抛「quotaManager 未初始化」。真实可用来源有两个：
 *
 *   - 用户侧配额：`MediaManager.checkMediaQuota() / getMediaQuotaStats() / getMediaQuotaAlerts()`
 *     → `GET /_matrix/media/v1/quota/{check,stats,alerts}`（`MatrixMediaService` 已实现，此处复用）；
 *   - 服务端总配额：`getAdminManager().media.getMediaQuota()`
 *     → `GET /_synapse/admin/v1/media/quota`。
 *
 * 同时删除 `getQuotaConfigs()` / `setUserQuota()`：后端**没有**这两个端点
 * （`registered_routes` 中 quota 只有上述 4 条），原先的 `QuotaConfig` 类型与
 * `QuotaManager.getQuotaConfigs/setUserQuota` 都是凭空声明的形状。
 */
export class AdminQuotaService {
  constructor(
    readonly _sdkAdmin: SdkAdminGetter,
    readonly _getClient: GetClientGetter
  ) {}

  async checkQuota(): Promise<QuotaStatus> {
    const result = await matrixMediaService.checkQuota()
    if (!result) {
      throw new Error('[AdminQuota] 配额检查失败（媒体管理器未就绪）')
    }
    const { limit, used, remaining } = result
    const percentage = limit > 0 ? Math.round((used / limit) * 100) : 0
    return { limit, used, remaining, percentage, exceeded: limit > 0 && used >= limit }
  }

  async getQuotaStats(): Promise<QuotaStats> {
    const result = await matrixMediaService.getQuotaStats()
    if (!result) {
      throw new Error('[AdminQuota] 获取配额统计失败（媒体管理器未就绪）')
    }
    return {
      storageBytes: result.storageBytes,
      mediaCount: result.mediaCount,
      limitBytes: result.limitBytes
    }
  }

  async getQuotaAlerts(): Promise<QuotaAlert[]> {
    const alerts = await matrixMediaService.getQuotaAlerts()
    return alerts
  }

  /** 服务端总配额（`GET /_synapse/admin/v1/media/quota`） */
  async getServerQuota(): Promise<ServerQuota> {
    try {
      const admin = await this._sdkAdmin()
      const quota = await admin.media.getMediaQuota()
      return {
        totalSize: quota.total_size ?? 0,
        totalCount: quota.total_count ?? 0,
        defaultSizeLimit: quota.default_size_limit ?? 0,
        defaultCountLimit: quota.default_count_limit ?? 0
      }
    } catch (err) {
      logger.error(`[AdminQuota] 获取服务端配额失败: ${err}`)
      throw err
    }
  }
}
