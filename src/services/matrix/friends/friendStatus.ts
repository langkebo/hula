import { createLogger } from '@/utils/Logger'
import { unknownToObject } from '@/utils/typeGuard'
import { synapseFriendExtensionService } from '../extensions/SynapseFriendExtensionService'
import matrixClientService from '../MatrixClientService'
import type { FriendStatus } from './friendUtils'
import { matrixFriendSync } from './MatrixFriendSync'

const logger = createLogger('MatrixFriendStatus')

/** 好友状态详情（与 SDK `FriendStatusInfo` 同形）。 */
export interface FriendStatusInfo {
  user_id: string
  status: string
  is_friend?: boolean
  are_friends?: boolean
}

/**
 * 获取与指定用户的好友关系状态。
 *
 * fail-loud：Manager 与 REST 均失败时向上抛错，不把「查询失败」伪装成
 * 「无好友关系」（null）。仅「无 client」与「关系确实不存在」返回 null。
 */
export async function fetchFriendStatus(userId: string): Promise<FriendStatus | null> {
  if (!matrixClientService.getClient()) return null

  const manager = await matrixFriendSync.ensureFriendManager(false)
  if (manager && typeof manager.getFriendStatus === 'function') {
    try {
      const status = await manager.getFriendStatus(userId)
      logger.info(`[MatrixFriend] 获取好友状态成功: ${userId}`)
      return (status as FriendStatus | undefined) ?? null
    } catch (err) {
      logger.error(`[MatrixFriend] FriendManager 获取好友状态失败，回退到 REST API: ${err}`)
    }
  }

  // REST 失败直接抛出（fail-loud），由调用方决定降级展示；不再吞成 null。
  const result = await synapseFriendExtensionService.checkFriendship(userId)
  return result ? 'accepted' : null
}

/**
 * 获取指定好友的状态详情。
 *
 * 失败语义为 fail-loud：SDK 调用失败时向上抛错。仅「无 client」与
 * 「FriendManager 未提供该接口」返回 null。
 */
export async function fetchFriendStatusInfo(userId: string): Promise<FriendStatusInfo | null> {
  const client = matrixClientService.getClient()
  if (!client) return null
  const friendManager = client.getFriendManager()
  if (!friendManager?.getFriendStatusInfo) return null

  const result = await friendManager.getFriendStatusInfo(userId)
  logger.info(`[MatrixFriend] 获取好友状态详情成功: ${userId}`)
  return unknownToObject<FriendStatusInfo>(result)
}
