import { createLogger } from '@/utils/Logger'
import { PREFIX_V3 } from '../paths'
import { SynapseExtensionHttpBase } from './SynapseExtensionHttpBase'

const logger = createLogger('SynapseInviteListService')

export interface InviteBlocklist {
  blocked_users: string[]
  updated_ts: number
}

export interface InviteAllowlist {
  allowed_users: string[]
  updated_ts: number
}

/**
 * synapse-rust 房间邀请名单扩展（屏蔽列表/白名单）。
 * 从 SynapseRustExtensionsService 拆分而来。
 */
class SynapseInviteListService extends SynapseExtensionHttpBase {
  async getInviteBlocklist(roomId: string): Promise<InviteBlocklist> {
    try {
      const response = await this.request<InviteBlocklist | { data?: InviteBlocklist }>(
        `${PREFIX_V3}/rooms/${encodeURIComponent(roomId)}/invite_blocklist`,
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      logger.info(`[SynapseRust] 获取邀请屏蔽列表成功: roomId=${roomId}`)
      return data || { blocked_users: [], updated_ts: 0 }
    } catch (err) {
      logger.error(`[SynapseRust] 获取邀请屏蔽列表失败: ${err}`)
      return { blocked_users: [], updated_ts: 0 }
    }
  }

  async setInviteBlocklist(roomId: string, userIds: string[]): Promise<void> {
    try {
      await this.request(`${PREFIX_V3}/rooms/${encodeURIComponent(roomId)}/invite_blocklist`, {
        method: 'POST',
        body: JSON.stringify({ user_ids: userIds })
      })
      logger.info(`[SynapseRust] 设置邀请屏蔽列表成功: roomId=${roomId}, count=${userIds.length}`)
    } catch (err) {
      logger.error(`[SynapseRust] 设置邀请屏蔽列表失败: ${err}`)
      throw err
    }
  }

  async getInviteAllowlist(roomId: string): Promise<InviteAllowlist> {
    try {
      const response = await this.request<InviteAllowlist | { data?: InviteAllowlist }>(
        `${PREFIX_V3}/rooms/${encodeURIComponent(roomId)}/invite_allowlist`,
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      logger.info(`[SynapseRust] 获取邀请白名单成功: roomId=${roomId}`)
      return data || { allowed_users: [], updated_ts: 0 }
    } catch (err) {
      logger.error(`[SynapseRust] 获取邀请白名单失败: ${err}`)
      return { allowed_users: [], updated_ts: 0 }
    }
  }

  async setInviteAllowlist(roomId: string, userIds: string[]): Promise<void> {
    try {
      await this.request(`${PREFIX_V3}/rooms/${encodeURIComponent(roomId)}/invite_allowlist`, {
        method: 'POST',
        body: JSON.stringify({ user_ids: userIds })
      })
      logger.info(`[SynapseRust] 设置邀请白名单成功: roomId=${roomId}, count=${userIds.length}`)
    } catch (err) {
      logger.error(`[SynapseRust] 设置邀请白名单失败: ${err}`)
      throw err
    }
  }
}

export const synapseInviteListService = new SynapseInviteListService()
