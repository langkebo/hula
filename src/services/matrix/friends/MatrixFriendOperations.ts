import { useI18nGlobal } from '@/services/i18n'
import { createLogger } from '@/utils/Logger'

import { synapseFriendExtensionService } from '../extensions/SynapseFriendExtensionService'
import { isConnectionClassError } from '../MatrixRequestHelper'
import { matrixRoomActionFacade } from '../room/RoomFacade'
import { buildFriendRequestIdempotencyKey, type FriendManagerCompat, type FriendStatus } from './friendUtils'
import type { MatrixFriendSync } from './MatrixFriendSync'
import { matrixSpecialFriendService } from './MatrixSpecialFriendService'

const logger = createLogger('MatrixFriendOperations')

/** 「好友请求已存在」这类业务冲突的 errcode 白名单：属于幂等成功，不应重发。 */
const FRIEND_CONFLICT_ERRCODES: ReadonlySet<string> = new Set([
  'M_USER_IN_USE',
  'FRIEND_ALREADY_EXISTS',
  'FRIEND_REQUEST_PENDING'
])

/**
 * 判定「好友请求已存在」这类业务冲突：属于幂等成功，既不应重发也不应报错。
 *
 * 优先读结构化字段（`errcode` / `httpStatus === 409`），仅在结构化字段缺失时回落到
 * message 匹配，以兼容未携带结构化字段的历史错误（审计 §8 B-4 用例 1）。
 */
function isFriendRequestConflict(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const record = err as Error & Record<string, unknown>
  const data = (record.data && typeof record.data === 'object' ? record.data : {}) as Record<string, unknown>
  const errcode =
    typeof record.errcode === 'string' ? record.errcode : typeof data.errcode === 'string' ? data.errcode : ''
  if (FRIEND_CONFLICT_ERRCODES.has(errcode)) return true
  const httpStatus =
    typeof record.httpStatus === 'number'
      ? record.httpStatus
      : typeof data.httpStatus === 'number'
        ? data.httpStatus
        : undefined
  if (httpStatus === 409) return true
  return err.message.includes('already exists') || err.message.includes('M_USER_IN_USE')
}

/**
 * 承载好友关系操作：发送/接受/取消/拒绝请求、删除好友、设置备注/昵称/状态。
 * 通过构造函数注入 MatrixFriendSync 以获取 FriendManager 访问能力。
 */
export class MatrixFriendOperations {
  constructor(private readonly sync: MatrixFriendSync) {}

  /** 发送好友请求
   *
   * 降级策略（审计 §7 批次 B-4 / §8 B-4）：仅当**确证请求未到达服务端**（连接类错误）
   * 时才降级到 REST 重发，并携带确定性幂等键；业务错误（409 等）不降级、视为成功，
   * 以避免首次实际已成功时的重复提交。
   */
  async sendFriendRequest(userId: string, reason?: string): Promise<void> {
    const manager = await this.sync.ensureFriendManager(false)
    const idempotencyKey = buildFriendRequestIdempotencyKey(userId)

    try {
      if (manager) {
        await manager.sendFriendRequest(userId, reason)
      } else {
        await synapseFriendExtensionService.sendFriendRequest(userId, reason, { idempotencyKey })
      }
      logger.info(`[MatrixFriend] 发送好友请求成功: ${userId}`)
    } catch (err) {
      // 业务冲突（已存在待处理请求）属于幂等成功：不重发、不报错
      if (isFriendRequestConflict(err)) {
        logger.info(`[MatrixFriend] 好友请求已存在: ${userId}`)
        return
      }

      // 仅在确证请求未到达服务端（连接类错误）时才降级 REST 重发，并携带同一幂等键
      if (manager && isConnectionClassError(err)) {
        try {
          await synapseFriendExtensionService.sendFriendRequest(userId, reason, { idempotencyKey })
          logger.info(`[MatrixFriend] 发送好友请求成功(REST降级): ${userId}`)
          return
        } catch (restErr) {
          if (isFriendRequestConflict(restErr)) {
            logger.info(`[MatrixFriend] 好友请求已存在(REST): ${userId}`)
            return
          }
          logger.error(`[MatrixFriend] REST API 发送好友请求也失败: ${restErr}`)
        }
      }

      // 好友端点不可用时，回退到创建 DM 房间作为添加好友的替代方案
      const errMsg = err instanceof Error ? err.message : String(err)
      if (errMsg.includes('不可用') || errMsg.includes('unavailable') || errMsg.includes('404')) {
        logger.info(`[MatrixFriend] 好友端点不可用，回退到创建 DM 房间: ${userId}`)
        try {
          await matrixRoomActionFacade.createDirectRoom(userId)
          logger.info(`[MatrixFriend] 已创建 DM 房间作为好友替代: ${userId}`)
          return
        } catch (dmErr) {
          logger.error(`[MatrixFriend] 创建 DM 房间也失败: ${dmErr}`)
        }
      }

      logger.error(`[MatrixFriend] 发送好友请求失败: ${err}`)
      throw err
    }
  }

  /** 接受好友请求
   *
   * 仅在 FriendManager 不可用（未初始化）时 fallback REST，
   * 服务端错误（500 等）不重试，避免双重接受。
   */
  async acceptFriendRequest(userId: string): Promise<void> {
    let sdkFailed = false
    try {
      const manager = await this.sync.requireFriendManager()
      await manager.acceptFriendRequest(userId)
      logger.info(`[MatrixFriend] 接受好友请求成功: ${userId}`)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      // 只有 manager 未初始化时才走 REST 降级
      if (errMsg.includes('not initialized') || errMsg.includes('不可用')) {
        sdkFailed = true
      } else {
        logger.error(`[MatrixFriend] 接受好友请求失败: ${err}`)
        throw err
      }
    }

    if (sdkFailed) {
      await synapseFriendExtensionService.acceptFriendRequest(userId)
      logger.info(`[MatrixFriend] 接受好友请求成功(REST降级): ${userId}`)
    }
  }

  /** 取消好友请求
   */
  async cancelFriendRequest(userId: string): Promise<void> {
    const manager = await this.sync.ensureFriendManager(false)

    try {
      if (manager) {
        await manager.cancelFriendRequest(userId)
        logger.info(`[MatrixFriend] 取消好友请求成功: ${userId}`)
        return
      }
    } catch (err) {
      logger.error(`[MatrixFriend] FriendManager 取消好友请求失败，回退到 REST API: ${err}`)
    }

    // FriendManager 不可用或失败时，回退到 REST API
    try {
      await synapseFriendExtensionService.cancelFriendRequest(userId)
      logger.info(`[MatrixFriend] 取消好友请求成功(REST降级): ${userId}`)
    } catch (restErr) {
      logger.error(`[MatrixFriend] REST API 取消好友请求也失败: ${restErr}`)
      throw restErr
    }
  }

  /** 拒绝好友请求
   *
   * 仅在 FriendManager 不可用时 fallback REST，服务端错误不重试。
   */
  async rejectFriendRequest(userId: string): Promise<void> {
    let sdkFailed = false
    try {
      const manager = await this.sync.requireFriendManager()
      await manager.rejectFriendRequest(userId)
      logger.info(`[MatrixFriend] 拒绝好友请求成功: ${userId}`)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      if (errMsg.includes('not initialized') || errMsg.includes('不可用')) {
        sdkFailed = true
      } else {
        logger.error(`[MatrixFriend] 拒绝好友请求失败: ${err}`)
        throw err
      }
    }

    if (sdkFailed) {
      await synapseFriendExtensionService.declineFriendRequest(userId)
      logger.info(`[MatrixFriend] 拒绝好友请求成功(REST降级): ${userId}`)
    }
  }

  /** 删除好友
   *
   * 仅在 FriendManager 不可用时 fallback REST，服务端错误不重试。
   */
  async removeFriend(userId: string): Promise<void> {
    let sdkFailed = false
    try {
      const manager = await this.sync.requireFriendManager()
      await manager.removeFriend(userId)
      logger.info(`[MatrixFriend] 删除好友成功: ${userId}`)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      if (errMsg.includes('not initialized') || errMsg.includes('不可用')) {
        sdkFailed = true
      } else {
        logger.error(`[MatrixFriend] 删除好友失败: ${err}`)
        throw err
      }
    }

    if (sdkFailed) {
      await synapseFriendExtensionService.removeFriend(userId)
      logger.info(`[MatrixFriend] 删除好友成功(REST降级): ${userId}`)
    }
  }

  /** 设置好友显示名称
   */
  async setFriendDisplayName(userId: string, displayName: string): Promise<void> {
    try {
      const manager = await this.sync.requireFriendManager()
      await manager.setFriendDisplayName(userId, displayName)
      logger.info(`[MatrixFriend] 设置好友备注成功: ${userId}`)
    } catch (err) {
      logger.error(`[MatrixFriend] 设置好友备注失败: ${err}`)
      throw err
    }
  }

  /** 设置好友备注
   */
  async setFriendNote(userId: string, note: string): Promise<void> {
    try {
      const manager = await this.sync.requireFriendManager()
      if (typeof manager.updateFriendNote === 'function') {
        await manager.updateFriendNote(userId, note)
      } else if (typeof manager.setFriendNote === 'function') {
        await manager.setFriendNote(userId, note)
      } else {
        throw new Error(useI18nGlobal().t('matrix_error.friends.remark_update_unsupported'))
      }

      logger.info(`[MatrixFriend] 设置好友笔记成功: ${userId}`)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      // manager 未初始化或不支持备注功能时 fallback REST
      if (errMsg.includes('not initialized') || errMsg.includes('不可用') || errMsg.includes('unsupported')) {
        await synapseFriendExtensionService.setFriendNote(userId, note)
        logger.info(`[MatrixFriend] 设置好友笔记成功(REST降级): ${userId}`)
      } else {
        logger.error(`[MatrixFriend] 设置好友笔记失败: ${err}`)
        throw err
      }
    }
  }

  /** 设置好友状态
   */
  async setFriendStatus(userId: string, status: FriendStatus): Promise<void> {
    let manager: FriendManagerCompat | null = null

    try {
      if (status === 'favorite') {
        await matrixSpecialFriendService.addSpecialFriend(userId)
        logger.info(`[MatrixFriend] 设置好友状态成功: ${userId} -> ${status}`)
        return
      }

      await matrixSpecialFriendService.removeSpecialFriend(userId)

      // 'accepted' 和 'normal' 是默认关系状态，无需调用后端 API
      if (status === 'accepted' || status === 'normal') {
        logger.info(`[MatrixFriend] 设置好友状态成功（本地默认状态，无需后端调用）: ${userId} -> ${status}`)
        return
      }

      manager = await this.sync.requireFriendManager()
      if (typeof manager?.setFriendStatus !== 'function') {
        throw new Error(useI18nGlobal().t('matrix_error.friends.status_update_unsupported', { status }))
      }

      await manager.setFriendStatus(userId, status)
      logger.info(`[MatrixFriend] 设置好友状态成功: ${userId} -> ${status}`)
    } catch (err) {
      logger.error(`[MatrixFriend] 设置好友状态失败: ${err}`)
      throw err
    }
  }
}
