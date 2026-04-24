import { info, error } from '@tauri-apps/plugin-log'
import type { Room } from 'matrix-js-sdk'
import matrixClientService from '../MatrixClientService'

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
    try {
      return await matrixClientService.joinRoom(roomId)
    } catch (err) {
      error(`[MatrixRoom] 加入房间失败: ${err}`)
      throw err
    }
  }

  async leaveRoom(roomId: string): Promise<void> {
    try {
      await matrixClientService.leaveRoom(roomId)
    } catch (err) {
      error(`[MatrixRoom] 离开房间失败: ${err}`)
      throw err
    }
  }

  async inviteUser(roomId: string, userId: string): Promise<void> {
    const client = this.getClient(false)
    try {
      await client.invite(roomId, userId)
      info(`[MatrixRoom] 邀请用户成功: ${userId} -> ${roomId}`)
    } catch (err) {
      error(`[MatrixRoom] 邀请用户失败: ${err}`)
      throw err
    }
  }

  async kickUser(roomId: string, userId: string, reason?: string): Promise<void> {
    const client = this.getClient(false)
    try {
      await client.kick(roomId, userId, reason)
      info(`[MatrixRoom] 踢出用户成功: ${userId} <- ${roomId}`)
    } catch (err) {
      error(`[MatrixRoom] 踢出用户失败: ${err}`)
      throw err
    }
  }

  async banUser(roomId: string, userId: string, reason?: string): Promise<void> {
    const client = this.getClient(false)
    try {
      await client.ban(roomId, userId, reason)
      info(`[MatrixRoom] 封禁用户成功: ${userId} <- ${roomId}`)
    } catch (err) {
      error(`[MatrixRoom] 封禁用户失败: ${err}`)
      throw err
    }
  }

  async unbanUser(roomId: string, userId: string): Promise<void> {
    const client = this.getClient(false)
    try {
      await client.unban(roomId, userId)
      info(`[MatrixRoom] 解封用户成功: ${userId} <- ${roomId}`)
    } catch (err) {
      error(`[MatrixRoom] 解封用户失败: ${err}`)
      throw err
    }
  }

  async forgetRoom(roomId: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.forget(roomId)
      info(`[MatrixRoom] 忘记房间成功: ${roomId}`)
    } catch (err) {
      error(`[MatrixRoom] 忘记房间失败: ${err}`)
      throw err
    }
  }

  async knockRoom(roomId: string, reason?: string): Promise<Room> {
    const client = this.getClient()
    try {
      const room = await client.joinRoom(roomId, { viaServers: [], reason } as Record<string, unknown>)
      info(`[MatrixRoom] 敲门加入房间成功: ${roomId}`)
      return room
    } catch (err) {
      error(`[MatrixRoom] 敲门加入房间失败: ${err}`)
      throw err
    }
  }
}

export const matrixRoomMembershipService = new MatrixRoomMembershipService()
