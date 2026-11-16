/**
 * 用户关系服务（MSC2666 共同房间）。
 *
 * SDK 已提供 `client.getRoomManager().getMutualRooms(userId, { limit, batchToken })`，
 * 本服务只做响应字段映射与错误日志收口，不自行拼协议请求。
 *
 * 注意：查询自己会返回 403，调用方（UI）必须先排除「对方是自己」。
 */

import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('MatrixRelationshipService')

export interface MutualRoomsResult {
  roomIds: string[]
  nextBatchToken?: string
}

export class MatrixRelationshipService extends BaseMatrixService {
  /**
   * 获取与目标用户的共同房间（双方均 joined）。
   *
   * @param userId 目标用户 MXID（不能是自己）
   * @param limit 单页数量，默认 20
   * @param batchToken 上一页返回的 `next_batch_token`
   * @throws 当服务端拒绝（如查询自己 403）或请求失败时抛出，UI 需展示错误态
   */
  async getMutualRooms(userId: string, limit = 20, batchToken?: string): Promise<MutualRoomsResult> {
    if (!userId) {
      throw new Error('getMutualRooms: userId is required')
    }

    try {
      const response = await this.getClient()
        .getRoomManager()
        .getMutualRooms(userId, batchToken ? { limit, batchToken } : { limit })

      const roomIds = response.joined ?? []
      logger.info(`[Relationship] 获取共同房间成功: userId=${userId}, count=${roomIds.length}`)
      return response.next_batch_token ? { roomIds, nextBatchToken: response.next_batch_token } : { roomIds }
    } catch (err) {
      const status = (err as { httpStatus?: number }).httpStatus
      if (status === 403) {
        logger.warn(`[Relationship] 共同房间请求被拒绝(403): userId=${userId}, ${err}`)
      } else {
        logger.error(`[Relationship] 获取共同房间失败: userId=${userId}, ${err}`)
      }
      throw err
    }
  }
}

export const matrixRelationshipService = new MatrixRelationshipService()
