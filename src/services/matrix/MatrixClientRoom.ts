/**
 * MatrixClientRoom — 房间操作协作类
 *
 * 承载 MatrixClientService 的房间相关职责：
 * - getRooms / getRoom：从 client.store 查询房间
 * - createRoom / joinRoom / leaveRoom：房间生命周期操作
 * - canManageSpace：基于 power level 判断空间管理权限
 *
 * 通过 deps 注入主类持有的协作模块（connectionManager），
 * 不再让主类直接承载这些方法的实现细节。
 */
import { useI18nGlobal } from '@/services/i18n'
import type { ICreateRoomOpts, MatrixClient, Room } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import type { MatrixConnectionManager } from './MatrixConnectionManager'

const logger = createLogger('MatrixClient')

/** Room 子服务依赖的主类协作模块集合 */
export interface MatrixClientRoomDeps {
  readonly connectionManager: MatrixConnectionManager
}

/** 默认空间管理员（moderator）power level 阈值 */
const DEFAULT_MODERATOR_POWER_LEVEL = 50

/**
 * 房间操作协作类。
 *
 * 不持有自己的可变状态——所有状态都委托给 deps 中的 connectionManager。
 */
export class MatrixClientRoom {
  constructor(private readonly deps: MatrixClientRoomDeps) {}

  /** 获取所有房间列表
   */
  getRooms(): Room[] {
    return this.deps.connectionManager.getClient()?.getRooms() ?? []
  }

  /** 获取指定房间实例
   */
  getRoom(roomId: string): Room | null {
    return this.deps.connectionManager.getClient()?.getRoom(roomId) ?? null
  }

  /** 创建房间
   */
  async createRoom(options: ICreateRoomOpts): Promise<Room> {
    const client = this.deps.connectionManager.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      const response = await client.createRoom(options)
      logger.info(`创建房间成功: ${response.room_id}`)
      // SDK 的 createRoom 只发 HTTP 请求返回 { room_id }，不会立即写入 client.store。
      // 房间进入 store 依赖 sync 循环在后续 sync 响应中处理（sync.ts:1687 storeRoom）。
      // 因此创建后轮询等待 sync 把房间带入 store，而非立即查询（会因时序返回 null）。
      const room = await this.waitForRoom(client, response.room_id, 5000)
      if (!room) {
        throw new Error(useI18nGlobal().t('matrix_error.client.room_instance_failed_after_create'))
      }
      return room
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      logger.error(`创建房间失败: ${errorMessage}`)
      throw err
    }
  }

  /**
   * 轮询等待 client.store 中出现指定 roomId 的 Room 实例。
   *
   * SDK createRoom/joinRoom 返回后，房间不会立即进入 store，必须等 sync 循环处理。
   * 此方法以 100ms 间隔轮询，直到房间出现或超时。
   */
  private async waitForRoom(client: MatrixClient | null, roomId: string, timeoutMs = 5000): Promise<Room | null> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const room = client?.getRoom(roomId)
      if (room) return room
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    return client?.getRoom(roomId) ?? null
  }

  /** 加入房间
   */
  async joinRoom(roomId: string): Promise<Room> {
    const client = this.deps.connectionManager.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      await client.joinRoom(roomId)
      logger.info(`加入房间成功: ${roomId}`)
      // 与 createRoom 同理：joinRoom 返回后房间需等 sync 循环写入 store
      const room = await this.waitForRoom(client, roomId, 5000)
      if (!room) {
        throw new Error(useI18nGlobal().t('matrix_error.client.room_instance_failed_after_join'))
      }
      return room
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : useI18nGlobal().t('matrix_error.client.join_room_failed')
      logger.error(errorMessage)
      throw err
    }
  }

  /** 离开房间
   */
  async leaveRoom(roomId: string): Promise<void> {
    const client = this.deps.connectionManager.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    try {
      await client.leave(roomId)
      logger.info(`离开房间成功: ${roomId}`)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : useI18nGlobal().t('matrix_error.client.leave_room_failed')
      logger.error(errorMessage)
      throw err
    }
  }

  /** 判断当前用户是否有空间管理权限
   */
  canManageSpace(spaceId: string): boolean {
    const client = this.deps.connectionManager.getClient()
    if (!client || !spaceId) return false

    const userId = client.getUserId()
    const room = client.getRoom(spaceId)
    if (!userId || !room || room.getMyMembership?.() !== 'join') {
      return false
    }

    const member = room.getMember(userId) ?? room.currentState?.getMember?.(userId)
    const powerLevel =
      member?.powerLevel ?? (member as { getPowerLevel?: () => number } | undefined)?.getPowerLevel?.() ?? 0
    return powerLevel >= DEFAULT_MODERATOR_POWER_LEVEL
  }
}
