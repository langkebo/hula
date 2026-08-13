import { useI18nGlobal } from '@/services/i18n'
import { createLogger } from '@/utils/Logger'

import { synapseFriendExtensionService } from '../extensions/SynapseFriendExtensionService'
import { matrixRoomActionFacade } from '../room/ActionFacade'
import type { FriendManagerCompat, FriendStatus } from './friendUtils'
import type { MatrixFriendSync } from './MatrixFriendSync'
import { matrixSpecialFriendService } from './MatrixSpecialFriendService'

const logger = createLogger('MatrixFriendOperations')

/**
 * 承载好友关系操作：发送/接受/取消/拒绝请求、删除好友、设置备注/昵称/状态。
 * 通过构造函数注入 MatrixFriendSync 以获取 FriendManager 访问能力。
 */
export class MatrixFriendOperations {
  constructor(private readonly sync: MatrixFriendSync) {}

  /** 发送好友请求
   */
  async sendFriendRequest(userId: string, reason?: string): Promise<void> {
    const manager = await this.sync.ensureFriendManager(false)

    try {
      if (manager) {
        await manager.sendFriendRequest(userId, reason)
      } else {
        await synapseFriendExtensionService.sendFriendRequest(userId, reason)
      }
      logger.info(`[MatrixFriend] 发送好友请求成功: ${userId}`)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)

      // 409 已存在待处理的好友请求，属于正常业务场景，不应作为错误
      if (errMsg.includes('already exists') || errMsg.includes('M_USER_IN_USE') || errMsg.includes('409')) {
        logger.info(`[MatrixFriend] 好友请求已存在: ${userId}`)
        return
      }

      // FriendManager 失败时降级到 REST API
      if (manager) {
        try {
          await synapseFriendExtensionService.sendFriendRequest(userId, reason)
          logger.info(`[MatrixFriend] 发送好友请求成功(REST降级): ${userId}`)
          return
        } catch (restErr) {
          const restErrMsg = restErr instanceof Error ? restErr.message : String(restErr)
          // REST 降级也返回 409，同样属于正常场景
          if (
            restErrMsg.includes('already exists') ||
            restErrMsg.includes('M_USER_IN_USE') ||
            restErrMsg.includes('409')
          ) {
            logger.info(`[MatrixFriend] 好友请求已存在(REST): ${userId}`)
            return
          }
          logger.error(`[MatrixFriend] REST API 发送好友请求也失败: ${restErr}`)
        }
      }

      // 好友端点不可用时，回退到创建 DM 房间作为添加好友的替代方案
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
   */
  async acceptFriendRequest(userId: string): Promise<void> {
    try {
      const manager = await this.sync.requireFriendManager()
      await manager.acceptFriendRequest(userId)
      logger.info(`[MatrixFriend] 接受好友请求成功: ${userId}`)
    } catch {
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
   */
  async rejectFriendRequest(userId: string): Promise<void> {
    try {
      const manager = await this.sync.requireFriendManager()
      await manager.rejectFriendRequest(userId)
      logger.info(`[MatrixFriend] 拒绝好友请求成功: ${userId}`)
    } catch {
      await synapseFriendExtensionService.declineFriendRequest(userId)
      logger.info(`[MatrixFriend] 拒绝好友请求成功(REST降级): ${userId}`)
    }
  }

  /** 删除好友
   */
  async removeFriend(userId: string): Promise<void> {
    try {
      const manager = await this.sync.requireFriendManager()
      await manager.removeFriend(userId)
      logger.info(`[MatrixFriend] 删除好友成功: ${userId}`)
    } catch {
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
    } catch {
      await synapseFriendExtensionService.setFriendNote(userId, note)
      logger.info(`[MatrixFriend] 设置好友笔记成功(REST降级): ${userId}`)
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
