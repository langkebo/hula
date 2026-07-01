import { type ICreateRoomOpts, Preset, Visibility } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import matrixClientService from '../MatrixClientService'
import { matrixRoomService } from './MatrixRoomService'
import { type GroupSearchResult, matrixRoomQueryService } from './QueryService'

const logger = createLogger('MatrixGroupService')

export type CreateRoomOptions = ICreateRoomOpts

export interface RoomPowerLevels {
  users?: Record<string, number>
  users_default?: number
  events?: Record<string, number>
  events_default?: number
  state_default?: number
  invite?: number
  kick?: number
  ban?: number
  redact?: number
}

// Re-exported for backward compatibility — consumers import GroupSearchResult from MatrixGroupService
export type { GroupSearchResult } from './QueryService'

export interface GroupCreateResult {
  roomId: string
}

class MatrixGroupService {
  async createGroup(options: CreateRoomOptions): Promise<GroupCreateResult> {
    try {
      const room = await matrixRoomService.createRoom(options)
      return { roomId: room.roomId }
    } catch (err) {
      logger.error(`[MatrixGroup] 创建群组失败: ${err}`)
      throw err
    }
  }

  async createGroupChat(userIds: string[]): Promise<GroupCreateResult> {
    try {
      const room = await matrixRoomService.createRoom({
        invite: userIds,
        is_direct: false,
        preset: Preset.PrivateChat,
        visibility: Visibility.Private
      })
      return { roomId: room.roomId }
    } catch (err) {
      logger.error(`[MatrixGroup] 创建群聊失败: ${err}`)
      throw err
    }
  }

  async leaveRoom(roomId: string): Promise<void> {
    try {
      await matrixRoomService.leaveRoom(roomId)
    } catch (err) {
      logger.error(`[MatrixGroup] 离开房间失败: ${err}`)
      throw err
    }
  }

  async exitGroup(roomId: string): Promise<void> {
    await this.leaveRoom(roomId)
  }

  async updateRoomName(roomId: string, name: string): Promise<void> {
    try {
      await matrixRoomService.setRoomName(roomId, name)
    } catch (err) {
      logger.error(`[MatrixGroup] 更新群名失败: ${err}`)
      throw err
    }
  }

  async inviteGroupMember(roomId: string, userId: string): Promise<void> {
    try {
      await matrixRoomService.inviteUser(roomId, userId)
    } catch (err) {
      logger.error(`[MatrixGroup] 邀请成员失败: ${err}`)
      throw err
    }
  }

  async removeGroupMember(roomId: string, userId: string): Promise<void> {
    try {
      await matrixRoomService.kickUser(roomId, userId)
    } catch (err) {
      logger.error(`[MatrixGroup] 移除成员失败: ${err}`)
      throw err
    }
  }

  async applyGroup(account: string): Promise<void> {
    try {
      await matrixClientService.joinRoom(account)
    } catch (err) {
      logger.error(`[MatrixGroup] 申请加群失败: ${err}`)
      throw err
    }
  }

  async searchGroup(keyword: string): Promise<GroupSearchResult[]> {
    return matrixRoomQueryService.searchGroup(keyword)
  }
}

export const matrixGroupService = new MatrixGroupService()

export default matrixGroupService
