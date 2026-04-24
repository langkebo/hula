import type { MatrixClient } from 'matrix-js-sdk'
import matrixClientService from '../MatrixClientService'
import { info, error, warn } from '@tauri-apps/plugin-log'
import { invoke } from '@tauri-apps/api/core'
import { TauriCommand } from '@/enums'
import { isValidMatrixUserId, isValidMatrixRoomId, isNonEmptyString } from '@/utils/inputValidation'
import { AdminRegistrationTokensService } from './RegistrationTokensService'

export interface ServerStats {
  roomCount: number
  userCount: number
  dailyActiveUsers: number
  monthlyActiveUsers: number
  messageCount: number
  startServerTime: number
}

export interface ServerStatus {
  status: string
  uptime?: number
}

export interface ServerHealth {
  healthy: boolean
  checks?: Record<string, unknown>
}

export interface ServerInfo {
  serverName?: string
  version?: string
  federationEnabled?: boolean
}

export interface ServerVersion {
  serverVersion: string
  pythonVersion?: string
}

export interface UserInfo {
  userId: string
  name?: string
  avatarUrl?: string
  admin?: boolean
  deactivated?: boolean
  displayname?: string
  lastSeenTs?: number
}

export interface UserDevice {
  deviceId: string
  displayName?: string
  lastSeenIp?: string
  lastSeenTs?: number
  userAgent?: string
}

export interface RateLimit {
  messagesPerSecond?: number
  burstCount?: number
}

export interface ShadowBanStatus {
  banned: boolean
  bannedAt?: number
}

export interface RoomInfo {
  roomId: string
  name?: string
  topic?: string
  joinedMembers: number
  joinedLocalMembers: number
  invitedMembers: number
  invitedLocalMembers: number
  createTime?: number
  creator?: string
  public?: boolean
}

export interface RoomState {
  state: Array<{ type: string; stateKey: string; content: Record<string, unknown> }>
}

export interface ShutdownRoomResult {
  kickedUsers: string[]
  failedToKickUsers: string[]
  localAliases: string[]
}

export interface FederationDestination {
  destination: string
  retryLastTs?: number
  retryInterval?: number
  failureTs?: number
  lastSuccessfulStreamOrdering?: number
}

export interface FederationBlacklistEntry {
  serverName: string
  reason?: string
}

export interface ServerNoticeResult {
  eventId?: string
}

export interface ServerNoticeInfo {
  userId: string
  sentTs?: number
  content?: Record<string, unknown>
}

export interface RegistrationToken {
  token: string
  usesAllowed?: number
  pending: number
  completed: number
  expiryTime?: number
}

class AdminService {
  private adminVerifiedAt = 0
  private readonly ADMIN_VERIFY_INTERVAL = 2 * 60 * 1000
  private cachedAdminStatus = false

  readonly registrationTokens = new AdminRegistrationTokensService(() => this.sdkAdmin())

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
      error(`[Admin] 获取统计失败: ${err}`)
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
      return { status: result.up ? 'up' : 'down', uptime: result.uptime as number | undefined }
    } catch (err) {
      error(`[Admin] 获取服务器状态失败: ${err}`)
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
      return {
        healthy: (result.healthy as boolean | undefined) ?? true,
        checks: result.checks as Record<string, unknown> | undefined
      }
    } catch (err) {
      error(`[Admin] 获取服务器健康状态失败: ${err}`)
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
      error(`[Admin] 获取服务器版本失败: ${err}`)
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
      error(`[Admin] 获取服务器配置失败: ${err}`)
      return null
    }
  }

  // ==================== User Management ====================

  async getUsers(
    limit = 100,
    from?: string,
    name?: string,
    _guests = true
  ): Promise<{ users: UserInfo[]; nextToken?: string }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getUsersPaginated(options: { from?: string; limit?: number; name?: string }): Promise<{
          items?: Array<Record<string, unknown>>
          nextToken?: string
        }>
      }
      const result = await admin.getUsersPaginated({ from, limit, name })
      const users: UserInfo[] = (result?.items ?? []).map((u: Record<string, unknown>) => ({
        userId: (u.name as string) || (u.user_id as string) || '',
        name: u.name as string | undefined,
        avatarUrl: u.avatar_url as string | undefined,
        admin: Boolean(u.admin),
        deactivated: Boolean(u.deactivated),
        displayname: u.displayname as string | undefined,
        lastSeenTs: u.last_seen_ts as number | undefined
      }))
      return { users, nextToken: result?.nextToken }
    } catch (err) {
      error(`[Admin] 获取用户列表失败: ${err}`)
      return { users: [] }
    }
  }

  async getUser(userId: string): Promise<UserInfo | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getUser(userId: string, throwOnError?: boolean): Promise<Record<string, unknown> | null>
      }
      const user = await admin.getUser(userId, false)
      if (!user) return null
      return {
        userId: (user.name as string) || (user.user_id as string) || userId,
        name: user.name as string | undefined,
        avatarUrl: user.avatar_url as string | undefined,
        admin: user.admin as boolean | undefined,
        deactivated: user.deactivated as boolean | undefined,
        displayname: user.displayname as string | undefined,
        lastSeenTs: user.last_seen_ts as number | undefined
      }
    } catch (err) {
      error(`[Admin] 获取用户信息失败: ${err}`)
      return null
    }
  }

  async createUser(
    username: string,
    password: string,
    options?: { admin?: boolean; displayname?: string; deactivated?: boolean }
  ): Promise<UserInfo | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        createUser(
          userId: string,
          options?: { password?: string; displayname?: string; admin?: boolean; deactivated?: boolean }
        ): Promise<Record<string, unknown>>
      }
      const userId = `@${username}:${this.getClient().getDomain()}`
      const user = await admin.createUser(userId, {
        password,
        admin: options?.admin || false,
        displayname: options?.displayname,
        deactivated: options?.deactivated
      })
      info(`[Admin] 用户已创建: ${username}`)
      return {
        userId: (user?.name as string) || username,
        name: username,
        admin: options?.admin,
        displayname: options?.displayname
      }
    } catch (err) {
      error(`[Admin] 创建用户失败: ${err}`)
      return null
    }
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    if (!isValidMatrixUserId(userId)) throw new Error(`Invalid user ID: ${userId}`)
    if (!isNonEmptyString(newPassword)) throw new Error('Password cannot be empty')
    try {
      const admin = await this.sdkAdmin()
      await admin.resetPassword(userId, newPassword)
      info(`[Admin] 密码已重置: ${userId}`)
    } catch (err) {
      error(`[Admin] 重置密码失败: ${err}`)
      throw err
    }
  }

  async setAdmin(userId: string, isAdmin: boolean): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.setAdmin(userId, isAdmin)
      info(`[Admin] 管理员权限已${isAdmin ? '授予' : '撤销'}: ${userId}`)
    } catch (err) {
      error(`[Admin] 设置管理员权限失败: ${err}`)
      throw err
    }
  }

  async deactivateUser(userId: string): Promise<void> {
    if (!isValidMatrixUserId(userId)) throw new Error(`Invalid user ID: ${userId}`)
    try {
      const admin = await this.sdkAdmin()
      await admin.deactivateUser(userId)
      info(`[Admin] 用户已停用: ${userId}`)
    } catch (err) {
      error(`[Admin] 停用用户失败: ${err}`)
      throw err
    }
  }

  async getUserDevices(userId: string): Promise<UserDevice[]> {
    try {
      const admin = await this.sdkAdmin()
      const devices = await admin.getUserDevices(userId)
      return (devices ?? []).map((d) => ({
        deviceId: d.device_id,
        displayName: d.display_name,
        lastSeenIp: d.last_seen_ip,
        lastSeenTs: d.last_seen_ts,
        userAgent: undefined as string | undefined
      }))
    } catch (err) {
      error(`[Admin] 获取用户设备失败: ${err}`)
      return []
    }
  }

  async deleteUserDevice(userId: string, deviceId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteUserDevice(userId, deviceId)
      info(`[Admin] 设备已删除: ${deviceId}`)
    } catch (err) {
      error(`[Admin] 删除设备失败: ${err}`)
      throw err
    }
  }

  async deleteUserDevices(userId: string, deviceIds: string[]): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteUserDevices(userId, deviceIds)
      info(`[Admin] 批量删除设备: ${deviceIds.length}个`)
    } catch (err) {
      error(`[Admin] 批量删除设备失败: ${err}`)
      throw err
    }
  }

  async getRateLimit(userId: string): Promise<RateLimit | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRateLimitOverride(userId: string, throwOnError?: boolean): Promise<Record<string, unknown> | null>
      }
      const result = await admin.getRateLimitOverride(userId, false)
      if (!result) return null
      return {
        messagesPerSecond: result.messages_per_second as number | undefined,
        burstCount: result.burst_count as number | undefined
      }
    } catch (err) {
      error(`[Admin] 获取速率限制失败: ${err}`)
      return null
    }
  }

  async setRateLimit(userId: string, _limit: RateLimit): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        overrideRateLimit(userId: string): Promise<void>
      }
      // SDK override 端点无 body，仅启用限速覆盖。具体阈值由后端默认处理。
      await admin.overrideRateLimit(userId)
      info(`[Admin] 速率限制已设置: ${userId}`)
    } catch (err) {
      error(`[Admin] 设置速率限制失败: ${err}`)
      throw err
    }
  }

  async deleteRateLimit(userId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        deleteRateLimitOverride(userId: string): Promise<void>
      }
      await admin.deleteRateLimitOverride(userId)
      info(`[Admin] 速率限制已删除: ${userId}`)
    } catch (err) {
      error(`[Admin] 删除速率限制失败: ${err}`)
      throw err
    }
  }

  async shadowBanUser(userId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.shadowBanUser(userId)
      info(`[Admin] 用户已影子封禁: ${userId}`)
    } catch (err) {
      error(`[Admin] 影子封禁失败: ${err}`)
      throw err
    }
  }

  async unshadowBanUser(userId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.unshadowBanUser(userId)
      info(`[Admin] 用户已解除影子封禁: ${userId}`)
    } catch (err) {
      error(`[Admin] 解除影子封禁失败: ${err}`)
      throw err
    }
  }

  async getShadowBanStatus(userId: string): Promise<ShadowBanStatus | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getShadowBanStatus(userId)
      if (!result) return null
      return {
        banned: (result as { banned?: boolean }).banned ?? false,
        bannedAt: (result as { banned_at?: number }).banned_at
      }
    } catch (err) {
      error(`[Admin] 获取影子封禁状态失败: ${err}`)
      return null
    }
  }

  async getWhois(userId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.whois(userId)
      return result as unknown as Record<string, unknown> | null
    } catch (err) {
      error(`[Admin] 获取 Whois 失败: ${err}`)
      return null
    }
  }

  // ==================== Room Management ====================

  async getRooms(limit = 100, from?: string, searchTerm?: string): Promise<{ rooms: RoomInfo[]; nextToken?: string }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getRooms(from, limit, searchTerm)
      const rooms: RoomInfo[] = (result.rooms ?? []).map((r) => ({
        roomId: r.room_id,
        name: r.name,
        topic: r.topic,
        joinedMembers: r.joined_members ?? 0,
        joinedLocalMembers: r.joined_local_members ?? 0,
        invitedMembers: r.invited_members ?? 0,
        invitedLocalMembers: 0,
        createTime: r.created_ts,
        creator: r.creator,
        public: r.public
      }))
      return { rooms, nextToken: result.next_token }
    } catch (err) {
      error(`[Admin] 获取房间列表失败: ${err}`)
      return { rooms: [] }
    }
  }

  async getRoom(roomId: string): Promise<RoomInfo | null> {
    try {
      const admin = await this.sdkAdmin()
      const room = await admin.getRoom(roomId, false)
      if (!room) return null
      return {
        roomId: room.room_id || roomId,
        name: room.name,
        topic: room.topic,
        joinedMembers: room.joined_members ?? 0,
        joinedLocalMembers: room.joined_local_members ?? 0,
        invitedMembers: room.invited_members ?? 0,
        invitedLocalMembers: 0,
        createTime: room.created_ts,
        creator: room.creator,
        public: room.public
      }
    } catch (err) {
      error(`[Admin] 获取房间详情失败: ${err}`)
      return null
    }
  }

  async getRoomMembers(roomId: string): Promise<string[]> {
    try {
      const admin = await this.sdkAdmin()
      return (await admin.getRoomMembers(roomId)) ?? []
    } catch (err) {
      error(`[Admin] 获取房间成员失败: ${err}`)
      return []
    }
  }

  async getRoomState(roomId: string): Promise<RoomState | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getRoomState(roomId)
      return {
        state: ((result?.state ?? []) as unknown as Array<Record<string, unknown>>).map((e) => ({
          type: (e.type as string) ?? '',
          stateKey: (e.state_key as string) ?? '',
          content: (e.content as Record<string, unknown>) ?? {}
        }))
      }
    } catch (err) {
      error(`[Admin] 获取房间状态失败: ${err}`)
      return null
    }
  }

  async deleteRoom(roomId: string, options?: { purge?: boolean }): Promise<void> {
    if (!isValidMatrixRoomId(roomId)) throw new Error(`Invalid room ID: ${roomId}`)
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteRoom(roomId, options)
      info(`[Admin] 房间已删除: ${roomId}`)
    } catch (err) {
      error(`[Admin] 删除房间失败: ${err}`)
      throw err
    }
  }

  async blockRoom(roomId: string, block: boolean): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.blockRoom(roomId, block)
      info(`[Admin] 房间${block ? '已封禁' : '已解封'}: ${roomId}`)
    } catch (err) {
      error(`[Admin] 封禁房间失败: ${err}`)
      throw err
    }
  }

  async shutdownRoom(roomId: string, _message?: string): Promise<ShutdownRoomResult> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.shutdownRoom(roomId)
      info(`[Admin] 房间已关闭: ${roomId}`)
      return {
        kickedUsers: result?.kicked_users ?? [],
        failedToKickUsers: result?.failed_to_kick_users ?? [],
        localAliases: []
      }
    } catch (err) {
      error(`[Admin] 关闭房间失败: ${err}`)
      throw err
    }
  }

  async forceJoinRoom(roomId: string, userId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.forceJoinRoom(roomId, userId)
      info(`[Admin] 强制加入房间: ${userId} -> ${roomId}`)
    } catch (err) {
      error(`[Admin] 强制加入房间失败: ${err}`)
      throw err
    }
  }

  async forceLeaveRoom(roomId: string, userId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.forceLeaveRoom(roomId, userId)
      info(`[Admin] 强制离开房间: ${userId} <- ${roomId}`)
    } catch (err) {
      error(`[Admin] 强制离开房间失败: ${err}`)
      throw err
    }
  }

  async kickUser(roomId: string, userId: string, reason?: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.kick(roomId, userId, reason)
      info(`[Admin] 用户已踢出房间: ${userId} ${roomId}`)
    } catch (err) {
      error(`[Admin] 踢出用户失败: ${err}`)
      throw err
    }
  }

  async banUser(roomId: string, userId: string, reason?: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.ban(roomId, userId, reason)
      info(`[Admin] 用户已封禁: ${userId} ${roomId}`)
    } catch (err) {
      error(`[Admin] 封禁用户失败: ${err}`)
      throw err
    }
  }

  async unbanUser(roomId: string, userId: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.unban(roomId, userId)
      info(`[Admin] 用户已解除封禁: ${userId} ${roomId}`)
    } catch (err) {
      error(`[Admin] 解除封禁失败: ${err}`)
      throw err
    }
  }

  // ==================== Federation Management ====================

  async getFederationDestinations(): Promise<FederationDestination[]> {
    try {
      const admin = await this.sdkAdmin()
      const destinations = await admin.getFederationDestinations()
      return (destinations ?? []).map((d) => ({
        destination: d.destination,
        retryLastTs: d.retry_last_ts,
        retryInterval: d.retry_interval,
        failureTs: d.failure_ts,
        lastSuccessfulStreamOrdering: d.last_successful_stream_ordering
      }))
    } catch (err) {
      error(`[Admin] 获取联邦目的地失败: ${err}`)
      return []
    }
  }

  async getFederationDestination(destination: string): Promise<FederationDestination | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getFederationDestination(destination)
      if (!result) return null
      return {
        destination: result.destination || destination,
        retryLastTs: result.retry_last_ts,
        retryInterval: result.retry_interval,
        failureTs: result.failure_ts,
        lastSuccessfulStreamOrdering: result.last_successful_stream_ordering
      }
    } catch (err) {
      error(`[Admin] 获取联邦目的地详情失败: ${err}`)
      return null
    }
  }

  async resetFederationConnection(destination: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.resetFederationConnection(destination)
      info(`[Admin] 联邦连接已重置: ${destination}`)
    } catch (err) {
      error(`[Admin] 重置联邦连接失败: ${err}`)
      throw err
    }
  }

  // ==================== Notification Management ====================

  async sendServerNotice(userId: string, content: Record<string, unknown>): Promise<ServerNoticeResult> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        sendServerNotice(
          userId: string,
          content: { msgtype?: string; body: string; [key: string]: unknown }
        ): Promise<{ event_id?: string }>
      }
      const result = await admin.sendServerNotice(userId, content as { body: string; [key: string]: unknown })
      info(`[Admin] 服务器通知已发送: ${userId}`)
      return { eventId: result?.event_id }
    } catch (err) {
      error(`[Admin] 发送服务器通知失败: ${err}`)
      throw err
    }
  }

  async getServerNotices(limit = 50): Promise<{ notices: ServerNoticeInfo[] } | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getServerNotices(
          limit?: number,
          from?: string,
          throwOnError?: boolean
        ): Promise<{ notices?: Array<Record<string, unknown>> } | null>
      }
      const result = await admin.getServerNotices(limit, undefined, false)
      if (!result) return null
      return {
        notices: (result.notices ?? []).map((n: Record<string, unknown>) => ({
          userId: (n.user_id as string) || '',
          sentTs: n.sent_ts as number | undefined,
          content: n.content as Record<string, unknown> | undefined
        }))
      }
    } catch (err) {
      error(`[Admin] 获取服务器通知失败: ${err}`)
      return null
    }
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

  // ==================== Media Management ====================

  async getMediaList(
    limit = 100,
    from?: string,
    _orderBy?: string,
    _search?: string
  ): Promise<{
    media: Array<{
      mediaId: string
      mediaType: string
      contentUri: string
      createdAt: number
      uploadName?: string
      mediaLength?: number
    }>
    nextToken?: string
  }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getMedia(limit, from)
      return {
        media: (result?.media ?? []).map((m) => ({
          mediaId: m.media_id ?? '',
          mediaType: (m as unknown as { media_type?: string }).media_type ?? '',
          contentUri: (m as unknown as { content_uri?: string }).content_uri ?? '',
          createdAt: m.created_ts ?? 0,
          uploadName: (m as unknown as { upload_name?: string }).upload_name,
          mediaLength: (m as unknown as { media_length?: number }).media_length
        })),
        nextToken: result?.next_token
      }
    } catch (err) {
      error(`[Admin] 获取媒体列表失败: ${err}`)
      return { media: [] }
    }
  }

  async deleteMedia(mediaId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteMedia(mediaId)
      info(`[Admin] 媒体已删除: ${mediaId}`)
    } catch (err) {
      error(`[Admin] 删除媒体失败: ${err}`)
      throw err
    }
  }

  async purgeRemoteMedia(beforeTs: number, includeProfiles: boolean = false): Promise<{ deleted: number }> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixAdmin] 客户端未初始化')
    }

    try {
      const result = await client.http.authedRequest('POST', '/_matrix/client/v1/admin/purge_remote_media', undefined, {
        before_ts: beforeTs,
        include_profiles: includeProfiles
      })
      info(`[MatrixAdmin] 清理远程媒体成功: ${(result as { deleted?: number }).deleted ?? 0} 个`)
      return { deleted: (result as { deleted?: number }).deleted ?? 0 }
    } catch (err) {
      error(`[MatrixAdmin] 清理远程媒体失败: ${err}`)
      throw err
    }
  }

  async adminGetSpaces(
    limit: number = 50,
    from?: string
  ): Promise<{
    spaces: Array<Record<string, unknown>>
    next_batch?: string
  }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        listSpaces(params: { limit?: number; from?: string }): Promise<{
          spaces?: Array<Record<string, unknown>>
          next_batch?: string
        }>
      }
      const result = await admin.listSpaces({ limit, from })
      return {
        spaces: result?.spaces ?? [],
        next_batch: result?.next_batch
      }
    } catch (err) {
      error(`[MatrixAdmin] 获取空间列表失败: ${err}`)
      return { spaces: [] }
    }
  }

  async adminDeleteSpace(spaceId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        deleteSpace(spaceId: string): Promise<unknown>
      }
      await admin.deleteSpace(spaceId)
      info(`[MatrixAdmin] 删除空间成功: ${spaceId}`)
    } catch (err) {
      error(`[MatrixAdmin] 删除空间失败: ${err}`)
      throw err
    }
  }

  async shadowBan(userId: string, ban: boolean = true): Promise<void> {
    try {
      if (ban) {
        await this.shadowBanUser(userId)
      } else {
        await this.unshadowBanUser(userId)
      }
      info(`[MatrixAdmin] 影子封禁${ban ? '启用' : '解除'}: ${userId}`)
    } catch (err) {
      error(`[MatrixAdmin] 影子封禁操作失败: ${err}`)
      throw err
    }
  }

  async getRateLimits(userId?: string): Promise<Record<string, unknown>> {
    try {
      if (userId) {
        const admin = (await this.sdkAdmin()) as unknown as {
          getRateLimitOverride(userId: string, throwOnError?: boolean): Promise<Record<string, unknown> | null>
        }
        return (await admin.getRateLimitOverride(userId, false)) ?? {}
      }
      return (await this.getServerConfig()) ?? {}
    } catch (err) {
      error(`[MatrixAdmin] 获取限速配置失败: ${err}`)
      return {}
    }
  }

  async setRateLimits(userId: string, _limits: Record<string, unknown>): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        overrideRateLimit(userId: string): Promise<void>
      }
      // SDK 的 overrideRateLimit 不接受具体阈值（后端端点本身无 body），
      // 这里仅启用覆盖。保留 `_limits` 参数以保持 API 兼容。
      await admin.overrideRateLimit(userId)
      info(`[MatrixAdmin] 设置限速配置成功: ${userId}`)
    } catch (err) {
      error(`[MatrixAdmin] 设置限速配置失败: ${err}`)
      throw err
    }
  }

  async getAuditLog(
    limit: number = 50,
    from?: string,
    userId?: string,
    eventType?: string
  ): Promise<{
    logs: Array<Record<string, unknown>>
    next_batch?: string
  }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        listAuditEvents(params: {
          actor_id?: string
          action?: string
          resource_type?: string
          resource_id?: string
          result?: string
          limit?: number
          from?: number
        }): Promise<{ events?: Array<Record<string, unknown>>; next_batch?: string }>
      }
      const params: {
        limit?: number
        from?: number
        actor_id?: string
        action?: string
      } = { limit }
      if (from !== undefined) {
        const n = Number(from)
        if (Number.isFinite(n)) params.from = n
      }
      if (userId) params.actor_id = userId
      if (eventType) params.action = eventType
      const result = await admin.listAuditEvents(params)
      return {
        logs: result?.events ?? [],
        next_batch: result?.next_batch
      }
    } catch (err) {
      error(`[MatrixAdmin] 获取审计日志失败: ${err}`)
      return { logs: [] }
    }
  }

  async getSamlConfig(): Promise<Record<string, unknown>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getSamlConfig(): Promise<Record<string, unknown>>
      }
      return (await admin.getSamlConfig()) ?? {}
    } catch (err) {
      error(`[MatrixAdmin] 获取 SAML 配置失败: ${err}`)
      return {}
    }
  }

  async updateSamlConfig(config: Record<string, unknown>): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        updateSamlConfig(config: Record<string, unknown>): Promise<void>
      }
      await admin.updateSamlConfig(config)
      info('[MatrixAdmin] 更新 SAML 配置成功')
    } catch (err) {
      error(`[MatrixAdmin] 更新 SAML 配置失败: ${err}`)
      throw err
    }
  }

  // ==================== v2 User Management ====================

  async getUsersV2(
    limit = 100,
    from?: string,
    name?: string,
    _guests = true
  ): Promise<{ users: UserInfo[]; nextToken?: string }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getUsersPaginated(options: { from?: string; limit?: number; name?: string }): Promise<{
          items?: Array<Record<string, unknown>>
          nextToken?: string
        }>
      }
      const result = await admin.getUsersPaginated({ from, limit, name })
      const users: UserInfo[] = (result?.items ?? []).map((u: Record<string, unknown>) => ({
        userId: (u.name as string) || (u.user_id as string) || '',
        name: u.name as string | undefined,
        avatarUrl: u.avatar_url as string | undefined,
        admin: Boolean(u.admin),
        deactivated: Boolean(u.deactivated),
        displayname: u.displayname as string | undefined,
        lastSeenTs: u.last_seen_ts as number | undefined
      }))
      return { users, nextToken: result?.nextToken }
    } catch (err) {
      error(`[Admin] 获取v2用户列表失败: ${err}`)
      return { users: [] }
    }
  }

  async getUserV2(userId: string): Promise<UserInfo | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getUser(userId: string, throwOnError?: boolean): Promise<Record<string, unknown> | null>
      }
      const user = await admin.getUser(userId, false)
      if (!user) return null
      return {
        userId: (user.name as string) || (user.user_id as string) || userId,
        name: user.name as string | undefined,
        avatarUrl: user.avatar_url as string | undefined,
        admin: user.admin as boolean | undefined,
        deactivated: user.deactivated as boolean | undefined,
        displayname: user.displayname as string | undefined,
        lastSeenTs: user.last_seen_ts as number | undefined
      }
    } catch (err) {
      error(`[Admin] 获取v2用户详情失败: ${err}`)
      return null
    }
  }

  async createUserV2(
    username: string,
    password: string,
    options?: { admin?: boolean; displayname?: string; deactivated?: boolean }
  ): Promise<UserInfo | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        createUser(
          userId: string,
          options?: { password?: string; displayname?: string; admin?: boolean; deactivated?: boolean }
        ): Promise<Record<string, unknown>>
      }
      const userId = `@${username}:${this.getClient().getDomain()}`
      const user = await admin.createUser(userId, {
        password,
        admin: options?.admin || false,
        displayname: options?.displayname,
        deactivated: options?.deactivated
      })
      info(`[Admin] v2用户已创建: ${username}`)
      return {
        userId: (user?.name as string) || username,
        name: username,
        admin: options?.admin,
        displayname: options?.displayname
      }
    } catch (err) {
      error(`[Admin] v2创建用户失败: ${err}`)
      return null
    }
  }

  // ==================== Extended User Management ====================

  async getUserRooms(userId: string): Promise<Array<{ roomId: string; membership: string; isRoomAdmin: boolean }>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getUserRooms(userId: string): Promise<{
          rooms?: Array<string | Record<string, unknown>>
        }>
      }
      const result = await admin.getUserRooms(userId)
      return (result?.rooms ?? []).map((r) => {
        // SDK 类型声明返回 `string[]`，但后端实际可能返回
        // `{room_id, membership, is_room_admin}` 对象；两种形态都兼容。
        if (typeof r === 'string') {
          return { roomId: r, membership: '', isRoomAdmin: false }
        }
        return {
          roomId: (r.room_id as string) || '',
          membership: (r.membership as string) || '',
          isRoomAdmin: Boolean(r.is_room_admin)
        }
      })
    } catch (err) {
      error(`[Admin] 获取用户房间列表失败: ${err}`)
      return []
    }
  }

  async getUserStats(userId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getUserStats(userId: string): Promise<Record<string, unknown>>
      }
      return (await admin.getUserStats(userId)) ?? null
    } catch (err) {
      error(`[Admin] 获取用户统计失败: ${err}`)
      return null
    }
  }

  async getUserStatsList(
    limit = 100,
    from?: string
  ): Promise<{ stats: Array<Record<string, unknown>>; nextToken?: string }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        listUserStats(params: { limit?: number; from?: string }): Promise<{
          user_stats?: Array<Record<string, unknown>>
          next_token?: string
        }>
      }
      const result = await admin.listUserStats({ limit, from })
      return {
        stats: result?.user_stats ?? [],
        nextToken: result?.next_token
      }
    } catch (err) {
      error(`[Admin] 获取用户统计列表失败: ${err}`)
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
      const admin = (await this.sdkAdmin()) as unknown as {
        batchCreateUsers(
          users: Array<{ username: string; password?: string; displayname?: string; admin?: boolean }>
        ): Promise<{
          results?: Array<{ user_id?: string; success?: boolean }>
          created?: string[]
          failed?: string[]
        }>
      }
      const result = await admin.batchCreateUsers(
        users.map((u) => ({
          username: u.username,
          password: u.password,
          displayname: u.displayname,
          admin: u.admin || false
        }))
      )
      info(`[Admin] 批量创建用户: ${users.length}个`)
      // SDK 类型声明为 `{created, failed, total}`，但后端实际返回 `{results}`。
      // 两种形态都兼容：优先 results，否则回退到 created/failed 合并。
      if (result?.results) {
        return result.results.map((r) => ({
          userId: r.user_id ?? '',
          success: Boolean(r.success)
        }))
      }
      const created = (result?.created ?? []).map((uid) => ({ userId: uid, success: true }))
      const failed = (result?.failed ?? []).map((uid) => ({ userId: uid, success: false }))
      return [...created, ...failed]
    } catch (err) {
      error(`[Admin] 批量创建用户失败: ${err}`)
      return []
    }
  }

  async batchDeactivateUsers(userIds: string[], erase = false): Promise<Array<{ userId: string; success: boolean }>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        batchDeactivateUsers(
          userIdsOrUsers: string[],
          erase?: boolean
        ): Promise<{
          results?: Array<{ user_id?: string; success?: boolean }>
          deactivated?: string[]
        }>
      }
      const result = await admin.batchDeactivateUsers(userIds, erase)
      info(`[Admin] 批量停用用户: ${userIds.length}个`)
      if (result?.results) {
        return result.results.map((r) => ({
          userId: r.user_id ?? '',
          success: Boolean(r.success)
        }))
      }
      return (result?.deactivated ?? []).map((uid) => ({ userId: uid, success: true }))
    } catch (err) {
      error(`[Admin] 批量停用用户失败: ${err}`)
      return []
    }
  }

  async evictUser(userId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        evictUser(userId: string): Promise<unknown>
      }
      await admin.evictUser(userId)
      info(`[Admin] 用户已从全部房间逐出: ${userId}`)
    } catch (err) {
      error(`[Admin] 逐出用户失败: ${err}`)
      throw err
    }
  }

  async loginUserAs(userId: string): Promise<{ accessToken: string; deviceId: string } | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        loginAsUser(userId: string): Promise<{ access_token?: string; device_id?: string }>
      }
      const result = await admin.loginAsUser(userId)
      info(`[Admin] 以用户身份登录: ${userId}`)
      return {
        accessToken: result?.access_token ?? '',
        deviceId: result?.device_id ?? ''
      }
    } catch (err) {
      error(`[Admin] 以用户身份登录失败: ${err}`)
      return null
    }
  }

  async logoutUserAll(userId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        logoutUserDevices(userId: string): Promise<unknown>
      }
      await admin.logoutUserDevices(userId)
      info(`[Admin] 登出用户全部设备: ${userId}`)
    } catch (err) {
      error(`[Admin] 登出用户全部设备失败: ${err}`)
      throw err
    }
  }

  async getUserSessions(userId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getUserSessions(userId: string): Promise<{ sessions?: Array<Record<string, unknown>> }>
      }
      const result = await admin.getUserSessions(userId)
      return result?.sessions ?? []
    } catch (err) {
      error(`[Admin] 获取用户会话失败: ${err}`)
      return []
    }
  }

  async invalidateUserSession(userId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        invalidateUserSessions(userId: string): Promise<unknown>
      }
      await admin.invalidateUserSessions(userId)
      info(`[Admin] 用户会话已失效: ${userId}`)
    } catch (err) {
      error(`[Admin] 失效用户会话失败: ${err}`)
      throw err
    }
  }

  async getAccountInfo(userId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getAccountDetails(userId: string, throwOnError?: boolean): Promise<Record<string, unknown> | null>
      }
      return (await admin.getAccountDetails(userId, false)) ?? null
    } catch (err) {
      error(`[Admin] 获取账户详情失败: ${err}`)
      return null
    }
  }

  async updateAccountInfo(userId: string, updates: Record<string, unknown>): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        updateAccount(
          userId: string,
          options: { displayname?: string; avatar_url?: string; admin?: boolean }
        ): Promise<unknown>
      }
      await admin.updateAccount(userId, updates as { displayname?: string; avatar_url?: string; admin?: boolean })
      info(`[Admin] 更新账户详情: ${userId}`)
    } catch (err) {
      error(`[Admin] 更新账户详情失败: ${err}`)
      throw err
    }
  }

  async checkUserAdmin(userId: string): Promise<boolean> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        isAdmin(userId: string, throwOnError?: boolean): Promise<boolean>
      }
      return (await admin.isAdmin(userId, false)) ?? false
    } catch (err) {
      error(`[Admin] 检查管理员状态失败: ${err}`)
      return false
    }
  }

  async setUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        setAdmin(userId: string, admin: boolean): Promise<void>
      }
      await admin.setAdmin(userId, isAdmin)
      info(`[Admin] 管理员权限已${isAdmin ? '授予' : '撤销'}: ${userId}`)
    } catch (err) {
      error(`[Admin] 设置管理员权限失败: ${err}`)
      throw err
    }
  }

  async deactivateUserV2(userId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        deactivateUser(userId: string): Promise<void>
      }
      await admin.deactivateUser(userId)
      info(`[Admin] v2停用用户: ${userId}`)
    } catch (err) {
      error(`[Admin] v2停用用户失败: ${err}`)
      throw err
    }
  }

  async resetPasswordV2(userId: string, newPassword: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        resetPassword(userId: string, newPassword: string): Promise<void>
      }
      await admin.resetPassword(userId, newPassword)
      info(`[Admin] v2重置密码: ${userId}`)
    } catch (err) {
      error(`[Admin] v2重置密码失败: ${err}`)
      throw err
    }
  }

  async getAccountStatus(userId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getAccountStatus(userId)
      return result as unknown as Record<string, unknown> | null
    } catch (err) {
      error(`[Admin] 获取账户状态失败: ${err}`)
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
      const admin = (await this.sdkAdmin()) as unknown as {
        listLoginFailures(params: { limit?: number; from?: string }): Promise<{
          failures?: Array<Record<string, unknown>>
          next_token?: string
        }>
      }
      const result = await admin.listLoginFailures({ limit, from })
      return {
        failures: result?.failures ?? [],
        nextToken: result?.next_token
      }
    } catch (err) {
      error(`[Admin] 获取登录失败记录失败: ${err}`)
      return { failures: [] }
    }
  }

  // ==================== Extended Room Management ====================

  async getRoomMessages(
    roomId: string,
    limit = 100,
    from?: string,
    dir: 'b' | 'f' = 'b'
  ): Promise<{
    chunk: Array<Record<string, unknown>>
    start?: string
    end?: string
  }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRoomMessages(
          roomId: string,
          options: { limit?: number; from?: string; dir?: 'f' | 'b' }
        ): Promise<{ chunk: Array<Record<string, unknown>>; start?: string; end?: string }>
      }
      const result = await admin.getRoomMessages(roomId, { limit, from, dir })
      return {
        chunk: result?.chunk ?? [],
        start: result?.start,
        end: result?.end
      }
    } catch (err) {
      error(`[Admin] 获取房间消息失败: ${err}`)
      return { chunk: [] }
    }
  }

  async getRoomAliases(roomId: string): Promise<string[]> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRoomAliases(roomId: string): Promise<{ aliases?: string[] }>
      }
      const result = await admin.getRoomAliases(roomId)
      return result?.aliases ?? []
    } catch (err) {
      error(`[Admin] 获取房间别名失败: ${err}`)
      return []
    }
  }

  async getRoomVersion(roomId: string): Promise<string | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRoomVersion(roomId: string, throwOnError?: boolean): Promise<{ room_version?: string } | null>
      }
      const result = await admin.getRoomVersion(roomId, false)
      return result?.room_version ?? null
    } catch (err) {
      error(`[Admin] 获取房间版本失败: ${err}`)
      return null
    }
  }

  async getRoomBlockStatus(roomId: string): Promise<boolean> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRoomBlockStatus(roomId: string): Promise<{ block?: boolean }>
      }
      const result = await admin.getRoomBlockStatus(roomId)
      return result?.block ?? false
    } catch (err) {
      error(`[Admin] 获取房间封禁状态失败: ${err}`)
      return false
    }
  }

  async unblockRoom(roomId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        unblockRoom(roomId: string): Promise<void>
      }
      await admin.unblockRoom(roomId)
      info(`[Admin] 房间已解封: ${roomId}`)
    } catch (err) {
      error(`[Admin] 解封房间失败: ${err}`)
      throw err
    }
  }

  async makeRoomAdmin(roomId: string, userId?: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        makeRoomAdmin(roomId: string, userId?: string): Promise<void>
      }
      await admin.makeRoomAdmin(roomId, userId)
      info(`[Admin] 设置房间管理员: ${roomId}`)
    } catch (err) {
      error(`[Admin] 设置房间管理员失败: ${err}`)
      throw err
    }
  }

  async purgeHistory(
    roomId: string,
    options?: { purgeUpToEventId?: string; purgeUpToTs?: number; deleteLocalEvents?: boolean }
  ): Promise<{ purgeId: string }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        purgeHistoryGlobal(
          roomId: string,
          options?: {
            purge_up_to_event_id?: string
            purge_up_to_ts?: number
            delete_local_events?: boolean
          }
        ): Promise<{ purge_id?: string }>
      }
      const sdkOpts: {
        purge_up_to_event_id?: string
        purge_up_to_ts?: number
        delete_local_events?: boolean
      } = {}
      if (options?.purgeUpToEventId !== undefined) sdkOpts.purge_up_to_event_id = options.purgeUpToEventId
      if (options?.purgeUpToTs !== undefined) sdkOpts.purge_up_to_ts = options.purgeUpToTs
      if (options?.deleteLocalEvents !== undefined) sdkOpts.delete_local_events = options.deleteLocalEvents
      const result = await admin.purgeHistoryGlobal(roomId, sdkOpts)
      info(`[Admin] 清理历史: ${roomId}`)
      return { purgeId: result?.purge_id ?? '' }
    } catch (err) {
      error(`[Admin] 清理历史失败: ${err}`)
      throw err
    }
  }

  async purgeRoom(roomId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        purgeRoom(roomId: string): Promise<unknown>
      }
      await admin.purgeRoom(roomId)
      info(`[Admin] 清空房间: ${roomId}`)
    } catch (err) {
      error(`[Admin] 清空房间失败: ${err}`)
      throw err
    }
  }

  async getRoomStats(
    limit = 100,
    from?: string
  ): Promise<{ stats: Array<Record<string, unknown>>; nextToken?: string }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        listRoomStats(params: { limit?: number; from?: string }): Promise<{
          room_stats?: Array<Record<string, unknown>>
          next_token?: string
        }>
      }
      const result = await admin.listRoomStats({ limit, from })
      return {
        stats: result?.room_stats ?? [],
        nextToken: result?.next_token
      }
    } catch (err) {
      error(`[Admin] 获取房间统计失败: ${err}`)
      return { stats: [] }
    }
  }

  async getSingleRoomStats(roomId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRoomStats(roomId: string, throwOnError?: boolean): Promise<Record<string, unknown> | null>
      }
      return (await admin.getRoomStats(roomId, false)) ?? null
    } catch (err) {
      error(`[Admin] 获取单房间统计失败: ${err}`)
      return null
    }
  }

  async getRoomListings(roomId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRoomListings(roomId: string): Promise<Record<string, unknown>>
      }
      return (await admin.getRoomListings(roomId)) ?? null
    } catch (err) {
      error(`[Admin] 获取房间公开列表项失败: ${err}`)
      return null
    }
  }

  async setRoomPublicListing(roomId: string, isPublic: boolean): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        setRoomPublicListing(roomId: string, isPublic: boolean): Promise<void>
      }
      await admin.setRoomPublicListing(roomId, isPublic)
      info(`[Admin] 房间公开列表已${isPublic ? '设置' : '移除'}: ${roomId}`)
    } catch (err) {
      error(`[Admin] 设置房间公开列表失败: ${err}`)
      throw err
    }
  }

  async getRoomEventContext(roomId: string, eventId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRoomEventContext(roomId: string, eventId: string): Promise<Record<string, unknown>>
      }
      return (await admin.getRoomEventContext(roomId, eventId)) ?? null
    } catch (err) {
      error(`[Admin] 获取事件上下文失败: ${err}`)
      return null
    }
  }

  async searchInRoom(
    roomId: string,
    searchTerm: string,
    limit = 50
  ): Promise<{
    results: Array<Record<string, unknown>>
    nextBatch?: string
  }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        searchInRoom(
          roomId: string,
          searchTerm: string,
          limit?: number
        ): Promise<{ results?: Array<Record<string, unknown>>; next_batch?: string }>
      }
      const result = await admin.searchInRoom(roomId, searchTerm, limit)
      return {
        results: result?.results ?? [],
        nextBatch: result?.next_batch
      }
    } catch (err) {
      error(`[Admin] 房间内搜索失败: ${err}`)
      return { results: [] }
    }
  }

  async searchRooms(
    searchTerm: string,
    limit = 50
  ): Promise<{
    rooms: Array<Record<string, unknown>>
    nextBatch?: string
  }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        searchRooms(
          searchTerm: string,
          limit?: number
        ): Promise<{ rooms?: Array<Record<string, unknown>>; next_batch?: string }>
      }
      const result = await admin.searchRooms(searchTerm, limit)
      return {
        rooms: result?.rooms ?? [],
        nextBatch: result?.next_batch
      }
    } catch (err) {
      error(`[Admin] 全局房间搜索失败: ${err}`)
      return { rooms: [] }
    }
  }

  async getRoomForwardExtremities(roomId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRoomForwardExtremities(roomId: string): Promise<{
          results?: Array<Record<string, unknown>>
          forward_extremities?: Array<Record<string, unknown>> | number
        }>
      }
      const result = await admin.getRoomForwardExtremities(roomId)
      // SDK 类型声明为 `{room_id, forward_extremities: number}` 但后端实际返回
      // `{results: [...]}`;做宽容兼容：两种形态都能解析成数组
      if (Array.isArray(result?.results)) return result.results
      if (Array.isArray(result?.forward_extremities)) return result.forward_extremities
      return []
    } catch (err) {
      error(`[Admin] 获取房间前向极值失败: ${err}`)
      return []
    }
  }

  async deleteRoomV2(
    roomId: string,
    options?: {
      purge?: boolean
      force?: boolean
      newRoomUserId?: string
      roomName?: string
      message?: string
      block?: boolean
    }
  ): Promise<{ kickedUsers: string[]; failedToKickUsers: string[]; localAliases: string[]; newRoomId?: string }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        deleteRoomV2(
          roomId: string,
          options?: {
            purge?: boolean
            force?: boolean
            new_room_user_id?: string
            room_name?: string
            message?: string
            block?: boolean
          }
        ): Promise<{
          kicked_users?: string[]
          failed_to_kick_users?: string[]
          local_aliases?: string[]
          new_room_id?: string
        }>
      }
      const sdkOpts: {
        purge?: boolean
        force?: boolean
        new_room_user_id?: string
        room_name?: string
        message?: string
        block?: boolean
      } = {}
      if (options?.purge !== undefined) sdkOpts.purge = options.purge
      if (options?.force !== undefined) sdkOpts.force = options.force
      if (options?.newRoomUserId !== undefined) sdkOpts.new_room_user_id = options.newRoomUserId
      if (options?.roomName !== undefined) sdkOpts.room_name = options.roomName
      if (options?.message !== undefined) sdkOpts.message = options.message
      if (options?.block !== undefined) sdkOpts.block = options.block
      const result = await admin.deleteRoomV2(roomId, sdkOpts)
      info(`[Admin] v2删除房间: ${roomId}`)
      return {
        kickedUsers: result?.kicked_users ?? [],
        failedToKickUsers: result?.failed_to_kick_users ?? [],
        localAliases: result?.local_aliases ?? [],
        newRoomId: result?.new_room_id
      }
    } catch (err) {
      error(`[Admin] v2删除房间失败: ${err}`)
      throw err
    }
  }

  // ==================== Space Management Extended ====================

  async getSpaceDetails(spaceId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getSpace(spaceId: string, throwOnError?: boolean): Promise<Record<string, unknown> | null>
      }
      return (await admin.getSpace(spaceId, false)) ?? null
    } catch (err) {
      error(`[Admin] 获取空间详情失败: ${err}`)
      return null
    }
  }

  async getSpaceUsers(spaceId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        listSpaceUsers(spaceId: string): Promise<{ users?: Array<Record<string, unknown>> }>
      }
      const result = await admin.listSpaceUsers(spaceId)
      return result?.users ?? []
    } catch (err) {
      error(`[Admin] 获取空间用户失败: ${err}`)
      return []
    }
  }

  async getSpaceRooms(spaceId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        listSpaceRooms(spaceId: string): Promise<{ rooms?: Array<Record<string, unknown>> }>
      }
      const result = await admin.listSpaceRooms(spaceId)
      return result?.rooms ?? []
    } catch (err) {
      error(`[Admin] 获取空间房间失败: ${err}`)
      return []
    }
  }

  async getSpaceStats(spaceId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getSpaceStats(spaceId: string): Promise<Record<string, unknown>>
      }
      return (await admin.getSpaceStats(spaceId)) ?? null
    } catch (err) {
      error(`[Admin] 获取空间统计失败: ${err}`)
      return null
    }
  }

  // ==================== Server Management Extended ====================

  async restartServer(): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        restartServer(): Promise<void>
      }
      await admin.restartServer()
      info('[Admin] 服务器重启已请求')
    } catch (err) {
      error(`[Admin] 重启服务器失败: ${err}`)
      throw err
    }
  }

  async getExperimentalFeatures(): Promise<Record<string, unknown>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getExperimentalFeatures(): Promise<{
          features?: Record<string, unknown>
          enabled?: Array<Record<string, unknown>>
          disabled?: Array<Record<string, unknown>>
        }>
      }
      const result = await admin.getExperimentalFeatures()
      // SDK 后端最新形态为 `{enabled, disabled}` 数组；older/legacy 形态为
      // `{features: {key: bool}}` 对象。两种形态都归一化到 `{key: bool}`。
      if (result?.features) return result.features
      const out: Record<string, boolean> = {}
      for (const flag of result?.enabled ?? []) {
        const key = (flag.flag_key as string) ?? (flag.key as string)
        if (key) out[key] = true
      }
      for (const flag of result?.disabled ?? []) {
        const key = (flag.flag_key as string) ?? (flag.key as string)
        if (key) out[key] = false
      }
      return out
    } catch (err) {
      error(`[Admin] 获取实验特性失败: ${err}`)
      return {}
    }
  }

  /**
   * Toggle an experimental feature flag.
   *
   * Backend has no PUT on `/experimental_features`; it is driven by the
   * feature-flag service. This wrapper delegates to SDK `updateFeatureFlag`.
   */
  async setExperimentalFeature(feature: string, enabled: boolean): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        updateFeatureFlag(flagKey: string, patch: { status?: string }): Promise<unknown>
      }
      await admin.updateFeatureFlag(feature, { status: enabled ? 'enabled' : 'disabled' })
      info(`[Admin] 实验特性已${enabled ? '启用' : '禁用'}: ${feature}`)
    } catch (err) {
      error(`[Admin] 设置实验特性失败: ${err}`)
      throw err
    }
  }

  async getBackups(): Promise<Array<Record<string, unknown>>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        listBackups(params?: { limit?: number; offset?: number }): Promise<{
          backups?: Array<Record<string, unknown>>
        }>
      }
      const result = await admin.listBackups()
      return result?.backups ?? []
    } catch (err) {
      error(`[Admin] 获取备份信息失败: ${err}`)
      return []
    }
  }

  // ==================== Federation Extended ====================

  async getFederationServerStatus(serverName: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getFederationDestination(destination: string, throwOnError?: boolean): Promise<Record<string, unknown> | null>
      }
      return (await admin.getFederationDestination(serverName, false)) ?? null
    } catch (err) {
      error(`[Admin] 获取联邦服务器状态失败: ${err}`)
      return null
    }
  }

  async reconnectFederation(serverName: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        resetFederationConnection(destination: string): Promise<void>
      }
      await admin.resetFederationConnection(serverName)
      info(`[Admin] 联邦连接已重连: ${serverName}`)
    } catch (err) {
      error(`[Admin] 重连联邦连接失败: ${err}`)
      throw err
    }
  }

  // ==================== Retention Policy ====================

  /**
   * Returns the server-global retention policy wrapped as a single-entry list
   * for UI compatibility. Backend only exposes the global policy; there is no
   * list endpoint. Per-room policies are fetched via {@link getRetentionPolicy}.
   */
  async getRetentionPolicies(
    _limit = 50,
    _from?: string
  ): Promise<{ policies: Array<Record<string, unknown>>; nextToken?: string }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRetentionPolicy(): Promise<unknown>
      }
      const policy = await admin.getRetentionPolicy()
      return {
        policies: policy ? [policy as Record<string, unknown>] : [],
        nextToken: undefined
      }
    } catch (err) {
      error(`[Admin] 获取保留策略列表失败: ${err}`)
      return { policies: [] }
    }
  }

  async getRetentionPolicy(roomId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRoomRetentionPolicy(roomId: string): Promise<unknown>
      }
      const policy = await admin.getRoomRetentionPolicy(roomId)
      return (policy as Record<string, unknown>) ?? null
    } catch (err) {
      error(`[Admin] 获取房间保留策略失败: ${err}`)
      return null
    }
  }

  async setRetentionPolicy(roomId: string, maxLifetime?: number, minLifetime?: number): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        setRoomRetentionPolicy(
          roomId: string,
          policy: { max_lifetime?: number; min_lifetime?: number }
        ): Promise<unknown>
      }
      const policy: { max_lifetime?: number; min_lifetime?: number } = {}
      if (maxLifetime !== undefined) policy.max_lifetime = maxLifetime
      if (minLifetime !== undefined) policy.min_lifetime = minLifetime
      await admin.setRoomRetentionPolicy(roomId, policy)
      info(`[Admin] 设置保留策略: ${roomId}`)
    } catch (err) {
      error(`[Admin] 设置保留策略失败: ${err}`)
      throw err
    }
  }

  /**
   * @deprecated backend has no DELETE on `/retention/policy/{room_id}`. No-op
   * stub retained so existing callers do not throw; consider removing the UI
   * affordance instead.
   */
  async deleteRetentionPolicy(_roomId: string): Promise<void> {
    warn('[Admin] deleteRetentionPolicy: backend does not support deleting a retention policy; no-op.')
  }

  async runRetentionTask(): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        runRetention(roomId?: string): Promise<unknown>
      }
      await admin.runRetention()
      info('[Admin] 保留策略任务已启动')
    } catch (err) {
      error(`[Admin] 启动保留策略任务失败: ${err}`)
      throw err
    }
  }

  async getRetentionStatus(): Promise<Record<string, unknown>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRetentionStatus(): Promise<unknown>
      }
      const status = await admin.getRetentionStatus()
      return (status as Record<string, unknown>) ?? {}
    } catch (err) {
      error(`[Admin] 获取保留策略状态失败: ${err}`)
      return {}
    }
  }

  // ==================== Admin Registration ====================

  async getRegistrationNonce(): Promise<string> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        registerNonce(): Promise<string>
      }
      return (await admin.registerNonce()) ?? ''
    } catch (err) {
      error(`[Admin] 获取注册nonce失败: ${err}`)
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
      const adminMgr = (await this.sdkAdmin()) as unknown as {
        adminRegister(options: {
          username: string
          password: string
          admin?: boolean
          displayname?: string
          nonce?: string
          mac?: string
        }): Promise<{ access_token?: string; user_id?: string; device_id?: string }>
      }
      const result = await adminMgr.adminRegister({
        username,
        password,
        nonce,
        admin,
        displayname: username,
        mac
      })
      info(`[Admin] 管理员注册用户: ${username}`)
      return {
        accessToken: result?.access_token ?? '',
        userId: result?.user_id ?? '',
        deviceId: result?.device_id ?? ''
      }
    } catch (err) {
      error(`[Admin] 管理员注册用户失败: ${err}`)
      return null
    }
  }

  // ==================== Audit Extended ====================

  async getAuditEvent(eventId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getAuditEvent(eventId: string): Promise<Record<string, unknown>>
      }
      const result = await admin.getAuditEvent(eventId)
      return (result as Record<string, unknown>) ?? null
    } catch (err) {
      error(`[Admin] 获取审计事件详情失败: ${err}`)
      return null
    }
  }

  // ==================== Media Extended ====================

  async purgeMediaCache(beforeTs?: number): Promise<{ deleted: number }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.purgeMediaCache(beforeTs)
      info(`[Admin] 清理媒体缓存: ${result?.deleted ?? 0}个`)
      return { deleted: result?.deleted ?? 0 }
    } catch (err) {
      error(`[Admin] 清理媒体缓存失败: ${err}`)
      throw err
    }
  }

  // ==================== SAML Extended ====================

  async getSamlMappings(
    limit = 50,
    from?: string
  ): Promise<{
    mappings: Array<Record<string, unknown>>
    nextToken?: string
  }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        listSamlMappings(params: { limit?: number; from?: string }): Promise<{
          mappings: Array<Record<string, unknown>>
          next_token?: string
        }>
      }
      const result = await admin.listSamlMappings({ limit, from })
      return {
        mappings: result?.mappings ?? [],
        nextToken: result?.next_token
      }
    } catch (err) {
      error(`[Admin] 获取SAML映射失败: ${err}`)
      return { mappings: [] }
    }
  }

  async getSamlMapping(nameId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getSamlMapping(nameId: string): Promise<Record<string, unknown>>
      }
      return (await admin.getSamlMapping(nameId)) ?? null
    } catch (err) {
      error(`[Admin] 获取SAML映射详情失败: ${err}`)
      return null
    }
  }

  async updateSamlMapping(nameId: string, updates: Record<string, unknown>): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        updateSamlMapping(nameId: string, updates: Record<string, unknown>): Promise<void>
      }
      await admin.updateSamlMapping(nameId, updates)
      info(`[Admin] 更新SAML映射: ${nameId}`)
    } catch (err) {
      error(`[Admin] 更新SAML映射失败: ${err}`)
      throw err
    }
  }

  async deleteSamlMapping(nameId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        deleteSamlMapping(nameId: string): Promise<void>
      }
      await admin.deleteSamlMapping(nameId)
      info(`[Admin] 删除SAML映射: ${nameId}`)
    } catch (err) {
      error(`[Admin] 删除SAML映射失败: ${err}`)
      throw err
    }
  }

  async samlLogout(userId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        samlLogout(userId: string): Promise<void>
      }
      await admin.samlLogout(userId)
      info(`[Admin] SAML登出: ${userId}`)
    } catch (err) {
      error(`[Admin] SAML登出失败: ${err}`)
      throw err
    }
  }

  // ==================== Notification Extended ====================

  async getUserNotificationSettings(userId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getUserNotificationSettings(userId: string): Promise<Record<string, unknown>>
      }
      return (await admin.getUserNotificationSettings(userId)) ?? null
    } catch (err) {
      error(`[Admin] 获取用户通知设置失败: ${err}`)
      return null
    }
  }

  async setUserNotificationSettings(userId: string, settings: Record<string, unknown>): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        setUserNotificationSettings(userId: string, settings: Record<string, unknown>): Promise<void>
      }
      await admin.setUserNotificationSettings(userId, settings)
      info(`[Admin] 更新用户通知设置: ${userId}`)
    } catch (err) {
      error(`[Admin] 更新用户通知设置失败: ${err}`)
      throw err
    }
  }

  async getUserPushers(userId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        listUserPushers(userId: string): Promise<{ pushers?: Array<Record<string, unknown>> }>
      }
      const result = await admin.listUserPushers(userId)
      return result?.pushers ?? []
    } catch (err) {
      error(`[Admin] 获取用户Pushers失败: ${err}`)
      return []
    }
  }

  async deleteUserPusher(userId: string, pushkey: string, appId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        deleteUserPusher(userId: string, pushkey: string, appId: string): Promise<void>
      }
      await admin.deleteUserPusher(userId, pushkey, appId)
      info(`[Admin] 删除用户Pusher: ${userId}`)
    } catch (err) {
      error(`[Admin] 删除用户Pusher失败: ${err}`)
      throw err
    }
  }

  // ==================== Application Services ====================

  async getApplicationServices(
    limit = 50,
    from?: string
  ): Promise<{ services: Array<Record<string, unknown>>; nextToken?: string }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        listApplicationServices(params: { limit?: number; from?: string }): Promise<{
          services: Array<Record<string, unknown>>
          next_token?: string
        }>
      }
      const result = await admin.listApplicationServices({ limit, from })
      return {
        services: result?.services ?? [],
        nextToken: result?.next_token
      }
    } catch (err) {
      error(`[Admin] 获取应用服务列表失败: ${err}`)
      return { services: [] }
    }
  }

  async registerApplicationService(asToken: string, config: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        registerApplicationService(asToken: string, config: Record<string, unknown>): Promise<Record<string, unknown>>
      }
      const result = await admin.registerApplicationService(asToken, config)
      info('[Admin] 注册应用服务成功')
      return result
    } catch (err) {
      error(`[Admin] 注册应用服务失败: ${err}`)
      throw err
    }
  }

  async getApplicationService(serviceId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getApplicationService(serviceId: string): Promise<Record<string, unknown>>
      }
      return (await admin.getApplicationService(serviceId)) ?? null
    } catch (err) {
      error(`[Admin] 获取应用服务详情失败: ${err}`)
      return null
    }
  }

  async updateApplicationService(serviceId: string, config: Record<string, unknown>): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        updateApplicationService(serviceId: string, config: Record<string, unknown>): Promise<void>
      }
      await admin.updateApplicationService(serviceId, config)
      info(`[Admin] 更新应用服务: ${serviceId}`)
    } catch (err) {
      error(`[Admin] 更新应用服务失败: ${err}`)
      throw err
    }
  }

  async deleteApplicationService(serviceId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        deleteApplicationService(serviceId: string): Promise<void>
      }
      await admin.deleteApplicationService(serviceId)
      info(`[Admin] 删除应用服务: ${serviceId}`)
    } catch (err) {
      error(`[Admin] 删除应用服务失败: ${err}`)
      throw err
    }
  }

  async pingApplicationService(serviceId: string): Promise<{ ok: boolean; durationMs?: number }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        pingApplicationService(serviceId: string): Promise<{ ok?: boolean; duration_ms?: number }>
      }
      const result = await admin.pingApplicationService(serviceId)
      info(`[Admin] Ping应用服务: ${serviceId}`)
      return { ok: result?.ok ?? false, durationMs: result?.duration_ms }
    } catch (err) {
      error(`[Admin] Ping应用服务失败: ${err}`)
      return { ok: false }
    }
  }

  // ==================== System Notifications CRUD ====================

  async createSystemNotification(
    content: string,
    type: string = 'info',
    targetUsers?: string[]
  ): Promise<{ notificationId: string }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        createSystemNotification(body: {
          content: string
          type?: string
          target_users?: string[]
        }): Promise<{ notification_id?: string }>
      }
      const body: { content: string; type?: string; target_users?: string[] } = { content, type }
      if (targetUsers) body.target_users = targetUsers
      const result = await admin.createSystemNotification(body)
      info('[Admin] 创建系统通知成功')
      return { notificationId: result?.notification_id ?? '' }
    } catch (err) {
      error(`[Admin] 创建系统通知失败: ${err}`)
      throw err
    }
  }

  async getSystemNotifications(
    limit = 50,
    from?: string
  ): Promise<{ notifications: Array<Record<string, unknown>>; nextToken?: string }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        listSystemNotifications(params: { limit?: number; from?: string }): Promise<{
          notifications: Array<Record<string, unknown>>
          next_token?: string
        }>
      }
      const result = await admin.listSystemNotifications({ limit, from })
      return {
        notifications: result?.notifications ?? [],
        nextToken: result?.next_token
      }
    } catch (err) {
      error(`[Admin] 获取系统通知列表失败: ${err}`)
      return { notifications: [] }
    }
  }

  async getSystemNotification(notificationId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getSystemNotification(notificationId: string): Promise<Record<string, unknown>>
      }
      return (await admin.getSystemNotification(notificationId)) ?? null
    } catch (err) {
      error(`[Admin] 获取系统通知详情失败: ${err}`)
      return null
    }
  }

  async updateSystemNotification(notificationId: string, updates: Record<string, unknown>): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        updateSystemNotification(notificationId: string, updates: Record<string, unknown>): Promise<void>
      }
      await admin.updateSystemNotification(notificationId, updates)
      info(`[Admin] 更新系统通知: ${notificationId}`)
    } catch (err) {
      error(`[Admin] 更新系统通知失败: ${err}`)
      throw err
    }
  }

  async deleteSystemNotification(notificationId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        deleteSystemNotification(notificationId: string): Promise<void>
      }
      await admin.deleteSystemNotification(notificationId)
      info(`[Admin] 删除系统通知: ${notificationId}`)
    } catch (err) {
      error(`[Admin] 删除系统通知失败: ${err}`)
      throw err
    }
  }

  // ==================== Room Delete Compatible ====================

  async deleteRoomCompat(
    roomId: string,
    options?: {
      purge?: boolean
      force?: boolean
      newRoomUserId?: string
      roomName?: string
      message?: string
    }
  ): Promise<{ kickedUsers: string[]; newRoomId?: string }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        deleteRoomV2(
          roomId: string,
          options?: Record<string, unknown>
        ): Promise<{ kicked_users?: string[]; new_room_id?: string }>
      }
      const body: Record<string, unknown> = {}
      if (options?.purge) body.purge = options.purge
      if (options?.force) body.force_purge = options.force
      if (options?.newRoomUserId) body.new_room_user_id = options.newRoomUserId
      if (options?.roomName) body.room_name = options.roomName
      if (options?.message) body.message = options.message
      const result = await admin.deleteRoomV2(roomId, body)
      info(`[Admin] 兼容删除房间: ${roomId}`)
      return {
        kickedUsers: result?.kicked_users ?? [],
        newRoomId: result?.new_room_id
      }
    } catch (err) {
      error(`[Admin] 兼容删除房间失败: ${err}`)
      throw err
    }
  }

  // ==================== User Rate Limit ====================

  async getUserRateLimit(userId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRateLimit(userId: string, throwOnError?: boolean): Promise<Record<string, unknown> | null>
      }
      return (await admin.getRateLimit(userId, false)) ?? null
    } catch (err) {
      error(`[Admin] 获取用户限速失败: ${err}`)
      return null
    }
  }

  async setUserRateLimit(userId: string, limit: Record<string, unknown>): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        setRateLimit(userId: string, config: Record<string, unknown>): Promise<void>
      }
      await admin.setRateLimit(userId, limit)
      info(`[Admin] 设置用户限速: ${userId}`)
    } catch (err) {
      error(`[Admin] 设置用户限速失败: ${err}`)
      throw err
    }
  }

  async deleteUserRateLimit(userId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        deleteRateLimit(userId: string): Promise<void>
      }
      await admin.deleteRateLimit(userId)
      info(`[Admin] 删除用户限速: ${userId}`)
    } catch (err) {
      error(`[Admin] 删除用户限速失败: ${err}`)
      throw err
    }
  }

  // ==================== Admin Info ====================

  /**
   * Aggregate admin info. Delegates to SDK `AdminManager.getServerInfo`,
   * which merges `/status` + `/config` + `/server_version` server-side.
   */
  async getAdminInfo(): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getServerInfo(throwOnError?: boolean): Promise<Record<string, unknown> | null>
      }
      return (await admin.getServerInfo(false)) ?? null
    } catch (err) {
      error(`[Admin] 获取管理端信息失败: ${err}`)
      return null
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        deactivateUser(userId: string): Promise<void>
      }
      await admin.deactivateUser(userId)
    } catch (err) {
      error(`[Admin] 删除用户失败: ${err}`)
      throw err
    }
  }

  async getSecurityEvents(
    limit = 100,
    from?: string,
    filters?: Record<string, unknown>
  ): Promise<{ events: Array<Record<string, unknown>>; nextToken?: string } | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        listSecurityEvents(
          params: { limit?: number; from?: string } & Record<string, unknown>
        ): Promise<{ events?: Array<Record<string, unknown>>; next_token?: string }>
      }
      const params: { limit?: number; from?: string } & Record<string, unknown> = { limit }
      if (from) params.from = from
      if (filters) Object.assign(params, filters)
      const result = await admin.listSecurityEvents(params)
      return {
        events: result?.events ?? [],
        nextToken: result?.next_token
      }
    } catch (err) {
      error(`[Admin] 获取安全事件失败: ${err}`)
      return null
    }
  }

  async getIpBlocks(): Promise<Array<Record<string, unknown>> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        listIpBlocks(): Promise<Array<Record<string, unknown>>>
      }
      return (await admin.listIpBlocks()) ?? null
    } catch (err) {
      error(`[Admin] 获取IP封禁列表失败: ${err}`)
      return null
    }
  }

  async blockIp(
    ip: string,
    options?: { cidr?: number; expireAt?: number; reason?: string }
  ): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        blockIp(
          ip: string,
          options?: { cidr?: number; expire_at?: number; reason?: string }
        ): Promise<Record<string, unknown>>
      }
      const sdkOpts: { cidr?: number; expire_at?: number; reason?: string } = {}
      if (options?.cidr !== undefined) sdkOpts.cidr = options.cidr
      if (options?.expireAt !== undefined) sdkOpts.expire_at = options.expireAt
      if (options?.reason !== undefined) sdkOpts.reason = options.reason
      return (await admin.blockIp(ip, sdkOpts)) ?? null
    } catch (err) {
      error(`[Admin] 封禁IP失败: ${err}`)
      return null
    }
  }

  async unblockIp(ip: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        unblockIp(ip: string): Promise<void>
      }
      await admin.unblockIp(ip)
    } catch (err) {
      error(`[Admin] 解除IP封禁失败: ${err}`)
      throw err
    }
  }

  async getIpReputation(ip: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getIpReputation(ip: string): Promise<Record<string, unknown>>
      }
      return (await admin.getIpReputation(ip)) ?? null
    } catch (err) {
      error(`[Admin] 获取IP声誉失败: ${err}`)
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
      error(`[Admin] 获取服务器日志失败: ${err}`)
      return null
    }
  }

  async getMediaStats(): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getMediaStats(): Promise<Record<string, unknown>>
      }
      return (await admin.getMediaStats()) ?? null
    } catch (err) {
      error(`[Admin] 获取媒体统计失败: ${err}`)
      return null
    }
  }
}

export const adminService = new AdminService()

import { ref } from 'vue'

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
