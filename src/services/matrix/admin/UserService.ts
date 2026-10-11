import type { MatrixClient } from 'matrix-js-sdk'
import type {
  AdminAccountDetails,
  BatchCreateUsersRequest,
  BatchDeactivateUsersRequest,
  DeviceInfo
} from 'matrix-js-sdk/admin'
import { isNonEmptyString, isValidMatrixUserId } from '@/utils/inputValidation'
import { createLogger } from '@/utils/Logger'
import type { RateLimit, ShadowBanStatus, UserDevice, UserInfo } from './AdminTypes'

const logger = createLogger('UserService')

type UserDomainClientGetter = () => MatrixClient
type UserDomainSdkGetter = () => Promise<import('matrix-js-sdk/admin').AdminManager>

/** synapse-rust 扩展：getUserRooms 返回的房间对象（SDK 类型为 string[]） */
interface SynapseUserRoom {
  room_id?: string
  membership?: string
  is_room_admin?: boolean
}

export class AdminUserService {
  /** 非管理员用户的正常业务流标记，各方法 catch 中统一识别并降级为 debug */
  private static readonly PERMISSION_DENIED_MSG = 'ADMIN_PERMISSION_DENIED'

  constructor(
    private readonly sdkAdmin: UserDomainSdkGetter,
    private readonly getClient: UserDomainClientGetter
  ) {}

  /** 判断错误是否为非管理员权限拒绝（正常业务流，非异常） */
  private isPermissionDenied(err: unknown): boolean {
    return err instanceof Error && err.message === AdminUserService.PERMISSION_DENIED_MSG
  }

  async getUsers(
    limit = 100,
    from?: string,
    _name?: string,
    guests?: boolean
  ): Promise<{ users: UserInfo[]; nextToken?: string }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getUsersPaginated({ from, limit })
      const users = (result?.items ?? []).map((user) => this.mapUserInfo(user))
      const filteredUsers =
        typeof guests === 'boolean' ? users.filter((user) => Boolean(user.isGuest) === guests) : users
      return { users: filteredUsers, nextToken: result?.nextToken }
    } catch (err) {
      if (this.isPermissionDenied(err)) return { users: [] }
      logger.error(`[Admin] 获取用户列表失败: ${err}`)
      return { users: [] }
    }
  }

  async getUser(userId: string): Promise<UserInfo | null> {
    try {
      const admin = await this.sdkAdmin()
      const user = await admin.getUser(userId, false)
      return user ? this.mapUserInfo(user, userId) : null
    } catch (err) {
      if (this.isPermissionDenied(err)) return null
      logger.error(`[Admin] 获取用户信息失败: ${err}`)
      return null
    }
  }

  /**
   * 获取用户详情（getUser 的语义化别名）
   * 通过 SDK 的 getUserById 方法封装，消除裸调用 authedRequestWithPath。
   *
   * @param userId 目标用户 ID
   * @returns 用户信息或 null
   *
   * @see SDK 方法: AdminUserManager.getUserById(userId, throwOnError)
   *   - 走 synapse-rust `/v2/users/{id}` 路由的 upsert 语义
   */
  async getUserById(userId: string): Promise<UserInfo | null> {
    try {
      const admin = await this.sdkAdmin()
      const user = await admin.getUserById(userId, false)
      return user ? this.mapUserInfo(user, userId) : null
    } catch (err) {
      if (this.isPermissionDenied(err)) return null
      logger.error(`[Admin] 获取用户详情失败: ${err}`)
      return null
    }
  }

  async createUser(
    username: string,
    password: string,
    options?: { admin?: boolean; displayname?: string; deactivated?: boolean }
  ): Promise<UserInfo | null> {
    try {
      const admin = await this.sdkAdmin()
      const userId = `@${username}:${this.getClient().getDomain()}`
      const user = await admin.createUser(userId, {
        password,
        admin: options?.admin || false,
        displayname: options?.displayname,
        deactivated: options?.deactivated
      })
      logger.info(`[Admin] 用户已创建: ${username}`)
      return {
        userId: user?.name || username,
        name: username,
        admin: options?.admin,
        displayname: options?.displayname
      }
    } catch (err) {
      if (this.isPermissionDenied(err)) return null
      logger.error(`[Admin] 创建用户失败: ${err}`)
      return null
    }
  }

  async getRegistrationNonce(): Promise<string> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getRegisterNonce()
      return result?.nonce ?? ''
    } catch (err) {
      if (this.isPermissionDenied(err)) return ''
      logger.error(`[Admin] 获取注册 nonce 失败: ${err}`)
      return ''
    }
  }

  async adminRegister(
    username: string,
    password: string,
    nonce: string,
    admin = false,
    mac?: string
  ): Promise<{ accessToken: string; userId: string; deviceId: string } | null> {
    try {
      const adminMgr = await this.sdkAdmin()
      const result = await adminMgr.registerAdmin({
        username,
        password,
        nonce,
        admin,
        displayname: username,
        mac: mac ?? ''
      })
      logger.info(`[Admin] 管理员注册用户: ${username}`)
      return {
        accessToken: result?.access_token ?? '',
        userId: result?.user_id ?? '',
        deviceId: result?.device_id ?? ''
      }
    } catch (err) {
      if (this.isPermissionDenied(err)) return null
      logger.error(`[Admin] 管理员注册用户失败: ${err}`)
      return null
    }
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    if (!isValidMatrixUserId(userId)) throw new Error(`Invalid user ID: ${userId}`)
    if (!isNonEmptyString(newPassword)) throw new Error('Password cannot be empty')
    try {
      const admin = await this.sdkAdmin()
      await admin.resetPassword(userId, newPassword)
      logger.info(`[Admin] 密码已重置: ${userId}`)
    } catch (err) {
      if (this.isPermissionDenied(err)) return
      logger.error(`[Admin] 重置密码失败: ${err}`)
      throw err
    }
  }

  async setAdmin(userId: string, isAdmin: boolean): Promise<void> {
    if (!isValidMatrixUserId(userId)) throw new Error(`Invalid user ID: ${userId}`)
    try {
      const admin = await this.sdkAdmin()
      await admin.setAdmin(userId, isAdmin)
      logger.info(`[Admin] 管理员权限已${isAdmin ? '授予' : '撤销'}: ${userId}`)
    } catch (err) {
      if (this.isPermissionDenied(err)) return
      logger.error(`[Admin] 设置管理员权限失败: ${err}`)
      throw err
    }
  }

  async deactivateUser(userId: string): Promise<void> {
    if (!isValidMatrixUserId(userId)) throw new Error(`Invalid user ID: ${userId}`)
    try {
      const admin = await this.sdkAdmin()
      await admin.deactivateUser(userId)
      logger.info(`[Admin] 用户已停用: ${userId}`)
    } catch (err) {
      if (this.isPermissionDenied(err)) return
      logger.error(`[Admin] 停用用户失败: ${err}`)
      throw err
    }
  }

  /**
   * 重新激活已停用的用户：调用 Synapse Admin v2 API 将 deactivated 置为 false。
   * @param userId 目标用户 ID
   *
   * S-14 已收口：改走 SDK `AdminUserManager.activateUser()`（同一 v2 PUT
   * `/_synapse/admin/v2/users/{id}` 路由），消除最后一个裸 `authedRequestWithPath`
   * 调用点；vendor tarball 已重打包并刷新 `meta/sdk-pin.json`（2026-09-11）。
   */
  async activateUser(userId: string): Promise<void> {
    if (!isValidMatrixUserId(userId)) throw new Error(`Invalid user ID: ${userId}`)
    try {
      const admin = await this.sdkAdmin()
      await admin.activateUser(userId)
      logger.info(`[Admin] 用户已激活: ${userId}`)
    } catch (err) {
      if (this.isPermissionDenied(err)) return
      logger.error(`[Admin] 激活用户失败: ${err}`)
      throw err
    }
  }

  async getUserDevices(userId: string): Promise<UserDevice[]> {
    try {
      const admin = await this.sdkAdmin()
      const devices = await admin.getUserDevices(userId)
      return (devices ?? []).map((device: DeviceInfo) => ({
        deviceId: device.device_id ?? '',
        displayName: device.display_name,
        lastSeenIp: device.last_seen_ip,
        lastSeenTs: device.last_seen_ts,
        userAgent: undefined
      }))
    } catch (err) {
      if (this.isPermissionDenied(err)) return []
      logger.error(`[Admin] 获取用户设备失败: ${err}`)
      return []
    }
  }

  async deleteUserDevice(userId: string, deviceId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteUserDevice(userId, deviceId)
      logger.info(`[Admin] 设备已删除: ${deviceId}`)
    } catch (err) {
      if (this.isPermissionDenied(err)) return
      logger.error(`[Admin] 删除设备失败: ${err}`)
      throw err
    }
  }

  async getRateLimit(userId: string): Promise<RateLimit | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getRateLimitOverride(userId, false)
      if (!result) return null
      return {
        messagesPerSecond: result.messages_per_second,
        burstCount: result.burst_count
      }
    } catch (err) {
      if (this.isPermissionDenied(err)) return null
      logger.error(`[Admin] 获取速率限制失败: ${err}`)
      return null
    }
  }

  /** 覆盖指定用户的速率限制
   */
  async overrideUserRateLimit(userId: string): Promise<void> {
    if (!isValidMatrixUserId(userId)) throw new Error(`Invalid user ID: ${userId}`)
    try {
      const admin = await this.sdkAdmin()
      await admin.overrideRateLimit(userId)
      logger.info(`[Admin] 用户速率限制已覆盖（禁用）: ${userId}`)
    } catch (err) {
      if (this.isPermissionDenied(err)) return
      logger.error(`[Admin] 覆盖速率限制失败: ${err}`)
      throw err
    }
  }

  async deleteRateLimit(userId: string): Promise<void> {
    if (!isValidMatrixUserId(userId)) throw new Error(`Invalid user ID: ${userId}`)
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteRateLimitOverride(userId)
      logger.info(`[Admin] 速率限制已删除: ${userId}`)
    } catch (err) {
      if (this.isPermissionDenied(err)) return
      logger.error(`[Admin] 删除速率限制失败: ${err}`)
      throw err
    }
  }

  async shadowBanUser(userId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.shadowBanUser(userId)
      logger.info(`[Admin] 用户已影子封禁: ${userId}`)
    } catch (err) {
      if (this.isPermissionDenied(err)) return
      logger.error(`[Admin] 影子封禁失败: ${err}`)
      throw err
    }
  }

  async unshadowBanUser(userId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.unshadowBanUser(userId)
      logger.info(`[Admin] 用户已解除影子封禁: ${userId}`)
    } catch (err) {
      if (this.isPermissionDenied(err)) return
      logger.error(`[Admin] 解除影子封禁失败: ${err}`)
      throw err
    }
  }

  async getShadowBanStatus(userId: string): Promise<ShadowBanStatus | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getShadowBanStatus(userId)
      if (!result) return null
      return {
        banned: result.banned ?? false,
        bannedAt: result.banned_at
      }
    } catch (err) {
      if (this.isPermissionDenied(err)) return null
      logger.error(`[Admin] 获取影子封禁状态失败: ${err}`)
      return null
    }
  }

  async getWhois(userId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.whois(userId)
      return result as unknown as Record<string, unknown> | null
    } catch (err) {
      if (this.isPermissionDenied(err)) return null
      logger.error(`[Admin] 获取 Whois 失败: ${err}`)
      return null
    }
  }

  async getUserRooms(userId: string): Promise<Array<{ roomId: string; membership: string; isRoomAdmin: boolean }>> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getUserRooms(userId)
      const rooms = (result?.joined_rooms ?? []) as Array<string | SynapseUserRoom>
      if (Array.isArray(rooms)) {
        return rooms.map((room) => {
          if (typeof room === 'string') {
            return { roomId: room, membership: '', isRoomAdmin: false }
          }
          return {
            roomId: room.room_id || '',
            membership: room.membership || '',
            isRoomAdmin: Boolean(room.is_room_admin)
          }
        })
      }
      return []
    } catch (err) {
      if (this.isPermissionDenied(err)) return []
      logger.error(`[Admin] 获取用户房间列表失败: ${err}`)
      return []
    }
  }

  async getUserStats(userId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getUserStats(userId)
      return (result as unknown as Record<string, unknown>) ?? null
    } catch (err) {
      if (this.isPermissionDenied(err)) return null
      logger.error(`[Admin] 获取用户统计失败: ${err}`)
      return null
    }
  }

  async getUserStatsList(
    _limit = 100,
    _from?: string
  ): Promise<{ stats: Array<Record<string, unknown>>; nextToken?: string }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.listUserStats()
      return {
        stats: [result as unknown as Record<string, unknown>],
        nextToken: undefined
      }
    } catch (err) {
      if (this.isPermissionDenied(err)) return { stats: [] }
      logger.error(`[Admin] 获取用户统计列表失败: ${err}`)
      return { stats: [] }
    }
  }

  async batchCreateUsers(
    users: Array<{
      username: string
      password: string
      displayname?: string
      admin?: boolean
    }>
  ): Promise<Array<{ userId: string; success: boolean }>> {
    try {
      const admin = await this.sdkAdmin()
      const payload: BatchCreateUsersRequest = {
        users: users.map((user) => ({
          username: user.username,
          password: user.password,
          displayname: user.displayname,
          admin: user.admin || false
        }))
      }
      const result = await admin.batchCreateUsers(payload)
      logger.info(`[Admin] 批量创建用户: ${users.length}个`)
      const created = (result?.created ?? []).map((userId) => ({ userId, success: true }))
      const errors = (result?.failed ?? []).map((userId) => ({ userId, success: false }))
      return [...created, ...errors]
    } catch (err) {
      if (this.isPermissionDenied(err)) return []
      logger.error(`[Admin] 批量创建用户失败: ${err}`)
      return []
    }
  }

  async batchDeactivateUsers(userIds: string[], erase = false): Promise<Array<{ userId: string; success: boolean }>> {
    try {
      const admin = await this.sdkAdmin()
      const payload: BatchDeactivateUsersRequest = { users: userIds, erase }
      const result = await admin.batchDeactivateUsers(payload)
      logger.info(`[Admin] 批量停用用户: ${userIds.length}个`)
      const deactivated = (result?.deactivated ?? []).map((userId) => ({ userId, success: true }))
      const errors = (result?.failed ?? []).map((userId) => ({ userId, success: false }))
      return [...deactivated, ...errors]
    } catch (err) {
      if (this.isPermissionDenied(err)) return []
      logger.error(`[Admin] 批量停用用户失败: ${err}`)
      return []
    }
  }

  async evictUser(userId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.evictUser(userId)
      logger.info(`[Admin] 用户已从全部房间逐出: ${userId}`)
    } catch (err) {
      if (this.isPermissionDenied(err)) return
      logger.error(`[Admin] 逐出用户失败: ${err}`)
      throw err
    }
  }

  async loginUserAs(userId: string): Promise<{ accessToken: string; deviceId: string } | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.loginAsUser(userId)
      logger.info(`[Admin] 以用户身份登录: ${userId}`)
      return {
        accessToken: result?.access_token ?? '',
        deviceId: result?.device_id ?? ''
      }
    } catch (err) {
      if (this.isPermissionDenied(err)) return null
      logger.error(`[Admin] 以用户身份登录失败: ${err}`)
      return null
    }
  }

  async logoutUserAll(userId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.logoutUser(userId)
      logger.info(`[Admin] 登出用户全部设备: ${userId}`)
    } catch (err) {
      if (this.isPermissionDenied(err)) return
      logger.error(`[Admin] 登出用户全部设备失败: ${err}`)
      throw err
    }
  }

  async getUserSessions(userId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getUserSession(userId)
      return [result as unknown as Record<string, unknown>]
    } catch (err) {
      if (this.isPermissionDenied(err)) return []
      logger.error(`[Admin] 获取用户会话失败: ${err}`)
      return []
    }
  }

  async invalidateUserSession(userId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.invalidateUserSession(userId)
      logger.info(`[Admin] 用户会话已失效: ${userId}`)
    } catch (err) {
      if (this.isPermissionDenied(err)) return
      logger.error(`[Admin] 失效用户会话失败: ${err}`)
      throw err
    }
  }

  async getAccountInfo(userId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getAccountDetails(userId)
      return (result as unknown as Record<string, unknown>) ?? null
    } catch (err) {
      if (this.isPermissionDenied(err)) return null
      logger.error(`[Admin] 获取账户详情失败: ${err}`)
      return null
    }
  }

  async updateAccountInfo(userId: string, updates: Record<string, unknown>): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.updateAccountDetails(
        userId,
        updates as { displayname?: string; avatar_url?: string; admin?: boolean }
      )
      logger.info(`[Admin] 更新账户详情: ${userId}`)
    } catch (err) {
      if (this.isPermissionDenied(err)) return
      logger.error(`[Admin] 更新账户详情失败: ${err}`)
      throw err
    }
  }

  async checkUserAdmin(userId: string): Promise<boolean> {
    try {
      const admin = await this.sdkAdmin()
      return (await admin.isAdmin(userId, false)) ?? false
    } catch (err) {
      if (this.isPermissionDenied(err)) return false
      logger.error(`[Admin] 检查管理员状态失败: ${err}`)
      return false
    }
  }

  async getAccountStatus(userId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getAccountStatus(userId)
      return (result as unknown as Record<string, unknown>) ?? null
    } catch (err) {
      if (this.isPermissionDenied(err)) return null
      logger.error(`[Admin] 获取账户状态失败: ${err}`)
      return null
    }
  }

  async getLoginFailures(
    limit = 50,
    from?: string
  ): Promise<{
    failures: Array<Record<string, unknown>>
    nextToken?: string
  }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.listLoginFailures({ limit, from })
      return {
        failures: result?.failures ?? [],
        nextToken: result?.next_token
      }
    } catch (err) {
      if (this.isPermissionDenied(err)) return { failures: [] }
      logger.error(`[Admin] 获取登录失败记录失败: ${err}`)
      return { failures: [] }
    }
  }

  private mapUserInfo(user: AdminAccountDetails, fallbackUserId = ''): UserInfo {
    return {
      userId: user.name || user.user_id || fallbackUserId,
      name: user.name,
      avatarUrl: user.avatar_url,
      admin: user.admin,
      deactivated: user.deactivated,
      isGuest: user.is_guest,
      createdTs: user.created_ts,
      displayname: user.displayname
    }
  }
}
