/**
 * 房间邀请黑白名单服务（Admin）
 *
 * 对应 synapse-rust 的邀请策略端点，全部复用 SDK `InviteBlocklistManager`（R1：不另建 HTTP 调用）。
 *
 * 路由清单（后端 vendor 前缀 `/_matrix/vendor/v1/rooms/{room_id}`）：
 *   GET  /invite_blocklist   读取黑名单
 *   POST /invite_blocklist   整体替换黑名单
 *   GET  /invite_allowlist   读取白名单
 *   POST /invite_allowlist   整体替换白名单
 *
 * 注意：POST 是**整体替换**语义，不是增量追加。页面需先读取再全量提交，
 * 避免「读-改-写」之间丢失他人并发修改。
 */
import type { InviteBlocklistManager } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('AdminInvitePolicy')

/** 黑名单写入结果。 */
export type InviteBlocklistResponse = Awaited<ReturnType<InviteBlocklistManager['setBlocklist']>>

/** 白名单写入结果。 */
export type InviteAllowlistResponse = Awaited<ReturnType<InviteBlocklistManager['setAllowlist']>>

/** 房间邀请黑白名单维护。 */
export class AdminInvitePolicyService extends BaseMatrixService {
  private getManager() {
    return this.getClient().getInviteBlocklistManager()
  }

  /** 读取房间黑名单。 */
  async getBlocklist(roomId: string): Promise<string[]> {
    try {
      return await this.getManager().getBlocklist(roomId)
    } catch (err) {
      logger.error(`[AdminInvitePolicy] getBlocklist 失败: ${err}`)
      throw err
    }
  }

  /** 整体替换房间黑名单。 */
  async setBlocklist(roomId: string, userIds: string[]): Promise<InviteBlocklistResponse> {
    try {
      return await this.getManager().setBlocklist(roomId, userIds)
    } catch (err) {
      logger.error(`[AdminInvitePolicy] setBlocklist 失败: ${err}`)
      throw err
    }
  }

  /** 读取房间白名单。 */
  async getAllowlist(roomId: string): Promise<string[]> {
    try {
      return await this.getManager().getAllowlist(roomId)
    } catch (err) {
      logger.error(`[AdminInvitePolicy] getAllowlist 失败: ${err}`)
      throw err
    }
  }

  /** 整体替换房间白名单。 */
  async setAllowlist(roomId: string, userIds: string[]): Promise<InviteAllowlistResponse> {
    try {
      return await this.getManager().setAllowlist(roomId, userIds)
    } catch (err) {
      logger.error(`[AdminInvitePolicy] setAllowlist 失败: ${err}`)
      throw err
    }
  }
}

export const adminInvitePolicyService = new AdminInvitePolicyService()
