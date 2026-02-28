import matrixClientService from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

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
    const manager = (client as any).quotaManager as QuotaManager | undefined
    if (!manager) {
      throw new Error('[MatrixQuota] QuotaManager not initialized')
    }
    return manager
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
}

export const matrixQuotaService = new MatrixQuotaService()
