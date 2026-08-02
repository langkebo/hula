import type { Room, RoomMember } from 'matrix-js-sdk'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import { createLogger } from '@/utils/Logger'
import matrixClientService from '../MatrixClientService'

const logger = createLogger('MembershipService')

/**
 * Room membership domain service.
 *
 * Covers the join/leave/invite/kick/ban/unban/forget/knock lifecycle.
 * Extracted from `MatrixRoomService` as part of the P1-1 split.
 */
export class MatrixRoomMembershipService {
  private getClient(prefix = true) {
    const client = matrixClientService.getClient()
    if (!client) throw new Error(prefix ? '[MatrixRoom] 客户端未初始化' : '客户端未初始化')
    return client
  }

  async joinRoom(roomId: string): Promise<Room> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('membership', roomId, { roomId, type: 'join' })
      logger.info(`[MatrixRoom] 离线状态，已将加入房间入队: ${roomId}`)
      // 返回一个模拟的 Room 对象或抛出特定错误供上层处理
      return { roomId } as Room
    }

    try {
      return await matrixClientService.joinRoom(roomId)
    } catch (err) {
      logger.error(`[MatrixRoom] 加入房间失败: ${err}`)
      throw err
    }
  }

  async leaveRoom(roomId: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('membership', roomId, { roomId, type: 'leave' })
      logger.info(`[MatrixRoom] 离线状态，已将离开房间入队: ${roomId}`)
      return
    }

    try {
      await matrixClientService.leaveRoom(roomId)
    } catch (err) {
      logger.error(`[MatrixRoom] 离开房间失败: ${err}`)
      throw err
    }
  }

  async inviteUser(roomId: string, userId: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('membership', roomId, { roomId, userId, type: 'invite' })
      logger.info(`[MatrixRoom] 离线状态，已将邀请用户入队: ${userId} -> ${roomId}`)
      return
    }

    const client = this.getClient(false)
    try {
      await client.invite(roomId, userId)
      logger.info(`[MatrixRoom] 邀请用户成功: ${userId} -> ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 邀请用户失败: ${err}`)
      throw err
    }
  }

  async kickUser(roomId: string, userId: string, reason?: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('membership', roomId, { roomId, userId, reason, type: 'kick' })
      logger.info(`[MatrixRoom] 离线状态，已将踢出用户入队: ${userId} <- ${roomId}`)
      return
    }

    const client = this.getClient(false)
    try {
      await client.kick(roomId, userId, reason)
      logger.info(`[MatrixRoom] 踢出用户成功: ${userId} <- ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 踢出用户失败: ${err}`)
      throw err
    }
  }

  async banUser(roomId: string, userId: string, reason?: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('membership', roomId, { roomId, userId, reason, type: 'ban' })
      logger.info(`[MatrixRoom] 离线状态，已将封禁用户入队: ${userId} <- ${roomId}`)
      return
    }

    const client = this.getClient(false)
    try {
      await client.ban(roomId, userId, reason)
      logger.info(`[MatrixRoom] 封禁用户成功: ${userId} <- ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 封禁用户失败: ${err}`)
      throw err
    }
  }

  async unbanUser(roomId: string, userId: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('membership', roomId, { roomId, userId, type: 'unban' })
      logger.info(`[MatrixRoom] 离线状态，已将解封用户入队: ${userId} <- ${roomId}`)
      return
    }

    const client = this.getClient(false)
    try {
      await client.unban(roomId, userId)
      logger.info(`[MatrixRoom] 解封用户成功: ${userId} <- ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 解封用户失败: ${err}`)
      throw err
    }
  }

  async forgetRoom(roomId: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.forget(roomId)
      logger.info(`[MatrixRoom] 忘记房间成功: ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 忘记房间失败: ${err}`)
      throw err
    }
  }

  async knockRoom(roomId: string, reason?: string, viaServers?: string[]): Promise<{ room_id: string }> {
    const client = this.getClient()
    try {
      const result = await client.getRoomManager().knockRoom(roomId, {
        reason: reason,
        viaServers: viaServers
      })
      logger.info(`[MatrixRoom] 敲门房间成功: ${roomId}`)
      return result as { room_id: string }
    } catch (err) {
      logger.error(`[MatrixRoom] 敲门房间失败: ${err}`)
      throw err
    }
  }

  async joinRoomByAlias(roomIdOrAlias: string, serverName?: string[]): Promise<{ room_id: string }> {
    const client = this.getClient()
    try {
      const result = await client.getRoomManager().joinRoom(roomIdOrAlias, {
        viaServers: serverName
      })
      logger.info(`[MatrixRoom] 通过别名加入房间成功: ${roomIdOrAlias}`)
      return { room_id: result.roomId }
    } catch (err) {
      logger.error(`[MatrixRoom] 通过别名加入房间失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取房间中已邀请（invite）的成员列表
   *
   * @param roomId - 房间 ID
   * @returns 已邀请成员列表，房间不存在时返回空数组
   */
  async getInvitedMembers(roomId: string): Promise<RoomMember[]> {
    const client = this.getClient(false)
    const room = client.getRoom(roomId)
    if (!room) {
      logger.warn(`[MatrixRoom] 获取邀请成员列表时房间不存在: ${roomId}`)
      return []
    }
    return room.getMembersWithMembership('invite')
  }

  /**
   * 获取房间中被封禁（ban）的成员列表
   *
   * @param roomId - 房间 ID
   * @returns 被封禁成员列表，房间不存在时返回空数组
   */
  async getBannedMembers(roomId: string): Promise<RoomMember[]> {
    const client = this.getClient(false)
    const room = client.getRoom(roomId)
    if (!room) {
      logger.warn(`[MatrixRoom] 获取封禁成员列表时房间不存在: ${roomId}`)
      return []
    }
    return room.getMembersWithMembership('ban')
  }
}

export const matrixRoomMembershipService = new MatrixRoomMembershipService()
