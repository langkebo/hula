import { createLogger } from '@/utils/Logger'
import matrixClientService from '../MatrixClientService'
import { withErrorHandling } from '../utils/withErrorHandling'

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

  async enableBurn(roomId: string, burnAfterMs?: number, throwOnError = false): Promise<BurnSettings | null> {
    const result = await withErrorHandling(
      async () => {
        const manager = this.getManager()
        if (!manager) return null

        const settings = await manager.enableBurn(roomId, burnAfterMs)
        logger.info(`阅后即焚已启用: roomId=${roomId}, burnAfterMs=${settings.burn_after_ms}`)
        return {
          enabled: settings.enabled,
          burnAfterMs: settings.burn_after_ms
        }
      },
      { feature: 'burn.enable', feedback: throwOnError ? 'silent' : 'toast' }
    )
    if (result === undefined) {
      if (throwOnError) throw new Error(`启用阅后即焚失败: roomId=${roomId}`)
      return null
    }
    return result
  }

  async disableBurn(roomId: string, throwOnError = false): Promise<BurnSettings | null> {
    const result = await withErrorHandling(
      async () => {
        const manager = this.getManager()
        if (!manager) return null
        const settings = await manager.disableBurn(roomId)
        logger.info(`阅后即焚已禁用: roomId=${roomId}`)
        return {
          enabled: settings.enabled,
          burnAfterMs: settings.burn_after_ms
        }
      },
      { feature: 'burn.disable', feedback: throwOnError ? 'silent' : 'toast' }
    )
    if (result === undefined) {
      if (throwOnError) throw new Error(`禁用阅后即焚失败: roomId=${roomId}`)
      return null
    }
    return result
  }

  async getBurnSettings(roomId: string, throwOnError = false): Promise<BurnSettings | null> {
    const result = await withErrorHandling(
      async () => {
        const manager = this.getManager()
        if (!manager) return null
        const settings = await manager.getBurnSettings(roomId)
        return {
          enabled: settings.enabled,
          burnAfterMs: settings.burn_after_ms
        }
      },
      { feature: 'burn.status', feedback: 'silent' }
    )
    if (result === undefined) {
      if (throwOnError) throw new Error(`获取阅后即焚设置失败: roomId=${roomId}`)
      return null
    }
    return result
  }

  async isBurnEnabled(roomId: string): Promise<boolean> {
    try {
      const manager = this.getManager()
      if (!manager) return false
      return await manager.isBurnEnabled(roomId)
    } catch {
      return false
    }
  }

  async getPendingBurns(roomId: string, throwOnError = false): Promise<BurnPendingEvent[]> {
    try {
      const manager = this.getManager()
      if (!manager) return []
      const events = await manager.getPendingBurns(roomId)
      return events.map((e: { event_id: string; created_at: number; delete_at: number }) => ({
        eventId: e.event_id,
        createdAt: e.created_at,
        deleteAt: e.delete_at
      }))
    } catch (error) {
      logger.error(`获取待焚毁消息失败: ${error}`)
      if (throwOnError) throw error
      return []
    }
  }

  async markBurnRead(roomId: string, eventId: string, throwOnError = false): Promise<boolean> {
    try {
      const manager = this.getManager()
      if (!manager) return false
      const result = await manager.markBurnRead(roomId, eventId)
      logger.info(`消息已标记已读，触发焚毁: eventId=${eventId}`)
      return result.marked
    } catch (error) {
      logger.error(`标记已读失败: ${error}`)
      if (throwOnError) throw error
      return false
    }
  }

  async cancelBurn(roomId: string, eventId: string, throwOnError = false): Promise<boolean> {
    try {
      const manager = this.getManager()
      if (!manager) return false
      const result = await manager.cancelBurn(roomId, eventId)
      logger.info(`已取消焚毁: eventId=${eventId}`)
      return result.cancelled
    } catch (error) {
      logger.error(`取消焚毁失败: ${error}`)
      if (throwOnError) throw error
      return false
    }
  }

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
        expires_in: expiresIn,
        encrypt
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
export default matrixBurnAfterReadService
