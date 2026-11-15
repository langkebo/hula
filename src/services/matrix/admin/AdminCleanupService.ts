/**
 * 数据库清理服务（Admin）
 *
 * 对应 synapse-rust 的三条清理端点，全部复用 SDK `AdminCleanupManager`（R1：不另建 HTTP 调用）。
 *
 * 路由清单：
 *   DELETE /cleanup/all          全局清理（过期房间数据 + 各类令牌）
 *   DELETE /cleanup/rooms        房间清理（空房间与孤立事件）
 *   DELETE /cleanup/tokens       令牌清理（access / refresh）
 *
 * 三条端点均为破坏性操作，页面侧需二次确认。
 */
import type { AdminCleanupManager } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('AdminCleanup')

/** `DELETE /cleanup/all` 的请求体。 */
export type CleanupAllRequest = NonNullable<Parameters<AdminCleanupManager['all']>[0]>

/** `DELETE /cleanup/all` 的响应。 */
export type CleanupAllResponse = Awaited<ReturnType<AdminCleanupManager['all']>>

/** `DELETE /cleanup/rooms` 的请求体。 */
export type CleanupRoomsRequest = NonNullable<Parameters<AdminCleanupManager['rooms']>[0]>

/** `DELETE /cleanup/rooms` 的响应。 */
export type CleanupRoomsResponse = Awaited<ReturnType<AdminCleanupManager['rooms']>>

/** `DELETE /cleanup/tokens` 的响应。 */
export type CleanupTokensResponse = Awaited<ReturnType<AdminCleanupManager['tokens']>>

/** 数据库清理。 */
export class AdminCleanupService extends BaseMatrixService {
  private getManager() {
    return this.getClient().getAdminManager()
  }

  /** 执行全局清理。 */
  async cleanupAll(payload?: CleanupAllRequest): Promise<CleanupAllResponse> {
    try {
      return await this.getManager().cleanup.all(payload)
    } catch (err) {
      logger.error(`[AdminCleanup] cleanupAll 失败: ${err}`)
      throw err
    }
  }

  /** 执行房间清理。 */
  async cleanupRooms(payload?: CleanupRoomsRequest): Promise<CleanupRoomsResponse> {
    try {
      return await this.getManager().cleanup.rooms(payload)
    } catch (err) {
      logger.error(`[AdminCleanup] cleanupRooms 失败: ${err}`)
      throw err
    }
  }

  /** 执行令牌清理。 */
  async cleanupTokens(): Promise<CleanupTokensResponse> {
    try {
      return await this.getManager().cleanup.tokens()
    } catch (err) {
      logger.error(`[AdminCleanup] cleanupTokens 失败: ${err}`)
      throw err
    }
  }
}

export const adminCleanupService = new AdminCleanupService()
