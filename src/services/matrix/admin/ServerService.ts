import { error, info } from '@tauri-apps/plugin-log'
import type { ServerStats, ServerStatus, ServerHealth, ServerVersion } from './AdminTypes'

type ServerDomainSdkGetter = () => Promise<unknown>

export class AdminServerService {
  constructor(private readonly sdkAdmin: ServerDomainSdkGetter) {}

  async getServerStats(): Promise<ServerStats> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getServerStats(): Promise<Record<string, unknown>>
      }
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
      error(`[AdminServer] 获取统计失败: ${err}`)
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
      const admin = (await this.sdkAdmin()) as unknown as {
        getServerStatus(throwOnError?: boolean): Promise<Record<string, unknown> | null>
      }
      const result = await admin.getServerStatus(false)
      if (!result) return null
      const up = Boolean(result.up ?? result.server_ok ?? result.db_ok)
      const dbOk = Boolean(result.db_ok ?? up)
      const serverOk = Boolean(result.server_ok ?? up)
      return {
        status: up ? (dbOk && serverOk ? 'online' : 'degraded') : 'offline',
        uptime: result.uptime as number | undefined
      }
    } catch (err) {
      error(`[AdminServer] 获取服务器状态失败: ${err}`)
      return null
    }
  }

  async getServerHealth(): Promise<ServerHealth | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getServerHealth(throwOnError?: boolean): Promise<Record<string, unknown> | null>
      }
      const result = await admin.getServerHealth(false)
      if (!result) return null
      const serverStatus = String(result.status ?? '').toLowerCase()
      const databaseStatus = String(result.database ?? '').toLowerCase()
      const healthy =
        typeof result.healthy === 'boolean'
          ? result.healthy
          : ['ok', 'healthy', 'pass'].includes(serverStatus || databaseStatus)
      return {
        healthy,
        checks: (result.checks as Record<string, unknown> | undefined) ?? {
          server: { status: serverStatus || (healthy ? 'ok' : 'error') },
          database: { status: databaseStatus || (healthy ? 'ok' : 'error') }
        }
      }
    } catch (err) {
      error(`[AdminServer] 获取服务器健康状态失败: ${err}`)
      return null
    }
  }

  async getServerVersion(): Promise<ServerVersion | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getServerVersion(throwOnError?: boolean): Promise<{ server_version?: string; python_version?: string }>
      }
      const result = await admin.getServerVersion(false)
      return {
        serverVersion: result?.server_version ?? '',
        pythonVersion: result?.python_version
      }
    } catch (err) {
      error(`[AdminServer] 获取服务器版本失败: ${err}`)
      return null
    }
  }

  async getServerConfig(): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getServerConfig(throwOnError?: boolean): Promise<Record<string, unknown>>
      }
      return (await admin.getServerConfig(false)) ?? null
    } catch (err) {
      error(`[AdminServer] 获取服务器配置失败: ${err}`)
      return null
    }
  }

  async restartServer(): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        restartServer(): Promise<void>
      }
      await admin.restartServer()
      info('[AdminServer] 服务器重启已请求')
    } catch (err) {
      error(`[AdminServer] 重启服务器失败: ${err}`)
      throw err
    }
  }

  async getAdminInfo(): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getServerInfo(throwOnError?: boolean): Promise<Record<string, unknown> | null>
      }
      return (await admin.getServerInfo(false)) ?? null
    } catch (err) {
      error(`[AdminServer] 获取管理端信息失败: ${err}`)
      return null
    }
  }

  async getServerLogs(
    level?: 'debug' | 'info' | 'warn' | 'error',
    limit = 100
  ): Promise<Array<Record<string, unknown>> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getServerLogs(params: { level?: string; limit?: number }): Promise<Array<Record<string, unknown>>>
      }
      const params: { level?: string; limit?: number } = { limit }
      if (level) params.level = level
      return (await admin.getServerLogs(params)) ?? null
    } catch (err) {
      error(`[AdminServer] 获取服务器日志失败: ${err}`)
      return null
    }
  }
}
