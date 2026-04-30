import { invoke } from '@tauri-apps/api/core'
import { error, info, warn } from '@tauri-apps/plugin-log'
import type { MatrixClient } from 'matrix-js-sdk'
import { ref } from 'vue'
import { TauriCommand } from '@/enums'
import matrixClientService from '../MatrixClientService'
import type { AdminFacadeDomainMethods } from './AdminFacadeDomainMethods'
import { createAdminFacadeDomainMethods } from './AdminFacadeDomainMethods'
import type { AdminFacadeOpsMethods } from './AdminFacadeOpsMethods'
import { createAdminFacadeOpsMethods } from './AdminFacadeOpsMethods'
import type {
  FederationDestination,
  RateLimit,
  RegistrationToken,
  RoomInfo,
  RoomState,
  ServerHealth,
  ServerNoticeInfo,
  ServerNoticeResult,
  ServerStats,
  ServerStatus,
  ServerVersion,
  ShadowBanStatus,
  ShutdownRoomResult,
  UserDevice,
  UserInfo
} from './AdminTypes'
import { AdminApplicationService } from './ApplicationService'
import { AdminMediaService } from './MediaService'
import { AdminNotificationService } from './NotificationService'
import { AdminRegistrationTokensService } from './RegistrationTokensService'
import { AdminRetentionService } from './RetentionService'
import { AdminRoomService } from './RoomService'
import { AdminSecurityService } from './SecurityService'
import { AdminServerService } from './ServerService'
import { AdminUserService } from './UserService'

export type {
  FederationBlacklistEntry,
  FederationDestination,
  RateLimit,
  RegistrationToken,
  RoomInfo,
  RoomState,
  ServerHealth,
  ServerInfo,
  ServerNoticeInfo,
  ServerNoticeResult,
  ServerStats,
  ServerStatus,
  ServerVersion,
  ShadowBanStatus,
  ShutdownRoomResult,
  UserDevice,
  UserInfo
} from './AdminTypes'

class AdminFacadeService {
  private adminVerifiedAt = 0
  private readonly ADMIN_VERIFY_INTERVAL = 2 * 60 * 1000
  private cachedAdminStatus = false

  readonly registrationTokens = new AdminRegistrationTokensService(() => this.sdkAdmin())
  readonly users = new AdminUserService(
    () => this.sdkAdmin(),
    () => this.getClient()
  )
  readonly rooms = new AdminRoomService(
    () => this.sdkAdmin(),
    () => this.getClient()
  )
  readonly security = new AdminSecurityService(() => this.sdkAdmin())
  readonly server = new AdminServerService(() => this.sdkAdmin())
  readonly media = new AdminMediaService(() => this.sdkAdmin())
  readonly notifications = new AdminNotificationService(() => this.sdkAdmin())
  readonly retention = new AdminRetentionService(() => this.sdkAdmin())
  readonly applications = new AdminApplicationService(() => this.sdkAdmin())

  initialize(): void {
    info('[Admin] 服务已初始化')
  }

  private getClient(): MatrixClient {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }
    return client
  }

  private async verifyServerSidePermission(): Promise<boolean> {
    try {
      const client = this.getClient()
      const userId = client.getUserId()
      const accessToken = client.getAccessToken()

      if (!userId || !accessToken) {
        warn('[Admin] 服务端权限验证: 缺少 userId 或 accessToken')
        return false
      }

      const now = Date.now()
      if (now - this.adminVerifiedAt < this.ADMIN_VERIFY_INTERVAL) {
        return this.cachedAdminStatus
      }

      const result = await invoke<{ is_admin: boolean; user_id: string }>(TauriCommand.CHECK_ADMIN_STATUS, {
        userId,
        accessToken
      })

      this.cachedAdminStatus = result.is_admin
      this.adminVerifiedAt = now

      if (!result.is_admin) {
        warn(`[Admin] 服务端权限验证失败: userId=${result.user_id}, isAdmin=false`)
      }

      return result.is_admin
    } catch (err) {
      error(`[Admin] 服务端权限验证异常: ${err}`)
      return false
    }
  }

  /**
   * Returns the SDK `AdminManager` after running local permission verification.
   *
   * Phase B migration helper: all admin methods delegate here. The SDK owns
   * the HTTP contract (path / parameters / types) so Hula cannot drift from
   * the backend.
   *
   * @throws Error('ADMIN_PERMISSION_DENIED') if permission check fails.
   */
  private async sdkAdmin() {
    const hasPermission = await this.verifyServerSidePermission()
    if (!hasPermission) {
      error('[Admin] 权限不足，拒绝访问 SDK AdminManager')
      throw new Error('ADMIN_PERMISSION_DENIED')
    }
    const client = this.getClient() as MatrixClient & {
      getAdminManager?: () => import('matrix-js-sdk/admin').AdminManager
    }
    const manager = client.getAdminManager?.()
    if (!manager) {
      throw new Error('SDK AdminManager 不可用')
    }
    return manager
  }

  // ==================== Server Management ====================

  async getServerStats(): Promise<ServerStats> {
    return this.server.getServerStats()
  }

  async getServerStatus(): Promise<ServerStatus | null> {
    return this.server.getServerStatus()
  }

  async getServerHealth(): Promise<ServerHealth | null> {
    return this.server.getServerHealth()
  }

  async getServerVersion(): Promise<ServerVersion | null> {
    return this.server.getServerVersion()
  }

  async getServerConfig(): Promise<Record<string, unknown> | null> {
    return this.server.getServerConfig()
  }

  // ==================== User Management ====================

  async getUsers(
    limit = 100,
    from?: string,
    name?: string,
    _guests = true
  ): Promise<{ users: UserInfo[]; nextToken?: string }> {
    return this.users.getUsers(limit, from, name, _guests)
  }

  async getUser(userId: string): Promise<UserInfo | null> {
    return this.users.getUser(userId)
  }

  async createUser(
    username: string,
    password: string,
    options?: { admin?: boolean; displayname?: string; deactivated?: boolean }
  ): Promise<UserInfo | null> {
    return this.users.createUser(username, password, options)
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    return this.users.resetPassword(userId, newPassword)
  }

  async setAdmin(userId: string, isAdmin: boolean): Promise<void> {
    return this.users.setAdmin(userId, isAdmin)
  }

  async deactivateUser(userId: string): Promise<void> {
    return this.users.deactivateUser(userId)
  }

  async getUserDevices(userId: string): Promise<UserDevice[]> {
    return this.users.getUserDevices(userId)
  }

  async deleteUserDevice(userId: string, deviceId: string): Promise<void> {
    return this.users.deleteUserDevice(userId, deviceId)
  }

  async deleteUserDevices(userId: string, deviceIds: string[]): Promise<void> {
    return this.users.deleteUserDevices(userId, deviceIds)
  }

  async getRateLimit(userId: string): Promise<RateLimit | null> {
    return this.users.getRateLimit(userId)
  }

  async setRateLimit(userId: string, _limit: RateLimit): Promise<void> {
    return this.users.setRateLimit(userId, _limit)
  }

  async deleteRateLimit(userId: string): Promise<void> {
    return this.users.deleteRateLimit(userId)
  }

  async shadowBanUser(userId: string): Promise<void> {
    return this.users.shadowBanUser(userId)
  }

  async unshadowBanUser(userId: string): Promise<void> {
    return this.users.unshadowBanUser(userId)
  }

  async getShadowBanStatus(userId: string): Promise<ShadowBanStatus | null> {
    return this.users.getShadowBanStatus(userId)
  }

  async getWhois(userId: string): Promise<Record<string, unknown> | null> {
    return this.users.getWhois(userId)
  }

  // ==================== Room Management ====================

  async getRooms(limit = 100, from?: string, searchTerm?: string): Promise<{ rooms: RoomInfo[]; nextToken?: string }> {
    return this.rooms.getRooms(limit, from, searchTerm)
  }

  async getRoom(roomId: string): Promise<RoomInfo | null> {
    return this.rooms.getRoom(roomId)
  }

  async getRoomMembers(roomId: string): Promise<string[]> {
    return this.rooms.getRoomMembers(roomId)
  }

  async getRoomState(roomId: string): Promise<RoomState | null> {
    return this.rooms.getRoomState(roomId)
  }

  async deleteRoom(roomId: string, options?: { purge?: boolean }): Promise<void> {
    return this.rooms.deleteRoom(roomId, options)
  }

  async blockRoom(roomId: string, block: boolean): Promise<void> {
    return this.rooms.blockRoom(roomId, block)
  }

  async shutdownRoom(roomId: string, _message?: string): Promise<ShutdownRoomResult> {
    return this.rooms.shutdownRoom(roomId, _message)
  }

  async forceJoinRoom(roomId: string, userId: string): Promise<void> {
    return this.rooms.forceJoinRoom(roomId, userId)
  }

  async forceLeaveRoom(roomId: string, userId: string): Promise<void> {
    return this.rooms.forceLeaveRoom(roomId, userId)
  }

  async kickUser(roomId: string, userId: string, reason?: string): Promise<void> {
    return this.rooms.kickUser(roomId, userId, reason)
  }

  async banUser(roomId: string, userId: string, reason?: string): Promise<void> {
    return this.rooms.banUser(roomId, userId, reason)
  }

  async unbanUser(roomId: string, userId: string): Promise<void> {
    return this.rooms.unbanUser(roomId, userId)
  }

  // ==================== Federation Management ====================

  async getFederationDestinations(): Promise<FederationDestination[]> {
    return this.security.getFederationDestinations()
  }

  async getFederationDestination(destination: string): Promise<FederationDestination | null> {
    return this.security.getFederationDestination(destination)
  }

  async resetFederationConnection(destination: string): Promise<void> {
    return this.security.resetFederationConnection(destination)
  }

  // ==================== Notification Management ====================

  async sendServerNotice(userId: string, content: Record<string, unknown>): Promise<ServerNoticeResult> {
    return this.notifications.sendServerNotice(userId, content)
  }

  async getServerNotices(limit = 50): Promise<{ notices: ServerNoticeInfo[] } | null> {
    return this.notifications.getServerNotices(limit)
  }

  // ==================== Registration Token Management ====================
  // Delegated to ./admin/RegistrationTokensService.ts — see `this.registrationTokens`.

  async getRegistrationTokens(_valid?: boolean): Promise<RegistrationToken[]> {
    return this.registrationTokens.list()
  }

  async getRegistrationToken(token: string): Promise<RegistrationToken | null> {
    return this.registrationTokens.get(token)
  }

  async createRegistrationToken(options?: {
    token?: string
    usesAllowed?: number
    expiryTime?: number
    length?: number
  }): Promise<RegistrationToken | null> {
    return this.registrationTokens.create(options)
  }

  async updateRegistrationToken(
    token: string,
    updates: { usesAllowed?: number; expiryTime?: number }
  ): Promise<RegistrationToken | null> {
    return this.registrationTokens.update(token, updates)
  }

  async deleteRegistrationToken(token: string): Promise<void> {
    return this.registrationTokens.delete(token)
  }
}

export type AdminFacadeApi = AdminFacadeService & AdminFacadeDomainMethods & AdminFacadeOpsMethods

const adminFacadeBase = new AdminFacadeService()

export const adminService: AdminFacadeApi = Object.assign(
  adminFacadeBase,
  createAdminFacadeDomainMethods(adminFacadeBase),
  createAdminFacadeOpsMethods(adminFacadeBase)
)

export function useAdmin() {
  const stats = ref<ServerStats | null>(null)
  const users = ref<UserInfo[]>([])
  const rooms = ref<RoomInfo[]>([])
  const isLoading = ref(false)

  function initialize() {
    adminService.initialize()
  }

  async function loadStats() {
    isLoading.value = true
    try {
      stats.value = await adminService.getServerStats()
    } finally {
      isLoading.value = false
    }
  }

  async function loadUsers(limit?: number) {
    isLoading.value = true
    try {
      const result = await adminService.getUsers(limit)
      users.value = result.users
    } finally {
      isLoading.value = false
    }
  }

  async function loadRooms(limit?: number) {
    isLoading.value = true
    try {
      const result = await adminService.getRooms(limit)
      rooms.value = result.rooms
    } finally {
      isLoading.value = false
    }
  }

  return { stats, users, rooms, isLoading, initialize, loadStats, loadUsers, loadRooms }
}

export default adminService
