import { LARGE_PAGE_LIMIT } from '@/common/constants'
import { AdminFacadeTrustSafetyMethods } from './AdminFacadeTrustSafetyMethods'
import type {
  FederationBlacklistEntry,
  FederationDestination,
  RateLimit,
  RegistrationToken,
  RoomInfo,
  RoomState,
  ShadowBanStatus,
  ShutdownRoomResult,
  UserDevice,
  UserInfo
} from './AdminTypes'
import type { AdminFederationService } from './FederationService'
import type { AdminRegistrationTokensService } from './RegistrationTokensService'

/**
 * AdminFacadeService 的用户 / 房间 / 联邦 / 注册令牌方法片段。
 *
 * 从 `AdminFacadeService` 抽离：这些方法是对 admin 子服务的薄委托，
 * 单独成混入类可把门面文件控制在 400 行门槛以内。
 * 子类（AdminFacadeService）提供各子服务字段。
 */
export abstract class AdminFacadeUserRoomMethods extends AdminFacadeTrustSafetyMethods {
  abstract readonly registrationTokens: AdminRegistrationTokensService
  abstract readonly federation: AdminFederationService

  // ==================== User Management ====================

  async getUsers(
    limit = LARGE_PAGE_LIMIT,
    from?: string,
    guests?: boolean
  ): Promise<{ users: UserInfo[]; nextToken?: string | undefined; failed?: boolean }> {
    return this.users.getUsers(limit, from, guests)
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

  /**
   * 重新激活已停用的用户（deactivated: false）。
   * @param userId 目标用户 ID
   */
  async activateUser(userId: string): Promise<void> {
    return this.users.activateUser(userId)
  }

  async getUserDevices(userId: string): Promise<UserDevice[]> {
    return this.users.getUserDevices(userId)
  }

  async deleteUserDevice(userId: string, deviceId: string): Promise<void> {
    return this.users.deleteUserDevice(userId, deviceId)
  }

  async getRateLimit(userId: string): Promise<RateLimit | null> {
    return this.users.getRateLimit(userId)
  }

  /** 覆盖指定用户的速率限制
   */
  async overrideUserRateLimit(userId: string): Promise<void> {
    return this.users.overrideUserRateLimit(userId)
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

  async getRooms(
    limit = LARGE_PAGE_LIMIT,
    from?: string,
    searchTerm?: string
  ): Promise<{ rooms: RoomInfo[]; nextToken?: string | undefined; failed?: boolean }> {
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
    return this.federation.getFederationDestinations()
  }

  async getFederationDestination(destination: string): Promise<FederationDestination | null> {
    return this.federation.getFederationDestination(destination)
  }

  async resetFederationConnection(destination: string): Promise<void> {
    return this.federation.resetFederationConnection(destination)
  }

  async getFederationBlacklist(): Promise<FederationBlacklistEntry[]> {
    return this.federation.getFederationBlacklist()
  }

  async addToFederationBlacklist(domain: string, reason?: string): Promise<boolean> {
    return this.federation.addToFederationBlacklist(domain, reason)
  }

  async removeFromFederationBlacklist(domain: string): Promise<boolean> {
    return this.federation.removeFromFederationBlacklist(domain)
  }

  // ==================== Registration Token Management ====================

  async getRegistrationTokens(): Promise<RegistrationToken[]> {
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
