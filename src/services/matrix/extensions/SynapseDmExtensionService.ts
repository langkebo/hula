import { createLogger } from '@/utils/Logger'
import { MATRIX_PATHS } from '../paths'
import { SynapseExtensionHttpBase } from './SynapseExtensionHttpBase'

const logger = createLogger('SynapseDmExtensionService')

interface SynapseCreateDmResult {
  room_id: string
  created: boolean
}

export interface SynapseDmInfo {
  /** 已存在的 DM 房间；后端无会话时返回 JSON `null`（不是缺字段），故类型含 null */
  room_id: string | null
  /** 由 `room_id` 派生：后端**不返回**该字段（实测 `{room_id, user_id}`） */
  exists: boolean
}

/**
 * synapse-rust 私聊（DM）扩展端点。
 * 从 SynapseRustExtensionsService 拆分而来。
 * 注意：服务端 DM 端点挂在 friends 路径命名空间下（MATRIX_PATHS.FRIENDS.DM）。
 */
class SynapseDmExtensionService extends SynapseExtensionHttpBase {
  /**
   * 创建（或复用）与好友的 DM 房间。
   *
   * ⚠️ `isPrivate` 默认 **false**（与后端 `create_friend_dm` 的 `is_private` 缺省值一致）。
   * 历史上这里是 `true`：后端缺省 false、前端缺省 true，两个默认值相反 ⇒
   * 任何不传参的调用都会静默创建「私密会话」（多写 `history_visibility=invited`、
   * `com.hula.privacy` 与 7 天 retention）。普通「发消息」必须保持非私密。
   */
  async createPrivateDm(userId: string, isPrivate = false): Promise<SynapseCreateDmResult> {
    try {
      const response = await this.request<SynapseCreateDmResult | { data?: SynapseCreateDmResult }>(
        MATRIX_PATHS.FRIENDS.DM(encodeURIComponent(userId)),
        {
          method: 'POST',
          body: JSON.stringify({ is_private: isPrivate })
        }
      )
      const data = this.unwrapMaybeWrappedData(response)
      logger.info(`[SynapseRust] 创建私密私信房间: ${userId}, isPrivate=${isPrivate}`)
      return data || { room_id: '', created: false }
    } catch (err) {
      logger.error(`[SynapseRust] 创建私密私信房间失败: ${err}`)
      throw err
    }
  }

  /** 获取私信房间
   *
   * 后端响应只有 `{room_id, user_id}`，且无会话时 `room_id` 为 `null`；
   * `exists` 由前端派生，避免下游拿到 `undefined`（旧实现恒为 undefined）。
   */
  async getDmRoom(userId: string): Promise<SynapseDmInfo> {
    try {
      const response = await this.request<SynapseDmInfo | { data?: SynapseDmInfo }>(
        MATRIX_PATHS.FRIENDS.DM(encodeURIComponent(userId)),
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      const roomId = data?.room_id ?? null
      return { room_id: roomId || null, exists: Boolean(roomId) }
    } catch (err) {
      logger.error(`[SynapseRust] 获取私信房间失败: ${err}`)
      return { room_id: null, exists: false }
    }
  }
}

export const synapseDmExtensionService = new SynapseDmExtensionService()
