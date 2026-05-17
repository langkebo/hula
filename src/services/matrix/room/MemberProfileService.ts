import { error, info } from '@tauri-apps/plugin-log'
import { BaseMatrixService } from '../BaseMatrixService'

interface MemberEventContent {
  displayname?: string
  avatar_url?: string
  membership?: string
  [key: string]: unknown
}

/**
 * Room member profile domain service.
 *
 * Covers per-room displayname and power-level / admin role management.
 * Extracted from `MatrixRoomService` as part of the P1-1 split.
 */
export class MatrixRoomMemberProfileService extends BaseMatrixService {
  async setMemberDisplayName(roomId: string, displayName: string): Promise<void> {
    const client = this.getClient()
    try {
      const userId = client.getUserId()
      if (!userId) {
        throw new Error(this.t('matrix_error.common.user_not_logged_in'))
      }

      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(this.t('matrix_error.common.room_not_found', { roomId }))
      }

      const currentMembership = (room.currentState.getStateEvents('m.room.member', userId)?.getContent() ??
        {}) as MemberEventContent

      await client.sendStateEvent(
        roomId,
        'm.room.member',
        {
          ...currentMembership,
          displayname: displayName,
          membership: 'join'
        },
        userId
      )

      info(`[MatrixRoom] 设置成员昵称成功: ${roomId} -> ${displayName}`)
    } catch (err) {
      error(`[MatrixRoom] 设置成员昵称失败: ${err}`)
      throw err
    }
  }

  async getMemberDisplayName(roomId: string, userId: string): Promise<string | null> {
    try {
      const client = this.getClient()
      const room = client.getRoom(roomId) ?? null
      if (!room) return null

      const member = room.getMember(userId)
      return member?.rawDisplayName || member?.name || null
    } catch (err) {
      error(`[MatrixRoom] 获取成员显示名称失败: ${err}`)
      return null
    }
  }

  async setMemberPowerLevel(roomId: string, userId: string, powerLevel: number): Promise<void> {
    const client = this.getClient()
    try {
      await client.setUserPowerLevel(userId, roomId, powerLevel)
      info(`[MatrixRoom] 成功设置用户 ${userId} 的权力等级为 ${powerLevel}`)
    } catch (err) {
      error(`[MatrixRoom] 设置权力等级失败: ${err}`)
      throw err
    }
  }

  async setMemberAsAdmin(roomId: string, userId: string): Promise<void> {
    try {
      await this.setMemberPowerLevel(roomId, userId, 100)
    } catch (err) {
      error(`[MatrixRoom] 设置管理员失败: ${err}`)
      throw err
    }
  }

  async removeMemberAsAdmin(roomId: string, userId: string): Promise<void> {
    try {
      await this.setMemberPowerLevel(roomId, userId, 0)
    } catch (err) {
      error(`[MatrixRoom] 移除管理员失败: ${err}`)
      throw err
    }
  }
}

export const matrixRoomMemberProfileService = new MatrixRoomMemberProfileService()
