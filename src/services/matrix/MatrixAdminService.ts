/**
 * Matrix 管理员 API 服务
 *
 * 提供管理员功能支持
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { AdminManager, UserInfo as SdkUserInfo, RoomInfo as SdkRoomInfo } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('Admin')

export interface ServerStats {
  /** 房间数 */
  roomCount: number
  /** 用户数 */
  userCount: number
  /** 活跃用户数 */
  dailyActiveUsers: number
  /** 消息数 */
  messageCount: number
  /** 启动时间 */
  startServerTime: number
}

export interface UserInfo {
  userId: string
  name?: string
  avatarUrl?: string
  admin?: boolean
  deactivated?: boolean
  displayname?: string
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
}

export interface WhoisInfo {
  userId: string
  devices: Array<{
    deviceId: string
    sessions: Array<{
      sessionId: string
      connections: Array<{
        ip: string
        lastSeen: number
        userAgent: string
      }>
    }>
  }>
}

/**
 * 管理员服务
 */
class AdminService {
  private client: MatrixClient | null = null
  private adminManager: AdminManager | null = null

  /**
   * 初始化服务
   */
  initialize(client: MatrixClient): void {
    this.client = client
    // 使用 SDK 的 AdminManager
    this.adminManager = client.getAdminManager()
    logger.info('服务已初始化')
  }

  /**
   * 获取服务器统计信息
   */
  async getServerStats(): Promise<ServerStats> {
    if (!this.adminManager) {
      throw new Error('AdminManager 未初始化')
    }

    try {
      const stats = await this.adminManager.getServerStats()

      return {
        roomCount: (stats as any).room_count || 0,
        userCount: (stats as any).user_count || 0,
        dailyActiveUsers: (stats as any).daily_active_users || 0,
        messageCount: (stats as any).total_nonlocal_users || 0,
        startServerTime: (stats as any).server_start_time || 0
      }
    } catch (error) {
      logger.error('获取统计失败:', error)
      return {
        roomCount: 0,
        userCount: 0,
        dailyActiveUsers: 0,
        messageCount: 0,
        startServerTime: 0
      }
    }
  }

  /**
   * 获取用户列表
   */
  async getUsers(limit = 100, from?: string): Promise<{ users: UserInfo[]; nextToken?: string }> {
    if (!this.adminManager) {
      throw new Error('AdminManager 未初始化')
    }

    try {
      const result = await this.adminManager.getUsers({ from, limit })

      const users: UserInfo[] = result.users.map((u: SdkUserInfo) => ({
        userId: u.user_id || '',
        name: u.name,
        avatarUrl: u.avatar_url,
        admin: u.admin || false,
        deactivated: u.deactivated || false,
        displayname: u.displayname
      }))

      return {
        users,
        nextToken: result.next_token
      }
    } catch (error) {
      logger.error('获取用户列表失败:', error)
      return { users: [] }
    }
  }

  /**
   * 获取用户信息
   */
  async getUser(userId: string): Promise<UserInfo | null> {
    if (!this.adminManager) {
      throw new Error('AdminManager 未初始化')
    }

    try {
      const user = await this.adminManager.getUser(userId)
      if (!user) return null

      return {
        userId: user.user_id || userId,
        name: user.name,
        avatarUrl: user.avatar_url,
        admin: user.admin,
        deactivated: user.deactivated,
        displayname: user.displayname
      }
    } catch (error) {
      logger.error('获取用户信息失败:', error)
      return null
    }
  }

  /**
   * 创建用户
   */
  async createUser(
    username: string,
    password: string,
    options?: {
      admin?: boolean
      displayname?: string
    }
  ): Promise<UserInfo | null> {
    if (!this.adminManager) {
      throw new Error('AdminManager 未初始化')
    }

    try {
      const user = await this.adminManager.createUser(username, password, {
        admin: options?.admin,
        displayname: options?.displayname
      })

      logger.info('用户已创建:', user.user_id)

      return {
        userId: user.user_id || username,
        name: user.name,
        admin: user.admin,
        displayname: user.displayname
      }
    } catch (error) {
      logger.error('创建用户失败:', error)
      return null
    }
  }

  /**
   * 重置用户密码
   */
  async resetPassword(userId: string, newPassword: string): Promise<void> {
    if (!this.adminManager) {
      throw new Error('AdminManager 未初始化')
    }

    try {
      await this.adminManager.resetPassword(userId, newPassword)
      logger.info('密码已重置:', userId)
    } catch (error) {
      logger.error('重置密码失败:', error)
      throw error
    }
  }

  /**
   * 停用用户
   */
  async deactivateUser(userId: string): Promise<void> {
    if (!this.adminManager) {
      throw new Error('AdminManager 未初始化')
    }

    try {
      await this.adminManager.deactivateUser(userId)
      logger.info('用户已停用:', userId)
    } catch (error) {
      logger.error('停用用户失败:', error)
      throw error
    }
  }

  /**
   * 获取房间列表
   */
  async getRooms(limit = 100, from?: string): Promise<{ rooms: RoomInfo[]; nextToken?: string }> {
    if (!this.adminManager) {
      throw new Error('AdminManager 未初始化')
    }

    try {
      const result = await this.adminManager.getRooms({ from, limit })

      const rooms: RoomInfo[] = result.rooms.map((r: SdkRoomInfo) => ({
        roomId: r.room_id || '',
        name: r.name,
        topic: r.topic,
        joinedMembers: r.joined_members || 0,
        joinedLocalMembers: r.joined_local_members || 0,
        invitedMembers: r.invited_members || 0,
        invitedLocalMembers: r.invited_local_members || 0,
        createTime: r.created_ts,
        creator: r.creator
      }))

      return {
        rooms,
        nextToken: result.next_token
      }
    } catch (error) {
      logger.error('获取房间列表失败:', error)
      return { rooms: [] }
    }
  }

  /**
   * 获取房间详情
   */
  async getRoom(roomId: string): Promise<RoomInfo | null> {
    if (!this.adminManager) {
      throw new Error('AdminManager 未初始化')
    }

    try {
      const room = await this.adminManager.getRoom(roomId)
      if (!room) return null

      return {
        roomId: room.room_id || roomId,
        name: room.name,
        topic: room.topic,
        joinedMembers: room.joined_members || 0,
        joinedLocalMembers: room.joined_local_members || 0,
        invitedMembers: room.invited_members || 0,
        invitedLocalMembers: room.invited_local_members || 0,
        createTime: room.created_ts,
        creator: room.creator
      }
    } catch (error) {
      logger.error('获取房间详情失败:', error)
      return null
    }
  }

  /**
   * 踢出房间成员
   */
  async kickUser(roomId: string, userId: string, reason?: string): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    try {
      await this.client.kick(roomId, userId, reason)
      logger.info('用户已踢出房间:', userId, roomId)
    } catch (error) {
      logger.error('踢出用户失败:', error)
      throw error
    }
  }

  /**
   * 封禁房间成员
   */
  async banUser(roomId: string, userId: string, reason?: string): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    try {
      await this.client.ban(roomId, userId, reason)
      logger.info('用户已封禁:', userId, roomId)
    } catch (error) {
      logger.error('封禁用户失败:', error)
      throw error
    }
  }

  /**
   * 解除封禁
   */
  async unbanUser(roomId: string, userId: string): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    try {
      await this.client.unban(roomId, userId)
      logger.info('用户已解除封禁:', userId, roomId)
    } catch (error) {
      logger.error('解除封禁失败:', error)
      throw error
    }
  }

  /**
   * 获取用户 Whois 信息
   */
  async getWhois(userId: string): Promise<WhoisInfo | null> {
    if (!this.adminManager) {
      throw new Error('AdminManager 未初始化')
    }

    try {
      const whois = await this.adminManager.getWhois(userId)

      return {
        userId: whois.user_id || userId,
        devices: (whois.devices || []).map((d: any) => ({
          deviceId: d.device_id,
          sessions: (d.sessions || []).map((s: any) => ({
            sessionId: s.session_id,
            connections: (s.connections || []).map((c: any) => ({
              ip: c.ip,
              lastSeen: c.last_seen,
              userAgent: c.user_agent
            }))
          }))
        }))
      }
    } catch (error) {
      logger.error('获取 Whois 失败:', error)
      return null
    }
  }

  /**
   * 关闭房间
   */
  async shutdownRoom(roomId: string, _message?: string): Promise<void> {
    if (!this.adminManager) {
      throw new Error('AdminManager 未初始化')
    }

    try {
      await this.adminManager.shutdownRoom(roomId)
      logger.info('房间已关闭:', roomId)
    } catch (error) {
      logger.error('关闭房间失败:', error)
      throw error
    }
  }

  /**
   * 删除房间
   */
  async deleteRoom(roomId: string): Promise<void> {
    if (!this.adminManager) {
      throw new Error('AdminManager 未初始化')
    }

    try {
      await this.adminManager.deleteRoom(roomId)
      logger.info('房间已删除:', roomId)
    } catch (error) {
      logger.error('删除房间失败:', error)
      throw error
    }
  }
}

/**
 * 单例
 */
export const adminService = new AdminService()

/**
 * Vue Composable
 */
import { ref } from 'vue'

export function useAdmin() {
  const stats = ref<ServerStats | null>(null)
  const users = ref<UserInfo[]>([])
  const rooms = ref<RoomInfo[]>([])
  const isLoading = ref(false)

  function initialize(client: MatrixClient) {
    adminService.initialize(client)
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

  async function createUser(username: string, password: string, admin = false) {
    isLoading.value = true
    try {
      return await adminService.createUser(username, password, { admin })
    } finally {
      isLoading.value = false
    }
  }

  async function resetPassword(userId: string, password: string) {
    await adminService.resetPassword(userId, password)
  }

  async function deactivateUser(userId: string) {
    await adminService.deactivateUser(userId)
  }

  async function shutdownRoom(roomId: string, message?: string) {
    await adminService.shutdownRoom(roomId, message)
  }

  async function getWhois(userId: string) {
    return await adminService.getWhois(userId)
  }

  return {
    stats,
    users,
    rooms,
    isLoading,
    initialize,
    loadStats,
    loadUsers,
    loadRooms,
    createUser,
    resetPassword,
    deactivateUser,
    shutdownRoom,
    getWhois
  }
}

export default adminService
