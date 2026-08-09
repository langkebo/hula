import { createLogger } from '@/utils/Logger'
import { PREFIX_V3 } from '../paths'
import { SynapseExtensionHttpBase } from './SynapseExtensionHttpBase'

const logger = createLogger('SynapsePrivacyExtensionService')

export interface BurnStats {
  total_burned: number
  total_pending: number
  rooms_with_burn_enabled: number
}

/**
 * synapse-rust 隐私房间扩展：阅后即焚、防截屏、私密聊天创建。
 * 从 SynapseRustExtensionsService 拆分而来。
 */
class SynapsePrivacyExtensionService extends SynapseExtensionHttpBase {
  async getBurnStats(): Promise<BurnStats> {
    try {
      const response = await this.request<BurnStats | { data?: BurnStats }>(`${PREFIX_V3}/user/burn/stats`, {
        method: 'GET'
      })
      const data = this.unwrapMaybeWrappedData(response)
      logger.info(`[SynapseRust] 获取阅后即焚统计成功: ${JSON.stringify(data)}`)
      return data || { total_burned: 0, total_pending: 0, rooms_with_burn_enabled: 0 }
    } catch (err) {
      logger.error(`[SynapseRust] 获取阅后即焚统计失败: ${err}`)
      return { total_burned: 0, total_pending: 0, rooms_with_burn_enabled: 0 }
    }
  }

  /**
   * 为房间启用阅后即焚功能
   * @param roomId 房间 ID
   * @param enabled 是否启用
   */
  async enableBurnAfterRead(roomId: string, enabled: boolean = true, burnAfterMs?: number): Promise<void> {
    try {
      await this.request(`${PREFIX_V3}/rooms/${encodeURIComponent(roomId)}/burn`, {
        method: 'PUT',
        body: JSON.stringify({ enabled, ...(burnAfterMs !== undefined && { burn_after_ms: burnAfterMs }) })
      })
      logger.info(`[SynapseRust] ${enabled ? '启用' : '禁用'}阅后即焚成功: roomId=${roomId}`)
    } catch (err) {
      logger.error(`[SynapseRust] ${enabled ? '启用' : '禁用'}阅后即焚失败: ${err}`)
      throw err
    }
  }

  /**
   * 检查房间是否启用了阅后即焚
   * @param roomId 房间 ID
   */
  async isBurnAfterReadEnabled(roomId: string): Promise<boolean> {
    try {
      const response = await this.request<{ enabled: boolean } | { data?: { enabled: boolean } }>(
        `${PREFIX_V3}/rooms/${encodeURIComponent(roomId)}/burn`,
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      return data?.enabled || false
    } catch (err) {
      logger.error(`[SynapseRust] 检查阅后即焚状态失败: ${err}`)
      return false
    }
  }

  /**
   * 为房间启用防截屏功能
   * @param roomId 房间 ID
   * @param enabled 是否启用
   */
  async enableAntiScreenshot(roomId: string, enabled: boolean = true): Promise<void> {
    try {
      await this.request(`${PREFIX_V3}/rooms/${encodeURIComponent(roomId)}/anti_screenshot`, {
        method: 'PUT',
        body: JSON.stringify({ enabled })
      })
      logger.info(`[SynapseRust] ${enabled ? '启用' : '禁用'}防截屏成功: roomId=${roomId}`)
    } catch (err) {
      logger.error(`[SynapseRust] ${enabled ? '启用' : '禁用'}防截屏失败: ${err}`)
      throw err
    }
  }

  /**
   * 检查房间是否启用了防截屏
   * @param roomId 房间 ID
   */
  async isAntiScreenshotEnabled(roomId: string): Promise<boolean> {
    try {
      const response = await this.request<{ enabled: boolean } | { data?: { enabled: boolean } }>(
        `${PREFIX_V3}/rooms/${encodeURIComponent(roomId)}/anti_screenshot`,
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      return data?.enabled || false
    } catch (err) {
      logger.error(`[SynapseRust] 检查防截屏状态失败: ${err}`)
      return false
    }
  }

  /**
   * 创建私密聊天房间（同时启用阅后即焚和防截屏）
   * @param userIds 用户 ID 列表
   */
  async createPrivateChat(userIds: string[]): Promise<string> {
    try {
      const response = await this.request<{ room_id: string } | { data?: { room_id: string } }>(
        `${PREFIX_V3}/rooms/create_private`,
        {
          method: 'POST',
          body: JSON.stringify({
            invite: userIds,
            is_direct: userIds.length === 1,
            preset: 'trusted_private_chat',
            initial_state: [
              {
                type: 'm.room.encryption',
                content: {
                  algorithm: 'm.megolm.v1.aes-sha2'
                }
              }
            ]
          })
        }
      )
      const data = this.unwrapMaybeWrappedData(response)
      const roomId = data?.room_id

      if (!roomId) {
        throw new Error(this.t('matrix_error.room.create_failed_no_id'))
      }

      // 启用阅后即焚和防截屏
      await this.enableBurnAfterRead(roomId, true)
      await this.enableAntiScreenshot(roomId, true)

      logger.info(`[SynapseRust] 创建私密聊天成功: roomId=${roomId}`)
      return roomId
    } catch (err) {
      logger.error(`[SynapseRust] 创建私密聊天失败: ${err}`)
      throw err
    }
  }
}

export const synapsePrivacyExtensionService = new SynapsePrivacyExtensionService()
