import { error, info, warn } from '@tauri-apps/plugin-log'
import { type ICreateRoomOpts, Preset, Visibility } from 'matrix-js-sdk'
import matrixClientService from '../MatrixClientService'
import { matrixRoomService } from './MatrixRoomService'

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

export interface GroupSearchResult {
  account: string
  name: string
  avatar?: string
  deleteStatus?: boolean
  extJson?: string
  roomId: string
}

export interface GroupCreateResult {
  roomId: string
}

class MatrixGroupService {
  async createGroup(options: CreateRoomOptions): Promise<GroupCreateResult> {
    try {
      const room = await matrixRoomService.createRoom(options)
      return { roomId: room.roomId }
    } catch (err) {
      error(`[MatrixGroup] 创建群组失败: ${err}`)
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
      error(`[MatrixGroup] 创建群聊失败: ${err}`)
      throw err
    }
  }

  async leaveRoom(roomId: string): Promise<void> {
    try {
      await matrixRoomService.leaveRoom(roomId)
    } catch (err) {
      error(`[MatrixGroup] 离开房间失败: ${err}`)
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
      error(`[MatrixGroup] 更新群名失败: ${err}`)
      throw err
    }
  }

  async inviteGroupMember(roomId: string, userId: string): Promise<void> {
    try {
      await matrixRoomService.inviteUser(roomId, userId)
    } catch (err) {
      error(`[MatrixGroup] 邀请成员失败: ${err}`)
      throw err
    }
  }

  async removeGroupMember(roomId: string, userId: string): Promise<void> {
    try {
      await matrixRoomService.kickUser(roomId, userId)
    } catch (err) {
      error(`[MatrixGroup] 移除成员失败: ${err}`)
      throw err
    }
  }

  async applyGroup(account: string): Promise<void> {
    try {
      await matrixClientService.joinRoom(account)
    } catch (err) {
      error(`[MatrixGroup] 申请加群失败: ${err}`)
      throw err
    }
  }

  async searchGroup(keyword: string): Promise<GroupSearchResult[]> {
    try {
      const normalizedKeyword = keyword.trim()
      if (!normalizedKeyword) return []

      const client = matrixClientService.getClient()
      if (!client) return []

      const rooms = client.getRooms()
      const lowerKeyword = normalizedKeyword.toLowerCase()
      const results = rooms
        .filter((room) => {
          const name = room.name?.toLowerCase() ?? ''
          const roomId = room.roomId?.toLowerCase() ?? ''
          return name.includes(lowerKeyword) || roomId.includes(lowerKeyword)
        })
        .map((room) => ({
          account: room.roomId,
          name: room.name || room.roomId,
          avatar: room.getMxcAvatarUrl?.() ?? undefined,
          roomId: room.roomId
        }))

      if (results.length === 0) {
        warn(`[MatrixGroup] 未找到匹配群组: ${normalizedKeyword}`)
      } else {
        info(`[MatrixGroup] 搜索群组成功: ${normalizedKeyword}, ${results.length} 条`)
      }
      return results
    } catch (err) {
      error(`[MatrixGroup] 搜索群组失败: ${err}`)
      return []
    }
  }
}

export const matrixGroupService = new MatrixGroupService()

export default matrixGroupService
