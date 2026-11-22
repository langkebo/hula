/**
 * 邀请名单服务（Admin）
 *
 * 房间级黑白名单复用 SDK `InviteBlocklistManager`；全局黑白名单复用 SDK
 * `AdminManager.config`（`/_synapse/admin/v1/invite/{allowlist,blocklist}`），
 * 均不另建 HTTP 调用（R1）。
 *
 * 房间路由（后端 vendor 前缀 `/_matrix/vendor/v1/rooms/{room_id}`）：
 *   GET  /invite_blocklist   读取黑名单
 *   POST /invite_blocklist   整体替换黑名单
 *   GET  /invite_allowlist   读取白名单
 *   POST /invite_allowlist   整体替换白名单
 *
 * 全局路由（`/_synapse/admin/v1/invite`，8 条端点）：
 *   GET    /allowlist              读取全局白名单
 *   POST   /allowlist              整体替换全局白名单
 *   GET    /blocklist              读取全局黑名单
 *   POST   /blocklist              整体替换全局黑名单
 *   POST   /allowlist/{userId}     加入全局白名单
 *   DELETE /allowlist/{userId}     移出全局白名单
 *   POST   /blocklist/{userId}     加入全局黑名单
 *   DELETE /blocklist/{userId}     移出全局黑名单
 *
 * 注意：房间级 POST 是**整体替换**语义，不是增量追加。页面需先读取再全量提交，
 * 避免「读-改-写」之间丢失他人并发修改；全局名单默认使用增量接口，可安全逐条增删，
 * 批量替换场景才走 `setGlobalList`。
 */
import type { AdminConfigManager, InviteBlocklistManager } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('AdminInvitePolicy')

/** 黑名单写入结果。 */
type InviteBlocklistResponse = Awaited<ReturnType<InviteBlocklistManager['setBlocklist']>>

/** 白名单写入结果。 */
type InviteAllowlistResponse = Awaited<ReturnType<InviteBlocklistManager['setAllowlist']>>

/** 全局邀请名单类别。 */
export type GlobalInviteListKind = 'allowlist' | 'blocklist'

/** 全局邀请名单整体替换结果。 */
type GlobalInviteListWriteResult = Awaited<ReturnType<AdminConfigManager['setInviteAllowlist']>>

/** 全局邀请名单快照。 */
interface GlobalInviteLists {
  allowlist: string[]
  blocklist: string[]
}

/** 房间与全局邀请黑白名单维护。 */
export class AdminInvitePolicyService extends BaseMatrixService {
  private getManager() {
    return this.getClient().getInviteBlocklistManager()
  }

  private getGlobalConfig() {
    return this.getClient().getAdminManager().config
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

  /** 读取全局白名单与黑名单。 */
  async getGlobalLists(): Promise<GlobalInviteLists> {
    try {
      const config = this.getGlobalConfig()
      const [allow, block] = await Promise.all([config.getInviteAllowlist(), config.getInviteBlocklist()])
      return {
        allowlist: allow?.allowlist ?? [],
        blocklist: block?.blocklist ?? []
      }
    } catch (err) {
      logger.error(`[AdminInvitePolicy] getGlobalLists 失败: ${err}`)
      throw err
    }
  }

  /** 整体替换全局白名单或黑名单（`POST /invite/{allowlist,blocklist}`）。 */
  async setGlobalList(kind: GlobalInviteListKind, userIds: string[]): Promise<GlobalInviteListWriteResult> {
    try {
      const config = this.getGlobalConfig()
      if (kind === 'allowlist') {
        return await config.setInviteAllowlist(userIds)
      }
      return await config.setInviteBlocklist(userIds)
    } catch (err) {
      logger.error(`[AdminInvitePolicy] setGlobalList(${kind}) 失败: ${err}`)
      throw err
    }
  }

  /** 将用户加入全局白名单或黑名单（服务端保证两侧互斥）。 */
  async addGlobalUser(kind: GlobalInviteListKind, userId: string): Promise<void> {
    try {
      const config = this.getGlobalConfig()
      if (kind === 'allowlist') {
        await config.addToInviteAllowlist(userId)
        return
      }
      await config.addToInviteBlocklist(userId)
    } catch (err) {
      logger.error(`[AdminInvitePolicy] addGlobalUser(${kind}) 失败: ${err}`)
      throw err
    }
  }

  /** 将用户从全局白名单或黑名单移除。 */
  async removeGlobalUser(kind: GlobalInviteListKind, userId: string): Promise<void> {
    try {
      const config = this.getGlobalConfig()
      if (kind === 'allowlist') {
        await config.removeFromInviteAllowlist(userId)
        return
      }
      await config.removeFromInviteBlocklist(userId)
    } catch (err) {
      logger.error(`[AdminInvitePolicy] removeGlobalUser(${kind}) 失败: ${err}`)
      throw err
    }
  }
}

export const adminInvitePolicyService = new AdminInvitePolicyService()
