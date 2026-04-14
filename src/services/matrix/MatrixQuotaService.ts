import matrixClientService from './MatrixClientService'
import { BaseManager } from './BaseManager'
import { info } from '@tauri-apps/plugin-log'

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

class MatrixQuotaService extends BaseManager {
  private getMediaQuotaManager() {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('[MatrixQuota] 客户端未初始化')
    const manager = (client as any).getMediaQuotaManager?.()
    if (!manager) throw new Error('[MatrixQuota] MediaQuotaManager 不可用')
    return manager
  }

  async checkQuota(throwOnError = true): Promise<QuotaStatus> {
    try {
      const manager = this.getMediaQuotaManager()
      const hasSpace = await manager.hasStorageSpace()
      const usage = await manager.getUserStorageUsage()
      const config = await manager.getMediaConfig()
      const limit = config?.uploadMaxSizeBytes ?? 0
      const used = usage?.used ?? 0
      const remaining = Math.max(0, limit - used)
      const percentage = limit > 0 ? Math.round((used / limit) * 100) : 0
      info('[MatrixQuota] 配额检查完成')
      return {
        used,
        limit,
        remaining,
        percentage,
        exceeded: !hasSpace
      }
    } catch (error) {
      return this.handleError(error, 'checkQuota', { used: 0, limit: 0, remaining: 0, percentage: 0, exceeded: false }, throwOnError)
    }
  }

  async getQuotaStats(throwOnError = true): Promise<QuotaStats> {
    try {
      const manager = this.getMediaQuotaManager()
      const usage = await manager.getUserStorageUsage()
      info('[MatrixQuota] 获取配额统计成功')
      return {
        totalFiles: usage?.fileCount ?? 0,
        totalSize: usage?.used ?? 0,
        byType: usage?.byType ?? {},
        byRoom: usage?.byRoom ?? {},
        lastUpdated: Date.now()
      }
    } catch (error) {
      return this.handleError(error, 'getQuotaStats', { totalFiles: 0, totalSize: 0, byType: {}, byRoom: {}, lastUpdated: 0 }, throwOnError)
    }
  }

  async getQuotaAlerts(throwOnError = true): Promise<QuotaAlert[]> {
    try {
      const manager = this.getMediaQuotaManager()
      const alerts = await manager.getQuotaAlerts()
      info(`[MatrixQuota] 获取配额告警成功: ${alerts?.length ?? 0} 条`)
      return (alerts || []).map((a: any) => ({
        id: a.alert_id ?? a.id ?? '',
        type: a.alert_type ?? a.type ?? 'warning',
        message: a.message ?? '',
        threshold: a.threshold_percent ?? a.threshold ?? 0,
        currentValue: a.current_value ?? a.currentValue ?? 0,
        createdAt: a.created_ts ?? a.createdAt ?? 0,
        acknowledged: a.acknowledged ?? false
      }))
    } catch (error) {
      return this.handleError(error, 'getQuotaAlerts', [] as QuotaAlert[], throwOnError)
    }
  }

  async getQuotaConfigs(throwOnError = true): Promise<QuotaConfig[]> {
    try {
      const manager = this.getMediaQuotaManager()
      const config = await manager.getMediaConfig()
      info('[MatrixQuota] 获取配额配置成功')
      return [
        {
          id: 'default',
          name: '默认配额',
          defaultQuota: config?.uploadMaxSizeBytes ?? 0,
          maxQuota: 0,
          warningThreshold: 80,
          criticalThreshold: 95,
          enabled: true
        }
      ]
    } catch (error) {
      return this.handleError(error, 'getQuotaConfigs', [] as QuotaConfig[], throwOnError)
    }
  }

  async setUserQuota(_userId: string, _quota: number, throwOnError = false): Promise<void> {
    try {
      throw new Error('MediaQuotaManager 不支持设置用户配额')
    } catch (error) {
      this.handleError(error, 'setUserQuota', undefined, throwOnError)
    }
  }

  async getServerQuota(throwOnError = true): Promise<ServerQuota> {
    try {
      const manager = this.getMediaQuotaManager()
      const config = await manager.getMediaConfig()
      info('[MatrixQuota] 获取服务器配额成功')
      return {
        totalUsed: 0,
        totalLimit: config?.uploadMaxSizeBytes ?? 0,
        userCount: 0,
        averageUsage: 0
      }
    } catch (error) {
      return this.handleError(error, 'getServerQuota', { totalUsed: 0, totalLimit: 0, userCount: 0, averageUsage: 0 }, throwOnError)
    }
  }
}

export const matrixQuotaService = new MatrixQuotaService()
