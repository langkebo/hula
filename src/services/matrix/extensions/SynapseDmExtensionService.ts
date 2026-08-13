import { createLogger } from '@/utils/Logger'
import { MATRIX_PATHS } from '../paths'
import { SynapseExtensionHttpBase } from './SynapseExtensionHttpBase'

const logger = createLogger('SynapseDmExtensionService')

export interface SynapseCreateDmResult {
  room_id: string
  created: boolean
}

export interface SynapseDmInfo {
  room_id: string
  exists: boolean
}

/**
 * synapse-rust 私聊（DM）扩展端点。
 * 从 SynapseRustExtensionsService 拆分而来。
 * 注意：服务端 DM 端点挂在 friends 路径命名空间下（MATRIX_PATHS.FRIENDS.DM）。
 */
class SynapseDmExtensionService extends SynapseExtensionHttpBase {
  /** 创建私信对话
   */
  async createPrivateDm(userId: string, isPrivate = true): Promise<SynapseCreateDmResult> {
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
   */
  async getDmRoom(userId: string): Promise<SynapseDmInfo> {
    try {
      const response = await this.request<SynapseDmInfo | { data?: SynapseDmInfo }>(
        MATRIX_PATHS.FRIENDS.DM(encodeURIComponent(userId)),
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      return data || { room_id: '', exists: false }
    } catch (err) {
      logger.error(`[SynapseRust] 获取私信房间失败: ${err}`)
      return { room_id: '', exists: false }
    }
  }
}

export const synapseDmExtensionService = new SynapseDmExtensionService()
