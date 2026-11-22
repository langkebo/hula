import type { MatrixClient } from 'matrix-js-sdk'
import type {
  AdminAccountDetails,
  BatchCreateUsersRequest,
  BatchDeactivateUsersRequest,
  DeviceInfo
} from 'matrix-js-sdk/admin'
import { DEFAULT_PAGE_LIMIT, LARGE_PAGE_LIMIT } from '@/common/constants'
import { isNonEmptyString, isValidMatrixUserId } from '@/utils/inputValidation'
import { createLogger } from '@/utils/Logger'
import type {
  AdminAccountInfo,
  AdminAccountInfoUpdate,
  AdminAccountStatusInfo,
  AdminLoginFailure,
  AdminUserSession,
  AdminUserStats,
  AdminUserStatsOverview,
  AdminWhoisInfo,
  ShadowBanStatus,
  UserDevice,
  UserInfo
} from './AdminTypes'
import { isAdminPermissionDenied } from './adminPermissionGuard'
import { UserRateLimitMethods } from './UserRateLimitMethods'

const logger = createLogger('UserService')

type UserDomainClientGetter = () => MatrixClient
type UserDomainSdkGetter = () => Promise<import('matrix-js-sdk/admin').AdminManager>

/** synapse-rust 扩展：getUserRooms 返回的房间对象（SDK 类型为 string[]） */
interface SynapseUserRoom {
  room_id?: string
  membership?: string
  is_room_admin?: boolean
}

export class AdminUserService extends UserRateLimitMethods {
  protected readonly sdkAdmin: UserDomainSdkGetter
  private readonly getClient: UserDomainClientGetter

  constructor(sdkAdmin: UserDomainSdkGetter, getClient: UserDomainClientGetter) {
    super()
    this.sdkAdmin = sdkAdmin
    this.getClient = getClient
  }

  /** 判断错误是否为非管理员权限拒绝（正常业务流，非异常） */
  private isPermissionDenied(err: unknown): boolean {
    return isAdminPermissionDenied(err)
  }

  async getUsers(
    limit = LARGE_PAGE_LIMIT,
    from?: string,
    guests?: boolean
  ): Promise<{ users: UserInfo[]; nextToken?: string | undefined; failed?: boolean }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getUsersPaginated({ limit, ...(from !== undefined ? { from } : {}) })
      const users = (result?.items ?? []).map((user) => this.mapUserInfo(user))
      const filteredUsers =
        typeof guests === 'boolean' ? users.filter((user) => Boolean(user.isGuest) === guests) : users
      return { users: filteredUsers, nextToken: result?.nextToken }
    } catch (err) {
      // failed 用于让调用方区分「请求失败」与「确实为空」，避免把错误伪装成空列表
      if (this.isPermissionDenied(err)) return { users: [], failed: true }
      logger.error(`[Admin] 获取用户列表失败: ${err}`)
      return { users: [], failed: true }
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
        ...(options?.displayname !== undefined ? { displayname: options.displayname } : {}),
        ...(options?.deactivated !== undefined ? { deactivated: options.deactivated } : {})
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
      // 后端 GET /users/{user_id}/shadow_ban 只返回 { shadow_banned }，没有封禁时间
      return {
        banned: result.shadow_banned ?? false
      }
    } catch (err) {
      if (this.isPermissionDenied(err)) return null
      logger.error(`[Admin] 获取影子封禁状态失败: ${err}`)
      return null
    }
  }

  async getWhois(userId: string): Promise<AdminWhoisInfo | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.whois(userId)
      return { ...result }
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

  async getUserStats(userId: string): Promise<AdminUserStats | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getUserStats(userId)
      return { ...result }
    } catch (err) {
      if (this.isPermissionDenied(err)) return null
      logger.error(`[Admin] 获取用户统计失败: ${err}`)
      return null
    }
  }

  /** 获取用户统计列表。 */
  async getUserStatsList(): Promise<{
    stats: AdminUserStatsOverview[]
    nextToken?: string | undefined
  }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.listUserStats()
      return {
        stats: [{ ...result }],
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
          ...(user.displayname !== undefined ? { displayname: user.displayname } : {}),
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

  async getUserSessions(userId: string): Promise<AdminUserSession[]> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getUserSession(userId)
      // SDK 返回的是 `{ user_id, sessions, total }` 信封，取其中的 sessions 数组
      return result.sessions ?? []
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

  async getAccountInfo(userId: string): Promise<AdminAccountInfo | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getAccountDetails(userId)
      return (result as AdminAccountInfo) ?? null
    } catch (err) {
      if (this.isPermissionDenied(err)) return null
      logger.error(`[Admin] 获取账户详情失败: ${err}`)
      return null
    }
  }

  async updateAccountInfo(userId: string, updates: AdminAccountInfoUpdate): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.updateAccountDetails(userId, updates)
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

  async getAccountStatus(userId: string): Promise<AdminAccountStatusInfo | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getAccountStatus(userId)
      return { ...result }
    } catch (err) {
      if (this.isPermissionDenied(err)) return null
      logger.error(`[Admin] 获取账户状态失败: ${err}`)
      return null
    }
  }

  async getLoginFailures(
    limit = DEFAULT_PAGE_LIMIT,
    from?: string
  ): Promise<{
    failures: AdminLoginFailure[]
    nextToken?: string | undefined
  }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.listLoginFailures({ limit, ...(from !== undefined ? { from } : {}) })
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
      createdTs: user.creation_ts ?? user.created_ts, // 后端键名并存：用户主查询用 creation_ts，另几处 created_ts
      displayname: user.displayname
    }
  }
}
