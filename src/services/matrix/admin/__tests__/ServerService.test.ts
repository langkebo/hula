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

  it('getServerStats 映射统计字段（total_* 优先）', async () => {
    admin.getServerStats.mockResolvedValueOnce({
      total_rooms: 12,
      total_users: 34,
      daily_active_users: 5,
      monthly_active_users: 6,
      total_nonlocal_users: 7,
      server_start_time: 1700
    })

    await expect(service.getServerStats()).resolves.toEqual({
      roomCount: 12,
      userCount: 34,
      dailyActiveUsers: 5,
      monthlyActiveUsers: 6,
      messageCount: 7,
      startServerTime: 1700
    })
  })

  it('getServerStats 支持 room_count/user_count 备用字段', async () => {
    admin.getServerStats.mockResolvedValueOnce({ room_count: 3, user_count: 4 })

    const result = await service.getServerStats()
    expect(result.roomCount).toBe(3)
    expect(result.userCount).toBe(4)
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

  it('getServerStatus 映射状态且出错时返回 null', async () => {
    admin.getServerStatus.mockResolvedValueOnce({ status: 'online', uptime: 3600 })
    await expect(service.getServerStatus()).resolves.toEqual({ status: 'online', uptime: 3600 })

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
