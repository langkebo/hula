import { createLogger } from '@/utils/Logger'
import matrixClientService from '../MatrixClientService'

const logger = createLogger('BurnAfterRead')

export interface BurnSettings {
  enabled: boolean
  burnAfterMs: number
}

export interface BurnStats {
  totalBurned: number
  totalPending: number
  roomsWithBurnEnabled: number
}

export interface BurnPendingEvent {
  eventId: string
  createdAt: number
  deleteAt: number
}

export interface BurnMessageResponse {
  eventId: string
  expiresIn: number
  expiresAt: number
}

class MatrixBurnAfterReadService {
  private getManager() {
    const client = matrixClientService.getClient()
    if (!client) {
      logger.warn('[BurnAfterRead] Matrix client not initialized, manager unavailable.')
      return null
    }
    return client.getBurnAfterReadManager()
  }

  /**
   * 为房间启用阅后即焚（可指定时长）；未初始化或失败时返回 null。
   */
  async enableBurn(roomId: string, burnAfterMs?: number, throwOnError = false): Promise<BurnSettings | null> {
    try {
      const manager = this.getManager()
      if (!manager) return null

      const settings = await manager.enableBurn(roomId, burnAfterMs)
      logger.info(`阅后即焚已启用: roomId=${roomId}, burnAfterMs=${settings.burn_after_ms}`)
      return {
        enabled: settings.enabled,
        burnAfterMs: settings.burn_after_ms
      }
    } catch (error) {
      logger.error(`启用阅后即焚失败: ${error}`)
      if (throwOnError) throw error
      return null
    }
  }

  /**
   * 关闭房间的阅后即焚。
   */
  async disableBurn(roomId: string, throwOnError = false): Promise<BurnSettings | null> {
    try {
      const manager = this.getManager()
      if (!manager) return null
      const settings = await manager.disableBurn(roomId)
      logger.info(`阅后即焚已禁用: roomId=${roomId}`)
      return {
        enabled: settings.enabled,
        burnAfterMs: settings.burn_after_ms
      }
    } catch (error) {
      logger.error(`禁用阅后即焚失败: ${error}`)
      if (throwOnError) throw error
      return null
    }
  }

  /**
   * 读取房间的焚毁设置（是否启用、时长）。
   */
  async getBurnSettings(roomId: string, throwOnError = false): Promise<BurnSettings | null> {
    try {
      const manager = this.getManager()
      if (!manager) return null
      const settings = await manager.getBurnSettings(roomId)
      return {
        enabled: settings.enabled,
        burnAfterMs: settings.burn_after_ms
      }
    } catch (error) {
      logger.error(`获取阅后即焚设置失败: ${error}`)
      if (throwOnError) throw error
      return null
    }
  }

  /**
   * 判断房间是否启用焚毁；与 `getBurnSettings` 同源，但只返回开关。
   */
  async isBurnEnabled(roomId: string, throwOnError = false): Promise<boolean> {
    try {
      const manager = this.getManager()
      if (!manager) return false
      return await manager.isBurnEnabled(roomId)
    } catch (error) {
      // FT-131-A: 安全特性不能静默吞错，必须记录日志以便排查鉴权失败/服务异常
      logger.error(`检查阅后即焚状态失败 (isBurnEnabled): roomId=${roomId}, error=${error}`)
      if (throwOnError) throw error
      return false
    }
  }

  /**
   * 列出待焚毁消息及其到期时间。
   */
  async getPendingBurns(roomId: string, throwOnError = false): Promise<BurnPendingEvent[]> {
    try {
      const manager = this.getManager()
      if (!manager) return []
      const events = await manager.getPendingBurns(roomId)
      return events.map((e) => ({
        eventId: e.event_id,
        createdAt: e.created_at,
        deleteAt: e.delete_ts
      }))
    } catch (error) {
      logger.error(`获取待焚毁消息失败: ${error}`)
      if (throwOnError) throw error
      return []
    }
  }

  /**
   * 把消息标记为已读，触发倒计时（到期后由焚毁流程处理）。
   */
  async markBurnRead(roomId: string, eventId: string, throwOnError = false): Promise<boolean> {
    try {
      const manager = this.getManager()
      if (!manager) return false
      const result = await manager.markBurnRead(roomId, eventId)
      logger.info(`消息已标记已读，触发焚毁: eventId=${eventId}`)
      return result.success
    } catch (error) {
      logger.error(`标记已读失败: ${error}`)
      if (throwOnError) throw error
      return false
    }
  }

  /**
   * 取消某条消息的待焚毁状态。
   */
  async cancelBurn(roomId: string, eventId: string, throwOnError = false): Promise<boolean> {
    try {
      const manager = this.getManager()
      if (!manager) return false
      const result = await manager.cancelBurn(roomId, eventId)
      logger.info(`已取消焚毁: eventId=${eventId}`)
      return result.success
    } catch (error) {
      logger.error(`取消焚毁失败: ${error}`)
      if (throwOnError) throw error
      return false
    }
  }

  /**
   * 设置全局默认焚毁时长（毫秒），返回服务端生效值。
   */
  async setBurnConfig(defaultBurnMs: number, throwOnError = false): Promise<number | null> {
    try {
      const manager = this.getManager()
      if (!manager) return null
      const result = await manager.setBurnConfig(defaultBurnMs)
      logger.info(`全局默认焚毁时间已设置: ${result.default_burn_ms}ms`)
      return result.default_burn_ms
    } catch (error) {
      logger.error(`设置全局配置失败: ${error}`)
      if (throwOnError) throw error
      return null
    }
  }

  /**
   * 取焚毁统计：累计焚毁数、待处理数、启用焚毁的房间数。
   */
  async getBurnStats(throwOnError = false): Promise<BurnStats> {
    try {
      const manager = this.getManager()
      if (!manager) return { totalBurned: 0, totalPending: 0, roomsWithBurnEnabled: 0 }
      const stats = await manager.getBurnStats()
      return {
        totalBurned: stats.total_burned,
        totalPending: stats.total_pending,
        roomsWithBurnEnabled: stats.rooms_with_burn_enabled
      }
    } catch (error) {
      logger.error(`获取焚毁统计失败: ${error}`)
      if (throwOnError) throw error
      return { totalBurned: 0, totalPending: 0, roomsWithBurnEnabled: 0 }
    }
  }

  async sendMessage(
    roomId: string,
    content: Record<string, unknown>,
    expiresIn?: number,
    encrypt?: boolean,
    throwOnError = false
  ): Promise<BurnMessageResponse | null> {
    try {
      const manager = this.getManager()
      if (!manager) return null
      const result = await manager.sendMessage({
        room_id: roomId,
        content,
        ...(expiresIn !== undefined ? { expires_in: expiresIn } : {}),
        ...(encrypt !== undefined ? { encrypt } : {})
      })
      logger.info(`阅后即焚消息已发送: eventId=${result.event_id}, expiresIn=${result.expires_in}ms`)
      return {
        eventId: result.event_id,
        expiresIn: result.expires_in,
        expiresAt: result.expires_at
      }
    } catch (error) {
      logger.error(`发送阅后即焚消息失败: ${error}`)
      if (throwOnError) throw error
      return null
    }
  }

  /**
   * 立即焚毁该消息。
   * 后端只登记 per-user 销毁时间、**不做 redact**，所以这里的「焚毁」在本地是遮罩语义，不是物理删除。
   */
  async burnMessage(eventId: string, throwOnError = false): Promise<boolean> {
    try {
      const manager = this.getManager()
      if (!manager) return false
      await manager.burnMessage(eventId)
      logger.info(`消息已焚毁: eventId=${eventId}`)
      return true
    } catch (error) {
      logger.error(`焚毁消息失败: ${error}`)
      if (throwOnError) throw error
      return false
    }
  }

  /**
   * 延长某条消息的焚毁时间（毫秒）。
   */
  async extendBurnTime(eventId: string, additionalTime: number, throwOnError = false): Promise<boolean> {
    try {
      const manager = this.getManager()
      if (!manager) return false
      await manager.extendBurnTime(eventId, additionalTime)
      logger.info(`焚毁时间已延长: eventId=${eventId}, +${additionalTime}ms`)
      return true
    } catch (error) {
      logger.error(`延长焚毁时间失败: ${error}`)
      if (throwOnError) throw error
      return false
    }
  }
}

export const matrixBurnAfterReadService = new MatrixBurnAfterReadService()
