import type { MatrixClient } from 'matrix-js-sdk'
import type { AdminManager } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import type { QuotaAlert, QuotaConfig, QuotaStats, QuotaStatus, ServerQuota } from './AdminTypes'

const logger = createLogger('QuotaService')

interface QuotaManager {
  checkQuota(): Promise<QuotaStatus>
  getQuotaStats(): Promise<QuotaStats>
  getUploadSizeLimit?(throwOnError?: boolean): Promise<number>
  getUploadFileSizeLimit?(throwOnError?: boolean): Promise<number>
  getUserStorageUsage?(throwOnError?: boolean): Promise<{ size: number; ntFiles: number } | null>
  hasStorageSpace?(requiredBytes: number): Promise<boolean>
  getQuotaAlerts(): Promise<QuotaAlert[]>
  getQuotaConfigs(): Promise<QuotaConfig[]>
  setUserQuota(userId: string, quota: number): Promise<void>
  getServerQuota(): Promise<ServerQuota>
}

type SdkAdminGetter = () => Promise<AdminManager>
type GetClientGetter = () => MatrixClient

export class AdminQuotaService {
  constructor(
    readonly _sdkAdmin: SdkAdminGetter,
    private readonly getClient: GetClientGetter
  ) {}

  private get quotaManager(): QuotaManager {
    const client = this.getClient()
    const manager =
      typeof client.getMediaQuotaManager === 'function'
        ? (client.getMediaQuotaManager() as QuotaManager)
        : ((client as unknown as { quotaManager?: QuotaManager }).quotaManager as QuotaManager | undefined)
    if (!manager) {
      throw new Error('[AdminQuota] quotaManager 未初始化')
    }
    return manager
  }

  async checkQuota(): Promise<QuotaStatus> {
    try {
      const status = await this.quotaManager.checkQuota()
      logger.info('[AdminQuota] 配额检查完成')
      return status
    } catch (err) {
      logger.error(`[AdminQuota] 配额检查失败: ${err}`)
      throw err
    }
  }

  async getQuotaStats(): Promise<QuotaStats> {
    try {
      const stats = await this.quotaManager.getQuotaStats()
      logger.info('[AdminQuota] 获取配额统计成功')
      return stats
    } catch (err) {
      logger.error(`[AdminQuota] 获取配额统计失败: ${err}`)
      throw err
    }
  }

  async getQuotaAlerts(): Promise<QuotaAlert[]> {
    try {
      const alerts = await this.quotaManager.getQuotaAlerts()
      logger.info(`[AdminQuota] 获取配额告警成功: ${alerts.length} 条`)
      return alerts
    } catch (err) {
      logger.error(`[AdminQuota] 获取配额告警失败: ${err}`)
      throw err
    }
  }

  async getQuotaConfigs(): Promise<QuotaConfig[]> {
    try {
      const configs = await this.quotaManager.getQuotaConfigs()
      logger.info('[AdminQuota] 获取配额配置成功')
      return configs
    } catch (err) {
      logger.error(`[AdminQuota] 获取配额配置失败: ${err}`)
      throw err
    }
  }

  async setUserQuota(userId: string, quota: number): Promise<void> {
    try {
      await this.quotaManager.setUserQuota(userId, quota)
      logger.info(`[AdminQuota] 设置用户配额成功: ${userId} -> ${quota}`)
    } catch (err) {
      logger.error(`[AdminQuota] 设置用户配额失败: ${err}`)
      throw err
    }
  }

  async getServerQuota(): Promise<ServerQuota> {
    try {
      const serverQuota = await this.quotaManager.getServerQuota()
      logger.info('[AdminQuota] 获取服务器配额成功')
      return serverQuota
    } catch (err) {
      logger.error(`[AdminQuota] 获取服务器配额失败: ${err}`)
      throw err
    }
  }

  async getUploadSizeLimit(throwOnError = true): Promise<number> {
    try {
      if (!this.quotaManager.getUploadSizeLimit) {
        throw new Error('[AdminQuota] upload_size_limit_unavailable')
      }
      const limit = await this.quotaManager.getUploadSizeLimit(throwOnError)
      logger.info(`[AdminQuota] 获取上传大小限制成功: ${limit}`)
      return limit
    } catch (err) {
      logger.error(`[AdminQuota] 获取上传大小限制失败: ${err}`)
      if (throwOnError) throw err
      return 10 * 1024 * 1024
    }
  }

  async getUploadFileSizeLimit(throwOnError = true): Promise<number> {
    try {
      if (!this.quotaManager.getUploadFileSizeLimit) {
        throw new Error('[AdminQuota] upload_file_size_limit_unavailable')
      }
      const limit = await this.quotaManager.getUploadFileSizeLimit(throwOnError)
      logger.info(`[AdminQuota] 获取文件上传大小限制成功: ${limit}`)
      return limit
    } catch (err) {
      logger.error(`[AdminQuota] 获取文件上传大小限制失败: ${err}`)
      if (throwOnError) throw err
      return 10 * 1024 * 1024
    }
  }

  async getUserStorageUsage(throwOnError = true): Promise<{ size: number; ntFiles: number } | null> {
    try {
      if (!this.quotaManager.getUserStorageUsage) {
        throw new Error('[AdminQuota] user_storage_usage_unavailable')
      }
      const usage = await this.quotaManager.getUserStorageUsage(throwOnError)
      logger.info(`[AdminQuota] 获取用户存储使用量成功: ${usage?.size ?? 0}`)
      return usage
    } catch (err) {
      logger.error(`[AdminQuota] 获取用户存储使用量失败: ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  async hasStorageSpace(requiredBytes: number): Promise<boolean> {
    try {
      if (!this.quotaManager.hasStorageSpace) {
        throw new Error('[AdminQuota] has_storage_space_unavailable')
      }
      const result = await this.quotaManager.hasStorageSpace(requiredBytes)
      logger.info(`[AdminQuota] 检查存储空间成功: ${requiredBytes} -> ${result}`)
      return result
    } catch (err) {
      logger.error(`[AdminQuota] 检查存储空间失败: ${err}`)
      return false
    }
  }
}
