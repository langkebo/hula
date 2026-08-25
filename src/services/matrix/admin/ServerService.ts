import { createLogger } from '@/utils/Logger'
import type { ServerHealth, ServerStats, ServerStatus, ServerVersion } from './AdminTypes'

const logger = createLogger('ServerService')

type ServerDomainSdkGetter = () => Promise<import('matrix-js-sdk/admin').AdminManager>

export class AdminServerService {
  constructor(private readonly sdkAdmin: ServerDomainSdkGetter) {}

  async getServerStats(): Promise<ServerStats> {
    try {
      const admin = await this.sdkAdmin()
      const stats = await admin.getServerStats()
      return {
        roomCount: Number(stats?.total_rooms ?? stats?.room_count ?? 0),
        userCount: Number(stats?.total_users ?? stats?.user_count ?? 0),
        dailyActiveUsers: Number(stats?.daily_active_users ?? 0),
        monthlyActiveUsers: Number(stats?.monthly_active_users ?? 0),
        messageCount: Number(stats?.total_nonlocal_users ?? 0),
        startServerTime: Number(stats?.server_start_time ?? 0)
      }
    } catch (err) {
      logger.error(`[AdminServer] 获取统计失败: ${err}`)
      return {
        roomCount: 0,
        userCount: 0,
        dailyActiveUsers: 0,
        monthlyActiveUsers: 0,
        messageCount: 0,
        startServerTime: 0
      }
    }
  }

  async getServerStatus(): Promise<ServerStatus | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getServerStatus()
      if (!result) return null
      const _up = result.status === 'online'
      return {
        status: result.status,
        uptime: result.uptime
      }
    } catch (err) {
      logger.error(`[AdminServer] 获取服务器状态失败: ${err}`)
      return null
    }
  }

  async getServerHealth(): Promise<ServerHealth | null> {
    try {
      const admin = await this.sdkAdmin()
      // SDK 类型声明为 Python Synapse 风格 { healthy, checks }，
      // 但 synapse-rust 实际返回 { status: 'ok'|'error', database: 'ok'|'error' }，
      // 这里做归一化：healthy 优先取显式字段，否则由 status/database 推导，
      // 否则 result.healthy 恒为 undefined → 仪表盘永远显示"异常"。
      const result = (await admin.getServerHealth()) as unknown as Record<string, unknown> | null
      if (!result) return null

      const rawHealthy = result.healthy
      const healthy = typeof rawHealthy === 'boolean' ? rawHealthy : result.status === 'ok' && result.database === 'ok'

      const checks = (result.checks as Record<string, unknown> | undefined) ?? {
        database: { status: result.database === 'ok' ? 'ok' : 'error' }
      }

      return { healthy, checks }
    } catch (err) {
      logger.error(`[AdminServer] 获取服务器健康状态失败: ${err}`)
      return null
    }
  }

  async getServerVersion(): Promise<ServerVersion | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getServerVersion(false)
      return {
        serverVersion: result?.server_version ?? '',
        pythonVersion: result?.python_version
      }
    } catch (err) {
      logger.error(`[AdminServer] 获取服务器版本失败: ${err}`)
      return null
    }
  }

  async getServerConfig(): Promise<Record<string, unknown> | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getServerConfig(false)
      return (result as unknown as Record<string, unknown>) ?? null
    } catch (err) {
      logger.error(`[AdminServer] 获取服务器配置失败: ${err}`)
      return null
    }
  }

  async updateServerConfig(config: Record<string, unknown>): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.updateServerConfig(config)
      logger.info('[AdminServer] 服务器配置已更新')
    } catch (err) {
      logger.error(`[AdminServer] 更新服务器配置失败: ${err}`)
      throw err
    }
  }

  async restartServer(): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.restartServer()
      logger.info('[AdminServer] 服务器重启已请求')
    } catch (err) {
      logger.error(`[AdminServer] 重启服务器失败: ${err}`)
      throw err
    }
  }

  async getAdminInfo(): Promise<Record<string, unknown> | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getServerInfo()
      return (result as unknown as Record<string, unknown>) ?? null
    } catch (err) {
      logger.error(`[AdminServer] 获取管理端信息失败: ${err}`)
      return null
    }
  }

  async getServerLogs(
    level?: 'debug' | 'info' | 'warn' | 'error',
    limit = 100
  ): Promise<Array<Record<string, unknown>> | null> {
    try {
      const admin = await this.sdkAdmin()
      const params: { level?: string; limit?: number } = { limit }
      if (level) params.level = level
      return (await admin.getServerLogs(params)) ?? null
    } catch (err) {
      logger.error(`[AdminServer] 获取服务器日志失败: ${err}`)
      return null
    }
  }
}
