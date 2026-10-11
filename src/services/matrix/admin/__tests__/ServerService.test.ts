import type { AdminManager } from 'matrix-js-sdk/admin'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminServerService } from '../ServerService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const makeAdmin = () => ({
  getServerStats: vi.fn(),
  getServerStatus: vi.fn(),
  getServerHealth: vi.fn(),
  getServerVersion: vi.fn(),
  getServerConfig: vi.fn(),
  updateServerConfig: vi.fn(),
  restartServer: vi.fn(),
  getServerInfo: vi.fn(),
  getServerLogs: vi.fn()
})

describe('AdminServerService', () => {
  let admin: ReturnType<typeof makeAdmin>
  let service: AdminServerService

  beforeEach(() => {
    admin = makeAdmin()
    service = new AdminServerService(async () => admin as unknown as AdminManager)
  })

  // 真实字段集见 SDK `ServerStats`（`admin-server-types.d.ts`，已对照后端 `server.rs::get_statistics`）：
  // 有 `total_rooms` / `total_users` / `daily_active_users` / `monthly_active_users` / `total_messages`；
  // **没有** `total_nonlocal_users` / `server_start_time` / `room_count` / `user_count`（旧 mock 用的是这些）。
  it('getServerStats 映射真实统计字段', async () => {
    admin.getServerStats.mockResolvedValueOnce({
      total_rooms: 12,
      total_users: 34,
      daily_active_users: 5,
      monthly_active_users: 6,
      total_messages: 7
    })

    await expect(service.getServerStats()).resolves.toEqual({
      roomCount: 12,
      userCount: 34,
      dailyActiveUsers: 5,
      monthlyActiveUsers: 6,
      messageCount: 7,
      // 后端不提供服务器启动时间 ⇒ 恒为 0（见审计报告 §13 的死字段登记）
      startServerTime: 0
    })
  })

  it('getServerStats 对后端不返回的字段回落到 0', async () => {
    admin.getServerStats.mockResolvedValueOnce({})
    const result = await service.getServerStats()
    expect(result.roomCount).toBe(0)
    expect(result.userCount).toBe(0)
  })

  it('getServerStats 出错时返回全零默认值', async () => {
    admin.getServerStats.mockRejectedValueOnce(new Error('boom'))

    await expect(service.getServerStats()).resolves.toEqual({
      roomCount: 0,
      userCount: 0,
      dailyActiveUsers: 0,
      monthlyActiveUsers: 0,
      messageCount: 0,
      startServerTime: 0
    })
  })

  // 后端 `server.rs::get_status` 返回 `{db_ok, server_ok, up}`（SDK `ServerStatus` 同形）；
  // 没有 `status: 'online'` 也没有 `uptime`（旧 mock 用的是上游 Synapse 的形状）。
  it('getServerStatus 由 up 字段映射状态且出错时返回 null', async () => {
    admin.getServerStatus.mockResolvedValueOnce({ db_ok: true, server_ok: true, up: true })
    await expect(service.getServerStatus()).resolves.toEqual({ status: 'online', uptime: undefined })

    admin.getServerStatus.mockRejectedValueOnce(new Error('boom'))
    await expect(service.getServerStatus()).resolves.toBeNull()
  })

  it('getServerHealth 归一化 synapse-rust 的 {status, database} 响应（healthy 推导 + database checks）', async () => {
    admin.getServerHealth.mockResolvedValueOnce({ status: 'ok', database: 'ok' })

    await expect(service.getServerHealth()).resolves.toEqual({
      healthy: true,
      checks: { database: { status: 'ok' } }
    })
  })

  it('getServerHealth 数据库异常时 healthy 为 false', async () => {
    admin.getServerHealth.mockResolvedValueOnce({ status: 'error', database: 'error' })

    const result = await service.getServerHealth()
    expect(result?.healthy).toBe(false)
    expect(result?.checks).toEqual({ database: { status: 'error' } })
  })

  it('getServerHealth 优先透传 Python Synapse 风格的 healthy/checks 字段', async () => {
    admin.getServerHealth.mockResolvedValueOnce({
      healthy: true,
      checks: { cpu: { status: 'ok' }, memory: { status: 'ok' } }
    })

    await expect(service.getServerHealth()).resolves.toEqual({
      healthy: true,
      checks: { cpu: { status: 'ok' }, memory: { status: 'ok' } }
    })
  })

  it('getServerHealth 出错时返回 null', async () => {
    admin.getServerHealth.mockRejectedValueOnce(new Error('boom'))
    await expect(service.getServerHealth()).resolves.toBeNull()
  })

  it('getServerVersion 映射 server_version/python_version', async () => {
    admin.getServerVersion.mockResolvedValueOnce({ server_version: '1.2.3', python_version: null })

    await expect(service.getServerVersion()).resolves.toEqual({
      serverVersion: '1.2.3',
      pythonVersion: null
    })
    expect(admin.getServerVersion).toHaveBeenCalledWith(false)
  })

  it('updateServerConfig/restartServer 失败时向上抛出', async () => {
    admin.updateServerConfig.mockRejectedValueOnce(new Error('cfg-fail'))
    await expect(service.updateServerConfig({ a: 1 })).rejects.toThrow('cfg-fail')

    admin.restartServer.mockRejectedValueOnce(new Error('restart-fail'))
    await expect(service.restartServer()).rejects.toThrow('restart-fail')
  })

  it('getServerLogs 组装 level/limit 参数，出错时返回 null', async () => {
    admin.getServerLogs.mockResolvedValueOnce([{ line: 'x' }])
    await expect(service.getServerLogs('error', 20)).resolves.toEqual([{ line: 'x' }])
    expect(admin.getServerLogs).toHaveBeenCalledWith({ level: 'error', limit: 20 })

    admin.getServerLogs.mockRejectedValueOnce(new Error('boom'))
    await expect(service.getServerLogs()).resolves.toBeNull()
  })
})
