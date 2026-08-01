import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { adminService } from '../'

// C-1 反馈回路：验证 verifyServerSidePermission 浏览器模式修复
// 预期：浏览器 dev 模式（无 Tauri runtime）下，SDK AdminManager.getUserById() 返回 admin=true 时，
//       管理员操作应正常执行（不再抛 ADMIN_PERMISSION_DENIED）

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn()
}))

// 关键：模拟浏览器 dev 模式 — Tauri 不可用
vi.mock('@/utils/AppHarness', () => ({
  hasTauriRuntime: () => false,
  isBrowser: () => true,
  detectAppPlatform: () => 'desktop',
  shouldBypassAuthForE2E: () => false
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

describe('AdminFacadeService — C-1 浏览器 dev 模式（无 Tauri runtime）', () => {
  let mockAdminManager: Record<string, ReturnType<typeof vi.fn>>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient')
    // 关键：清除 adminService 单例的缓存，避免上一个测试文件的缓存污染
    adminService.clearAdminApiCache()

    mockAdminManager = {
      whoami: vi.fn().mockResolvedValue({ user_id: '@admin1:matrix.test', is_admin: true }),
      getUserById: vi.fn().mockResolvedValue({ user_id: '@admin1:matrix.test', name: 'admin1', admin: true }),
      getServerStats: vi.fn().mockResolvedValue({
        total_rooms: 5,
        total_users: 10,
        daily_active_users: 3,
        monthly_active_users: 7,
        total_nonlocal_users: 0,
        server_start_time: 123456
      }),
      getServerVersion: vi.fn().mockResolvedValue({ server_version: '1.0.0', python_version: '3.11' }),
      getUsersPaginated: vi.fn().mockResolvedValue({ items: [], nextToken: undefined }),
      getUser: vi.fn().mockResolvedValue(null),
      getRooms: vi.fn().mockResolvedValue({ rooms: [], next_token: undefined }),
      getRegistrationTokens: vi.fn().mockResolvedValue([]),
      listFeatureFlags: vi.fn().mockResolvedValue({ flags: [] }),
      getMedia: vi.fn().mockResolvedValue({ media: [], next_token: undefined }),
      getFederationDestinations: vi.fn().mockResolvedValue([]),
      listAuditEvents: vi.fn().mockResolvedValue({ events: [], next_batch: undefined }),
      listBackups: vi.fn().mockResolvedValue({ backups: [] }),
      listSpaces: vi.fn().mockResolvedValue({ spaces: [], next_batch: undefined }),
      listSecurityEvents: vi.fn().mockResolvedValue({ events: [], next_token: undefined }),
      listIpBlocks: vi.fn().mockResolvedValue([]),
      listNotifications: vi.fn().mockResolvedValue({ notifications: [], next_token: undefined }),
      listApplicationServices: vi.fn().mockResolvedValue({ services: [], next_token: undefined }),
      listSamlMappings: vi.fn().mockResolvedValue({ mappings: [], next_token: undefined }),
      listUserStats: vi.fn().mockResolvedValue({ user_stats: [], next_token: undefined }),
      listRoomStats: vi.fn().mockResolvedValue({ room_stat: [], next_token: undefined }),
      listLoginFailures: vi.fn().mockResolvedValue({ failures: [], next_token: undefined })
    }

    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getUserId: vi.fn(() => '@admin1:matrix.test'),
      getAccessToken: vi.fn(() => 'syt_admin_token'),
      getHomeserverUrl: vi.fn(() => 'https://matrix.test'),
      getDomain: vi.fn(() => 'matrix.test'),
      http: { authedRequest: vi.fn() },
      getAdminManager: vi.fn(() => mockAdminManager)
    } as unknown as MatrixClient)
  })

  it('浏览器模式下 SDK getUserById 返回 admin=true → 应执行管理员操作', async () => {
    mockAdminManager.getUserById.mockResolvedValue({ user_id: '@admin1:matrix.test', name: 'admin1', admin: true })

    // 调用一个会触发 sdkAdmin() → verifyServerSidePermission() 的方法
    const result = await adminService.getServerStats()

    // 验证管理员操作成功执行
    expect(result.roomCount).toBe(5)
    expect(result.userCount).toBe(10)
    expect(mockAdminManager.getServerStats).toHaveBeenCalled()
  })

  it('浏览器模式下 SDK getUserById 返回 admin=false → 应拒绝访问 SDK AdminManager', async () => {
    mockAdminManager.getUserById.mockResolvedValue({ user_id: '@user1:matrix.test', name: 'user1', admin: false })

    // 子服务会捕获 ADMIN_PERMISSION_DENIED 并返回 fallback，因此验证 SDK manager 未被调用
    const result = await adminService.getServerStats()
    expect(result).toEqual({
      roomCount: 0,
      userCount: 0,
      dailyActiveUsers: 0,
      monthlyActiveUsers: 0,
      messageCount: 0,
      startServerTime: 0
    })
    expect(mockAdminManager.getServerStats).not.toHaveBeenCalled()
  })

  it('浏览器模式下 SDK getUserById 抛 403 → 应视为非管理员并拒绝访问 SDK AdminManager', async () => {
    mockAdminManager.getUserById.mockRejectedValue(new Error('403 Forbidden'))

    const result = await adminService.getServerStats()
    expect(result).toEqual({
      roomCount: 0,
      userCount: 0,
      dailyActiveUsers: 0,
      monthlyActiveUsers: 0,
      messageCount: 0,
      startServerTime: 0
    })
    expect(mockAdminManager.getServerStats).not.toHaveBeenCalled()
  })

  it('浏览器模式下 SDK getUserById 返回 admin=true 后应缓存结果（2 分钟内）', async () => {
    mockAdminManager.getUserById.mockResolvedValue({ user_id: '@admin1:matrix.test', name: 'admin1', admin: true })

    // 第一次调用 — 触发 API 验证
    await adminService.getServerStats()
    expect(mockAdminManager.getUserById).toHaveBeenCalledTimes(1)

    // 第二次调用 — 应使用缓存，不再次调用 getUserById
    await adminService.getServerStats()
    expect(mockAdminManager.getUserById).toHaveBeenCalledTimes(1)
  })

  it('浏览器模式下多次管理员操作应共享缓存验证结果', async () => {
    mockAdminManager.getUserById.mockResolvedValue({ user_id: '@admin1:matrix.test', name: 'admin1', admin: true })

    // 调用多个不同的管理员操作
    await adminService.getServerStats()
    await adminService.getServerVersion()
    await adminService.getUsers()

    // getUserById 只应被调用一次（缓存命中后续请求）
    expect(mockAdminManager.getUserById).toHaveBeenCalledTimes(1)
    expect(mockAdminManager.getServerStats).toHaveBeenCalled()
    expect(mockAdminManager.getServerVersion).toHaveBeenCalled()
    expect(mockAdminManager.getUsersPaginated).toHaveBeenCalled()
  })

  it('浏览器模式下 SDK getUserById 调用应传入正确的 userId', async () => {
    mockAdminManager.getUserById.mockResolvedValue({ user_id: '@admin1:matrix.test', name: 'admin1', admin: true })

    await adminService.getServerStats()

    expect(mockAdminManager.getUserById).toHaveBeenCalledWith('@admin1:matrix.test', false)
  })

  it('浏览器模式下 clearAdminApiCache 后应重新验证', async () => {
    mockAdminManager.getUserById.mockResolvedValue({ user_id: '@admin1:matrix.test', name: 'admin1', admin: true })

    await adminService.getServerStats()
    expect(mockAdminManager.getUserById).toHaveBeenCalledTimes(1)

    // 清除缓存
    adminService.clearAdminApiCache()

    await adminService.getServerStats()
    expect(mockAdminManager.getUserById).toHaveBeenCalledTimes(2)
  })
})
