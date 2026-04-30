import { error, info } from '@tauri-apps/plugin-log'
import matrixClientService from '../MatrixClientService'

export interface QuotaStatus {
  used: number
  limit: number
  remaining: number
  percentage: number
  exceeded: boolean
}

export interface QuotaStats {
  totalFiles: number
  totalSize: number
  byType: Record<string, { count: number; size: number }>
  byRoom: Record<string, { count: number; size: number }>
  lastUpdated: number
}

export interface QuotaAlert {
  id: string
  type: 'warning' | 'critical' | 'exceeded'
  message: string
  threshold: number
  currentValue: number
  createdAt: number
  acknowledged: boolean
}

export interface QuotaConfig {
  id: string
  name: string
  defaultQuota: number
  maxQuota: number
  warningThreshold: number
  criticalThreshold: number
  enabled: boolean
}

export interface ServerQuota {
  totalUsed: number
  totalLimit: number
  userCount: number
  averageUsage: number
}

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

export class MatrixQuotaService {
  private get quotaManager(): QuotaManager {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixQuota] 客户端未初始化')
    }
    const manager =
      typeof client.getMediaQuotaManager === 'function'
        ? (client.getMediaQuotaManager() as QuotaManager)
        : (client.quotaManager as QuotaManager | undefined)
    if (!manager) {
      throw new Error('[MatrixQuota] QuotaManager not initialized')
    }
    return manager
  }

  private async withQuotaManagerFallback<T>(
    operation: string,
    fallbackValue: T,
    callback: (manager: QuotaManager) => Promise<T>,
    throwOnError = true
  ): Promise<T> {
    try {
      return await callback(this.quotaManager)
    } catch (err) {
      error(`[MatrixQuota] ${operation} 失败: ${err}`)
      if (throwOnError) {
        throw err
      }
      return fallbackValue
    }
  }

  async checkQuota(): Promise<QuotaStatus> {
    try {
      const status = await this.quotaManager.checkQuota()
      info('[MatrixQuota] 配额检查完成')
      return status
    } catch (err) {
      error(`[MatrixQuota] 配额检查失败: ${err}`)
      throw err
    }
  }

  async getQuotaStats(): Promise<QuotaStats> {
    try {
      const stats = await this.quotaManager.getQuotaStats()
      info('[MatrixQuota] 获取配额统计成功')
      return stats
    } catch (err) {
      error(`[MatrixQuota] 获取配额统计失败: ${err}`)
      throw err
    }
  }

  async getQuotaAlerts(): Promise<QuotaAlert[]> {
    try {
      const alerts = await this.quotaManager.getQuotaAlerts()
      info(`[MatrixQuota] 获取配额告警成功: ${alerts.length} 条`)
      return alerts
    } catch (err) {
      error(`[MatrixQuota] 获取配额告警失败: ${err}`)
      throw err
    }
  }

  async getQuotaConfigs(): Promise<QuotaConfig[]> {
    try {
      const configs = await this.quotaManager.getQuotaConfigs()
      info('[MatrixQuota] 获取配额配置成功')
      return configs
    } catch (err) {
      error(`[MatrixQuota] 获取配额配置失败: ${err}`)
      throw err
    }
  }

  async setUserQuota(userId: string, quota: number): Promise<void> {
    try {
      await this.quotaManager.setUserQuota(userId, quota)
      info(`[MatrixQuota] 设置用户配额成功: ${userId} -> ${quota}`)
    } catch (err) {
      error(`[MatrixQuota] 设置用户配额失败: ${err}`)
      throw err
    }
  }

  async getServerQuota(): Promise<ServerQuota> {
    try {
      const serverQuota = await this.quotaManager.getServerQuota()
      info('[MatrixQuota] 获取服务器配额成功')
      return serverQuota
    } catch (err) {
      error(`[MatrixQuota] 获取服务器配额失败: ${err}`)
      throw err
    }
  }

  async getUploadSizeLimit(throwOnError = true): Promise<number> {
    return this.withQuotaManagerFallback(
      '获取上传大小限制',
      10 * 1024 * 1024,
      async (manager) => {
        if (!manager.getUploadSizeLimit) {
          throw new Error('[MatrixQuota] getUploadSizeLimit is unavailable')
        }

        const limit = await manager.getUploadSizeLimit(throwOnError)
        info(`[MatrixQuota] 获取上传大小限制成功: ${limit}`)
        return limit
      },
      throwOnError
    )
  }

  async getUploadFileSizeLimit(throwOnError = true): Promise<number> {
    return this.withQuotaManagerFallback(
      '获取文件上传大小限制',
      10 * 1024 * 1024,
      async (manager) => {
        if (!manager.getUploadFileSizeLimit) {
          throw new Error('[MatrixQuota] getUploadFileSizeLimit is unavailable')
        }

        const limit = await manager.getUploadFileSizeLimit(throwOnError)
        info(`[MatrixQuota] 获取文件上传大小限制成功: ${limit}`)
        return limit
      },
      throwOnError
    )
  }

  async getUserStorageUsage(throwOnError = true): Promise<{ size: number; ntFiles: number } | null> {
    return this.withQuotaManagerFallback(
      '获取用户存储使用量',
      null,
      async (manager) => {
        if (!manager.getUserStorageUsage) {
          throw new Error('[MatrixQuota] getUserStorageUsage is unavailable')
        }

        const usage = await manager.getUserStorageUsage(throwOnError)
        info(`[MatrixQuota] 获取用户存储使用量成功: ${usage?.size ?? 0}`)
        return usage
      },
      throwOnError
    )
  }

  async hasStorageSpace(requiredBytes: number): Promise<boolean> {
    return this.withQuotaManagerFallback(
      '检查存储空间',
      true,
      async (manager) => {
        if (!manager.hasStorageSpace) {
          throw new Error('[MatrixQuota] hasStorageSpace is unavailable')
        }

        const result = await manager.hasStorageSpace(requiredBytes)
        info(`[MatrixQuota] 检查存储空间成功: ${requiredBytes} -> ${result}`)
        return result
      },
      false
    )
  }
}

export const matrixQuotaService = new MatrixQuotaService()
