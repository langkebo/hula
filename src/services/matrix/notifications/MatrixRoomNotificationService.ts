import { NotificationTypeEnum } from '@/enums'
import { createLogger } from '@/utils/Logger'
import { matrixClientService } from '../MatrixClientService'
import { matrixPushService } from './MatrixPushService'

const logger = createLogger('MatrixRoomNotification')
const ROOM_NOTIFICATION_SETTINGS_EVENT = 'hula.room.notification_settings'

interface RoomNotificationSettings {
  shield?: boolean
  muteNotification?: NotificationTypeEnum
}

class MatrixRoomNotificationService {
  private getClient() {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixRoomNotification] 客户端未初始化')
    }
    return client
  }

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
}

export const matrixRoomNotificationService = new MatrixRoomNotificationService()
