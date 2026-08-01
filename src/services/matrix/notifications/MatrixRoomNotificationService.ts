import { NotificationTypeEnum } from '@/enums'
import { MatrixRequestDeduper } from '@/services/matrix/MatrixRequestDeduper'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { matrixPushService } from './MatrixPushService'

const logger = createLogger('MatrixRoomNotification')
const ROOM_NOTIFICATION_SETTINGS_EVENT = 'hula.room.notification_settings'

/**
 * 契约: GET /_matrix/client/v3/rooms/{room_id}/unread_count
 * 顶层稳定字段 - notification_count, highlight_count
 */
interface RoomUnreadCountPayload {
  notification_count: number
  highlight_count: number
}

interface RoomNotificationSettings {
  shield?: boolean
  muteNotification?: NotificationTypeEnum
}

class MatrixRoomNotificationService extends BaseMatrixService {
  private isUnreadCountSupported = true
  private hasLoggedUnreadCountFallback = false

  private getRoomSettings(roomId: string): RoomNotificationSettings {
    const client = this.getClient()
    const room = client.getRoom(roomId)

    if (!room) {
      return {}
    }

    const content = room.getAccountData(ROOM_NOTIFICATION_SETTINGS_EVENT)?.getContent()
    return (content || {}) as RoomNotificationSettings
  }

  private async saveRoomSettings(roomId: string, updates: RoomNotificationSettings): Promise<void> {
    const client = this.getClient()
    const nextSettings: RoomNotificationSettings = {
      ...this.getRoomSettings(roomId),
      ...updates
    }

    await client.setRoomAccountData(roomId, ROOM_NOTIFICATION_SETTINGS_EVENT, nextSettings as Record<string, unknown>)
  }

  async setRoomNotification(roomId: string, type: NotificationTypeEnum): Promise<void> {
    if (type === NotificationTypeEnum.NOT_DISTURB) {
      await matrixPushService.muteRoom(roomId)
    } else {
      await matrixPushService.unmuteRoom(roomId)
    }

    await this.saveRoomSettings(roomId, {
      muteNotification: type
    })

    logger.info('房间通知设置已更新:', roomId, type)
  }

  async setRoomShield(roomId: string, shield: boolean): Promise<void> {
    await this.saveRoomSettings(roomId, { shield })
    logger.info('房间屏蔽状态已更新:', roomId, shield)
  }

  /**
   * 拉取房间最新未读 / 提及计数
   * 契约 GET /_matrix/client/v3/rooms/{room_id}/unread_count
   */
  async fetchUnreadCount(roomId: string): Promise<RoomUnreadCountPayload | null> {
    if (!roomId || !this.isUnreadCountSupported) return null

    return MatrixRequestDeduper.dedupe(`room-unread-count:${roomId}`, async () => {
      try {
        const client = this.getClient()
        const result = await client.getRoomSummaryManager().getRoomUnreadCount(roomId)

        return {
          notification_count: Number(result.notification_count ?? 0) || 0,
          highlight_count: Number(result.highlight_count ?? 0) || 0
        }
      } catch (err: unknown) {
        // 如果返回 404 (M_NOT_FOUND 或 类似)，说明服务端不支持该扩展接口
        if ((err as { httpStatus?: number })?.httpStatus === 404 || String(err).includes('404')) {
          this.isUnreadCountSupported = false
          if (!this.hasLoggedUnreadCountFallback) {
            this.hasLoggedUnreadCountFallback = true
            logger.info(`[MatrixRoomNotification] 服务端不支持 unread_count 接口，已降级为本地计数: ${roomId}`)
          }
        } else {
          logger.error(`[MatrixRoomNotification] 获取未读计数失败: ${roomId}`, err)
        }
        return null
      }
    })
  }
}

export const matrixRoomNotificationService = new MatrixRoomNotificationService()
