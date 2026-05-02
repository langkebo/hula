import type { CreateGroupRoomOptions } from './CreationService'
import { matrixDirectMessageService } from './MatrixDirectMessageService'
import { matrixGroupService } from './MatrixGroupService'
import { matrixRoomService } from './MatrixRoomService'

/**
 * 房间导航聚合服务
 * 整合了 DM、群组、空间等导航相关功能，减少调用方对多个子服务的直接依赖
 */
class RoomNavigationService {
  /**
   * 获取所有 DM 房间
   */
  async getDirectRooms() {
    return matrixDirectMessageService.getDMRooms()
  }

  /**
   * 初始化所有导航相关服务
   */
  async initialize() {
    await Promise.all([
      matrixDirectMessageService.initialize()
      // Group 和 Space 服务目前没有 initialize 方法，仅初始化 DM 服务
    ])
  }

  /**
   * 创建 DM 房间
   */
  createDirectMessage(userId: string) {
    return matrixDirectMessageService.createDm(userId)
  }

  /**
   * 获取或创建 DM 房间
   */
  getOrCreateDirectMessage(userId: string, encryption?: boolean) {
    return matrixDirectMessageService.getOrCreateDmRoom(userId, encryption)
  }

  /**
   * 加入房间
   */
  joinRoom(roomIdOrAlias: string) {
    return matrixRoomService.joinRoom(roomIdOrAlias)
  }

  /**
   * 创建群组房间
   */
  createGroupRoom(options: CreateGroupRoomOptions) {
    return matrixRoomService.createGroupRoom(options)
  }

  /**
   * 获取服务器域名
   */
  getServerDomain() {
    return matrixRoomService.getServerDomain()
  }

  /**
   * 离开房间
   */
  leaveRoom(roomId: string) {
    return matrixGroupService.leaveRoom(roomId)
  }

  /**
   * 移除成员 (踢出)
   */
  removeMember(roomId: string, userId: string) {
    return matrixGroupService.removeGroupMember(roomId, userId)
  }
}

export const roomNavigationService = new RoomNavigationService()
