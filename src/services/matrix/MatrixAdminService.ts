import type { MatrixClient } from 'matrix-js-sdk'
import { AdminManager, UserInfo as SdkUserInfo, RoomInfo as SdkRoomInfo } from 'matrix-js-sdk'
import { BaseManager } from './BaseManager'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('Admin')

export interface ServerStats {
  roomCount: number
  userCount: number
  dailyActiveUsers: number
  messageCount: number
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

class AdminService extends BaseManager {
  private client: MatrixClient | null = null
  private adminManager: AdminManager | null = null

  initialize(client: MatrixClient): void {
    this.client = client
    this.adminManager = client.getAdminManager()
    logger.info('服务已初始化')
  }

  async getServerStats(throwOnError = true): Promise<ServerStats> {
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
      return this.handleError(
        error,
        'getServerStats',
        { roomCount: 0, userCount: 0, dailyActiveUsers: 0, messageCount: 0, startServerTime: 0 } as ServerStats,
        throwOnError
      )
    }
  }

  async getUsers(limit = 100, from?: string, throwOnError = true): Promise<{ users: UserInfo[]; nextToken?: string }> {
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
      return this.handleError(error, 'getUsers', { users: [] as UserInfo[] }, throwOnError)
    }
  }

  async getUser(userId: string, throwOnError = true): Promise<UserInfo | null> {
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
      return this.handleError(error, 'getUser', null as UserInfo | null, throwOnError)
    }
  }

  async createUser(
    username: string,
    password: string,
    options?: {
      admin?: boolean
      displayname?: string
    },
    throwOnError = true
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
      return this.handleError(error, 'createUser', null as UserInfo | null, throwOnError)
    }
  }

  async resetPassword(userId: string, newPassword: string, throwOnError = true): Promise<void> {
    if (!this.adminManager) {
      throw new Error('AdminManager 未初始化')
    }

    try {
      await this.adminManager.resetPassword(userId, newPassword)
      logger.info('密码已重置:', userId)
    } catch (error) {
      this.handleError(error, 'resetPassword', undefined as void, throwOnError)
    }
  }

  async deactivateUser(userId: string, throwOnError = true): Promise<void> {
    if (!this.adminManager) {
      throw new Error('AdminManager 未初始化')
    }

    try {
      await this.adminManager.deactivateUser(userId)
      logger.info('用户已停用:', userId)
    } catch (error) {
      this.handleError(error, 'deactivateUser', undefined as void, throwOnError)
    }
  }

  async getRooms(limit = 100, from?: string, throwOnError = true): Promise<{ rooms: RoomInfo[]; nextToken?: string }> {
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
      return this.handleError(error, 'getRooms', { rooms: [] as RoomInfo[] }, throwOnError)
    }
  }

  async getRoom(roomId: string, throwOnError = true): Promise<RoomInfo | null> {
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
      return this.handleError(error, 'getRoom', null as RoomInfo | null, throwOnError)
    }
  }

  async kickUser(roomId: string, userId: string, reason?: string, throwOnError = true): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    try {
      await this.client.kick(roomId, userId, reason)
      logger.info('用户已踢出房间:', userId, roomId)
    } catch (error) {
      this.handleError(error, 'kickUser', undefined as void, throwOnError)
    }
  }

  async banUser(roomId: string, userId: string, reason?: string, throwOnError = true): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    try {
      await this.client.ban(roomId, userId, reason)
      logger.info('用户已封禁:', userId, roomId)
    } catch (error) {
      this.handleError(error, 'banUser', undefined as void, throwOnError)
    }
  }

  async unbanUser(roomId: string, userId: string, throwOnError = true): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    try {
      await this.client.unban(roomId, userId)
      logger.info('用户已解除封禁:', userId, roomId)
    } catch (error) {
      this.handleError(error, 'unbanUser', undefined as void, throwOnError)
    }
  }

  async getWhois(userId: string, throwOnError = true): Promise<WhoisInfo | null> {
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
      return this.handleError(error, 'getWhois', null as WhoisInfo | null, throwOnError)
    }
  }

  async shutdownRoom(roomId: string, _message?: string, throwOnError = true): Promise<void> {
    if (!this.adminManager) {
      throw new Error('AdminManager 未初始化')
    }

    try {
      await this.adminManager.shutdownRoom(roomId)
      logger.info('房间已关闭:', roomId)
    } catch (error) {
      this.handleError(error, 'shutdownRoom', undefined as void, throwOnError)
    }
  }

  async deleteRoom(roomId: string, throwOnError = true): Promise<void> {
    if (!this.adminManager) {
      throw new Error('AdminManager 未初始化')
    }

    try {
      await this.adminManager.deleteRoom(roomId)
      logger.info('房间已删除:', roomId)
    } catch (error) {
      this.handleError(error, 'deleteRoom', undefined as void, throwOnError)
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
