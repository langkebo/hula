import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('StateService')

/**
 * Room state domain service.
 *
 * Covers room name / topic / avatar / state events / push rules.
 * Extracted from `MatrixRoomService` as part of the P1-1 split.
 */
export class MatrixRoomStateService extends BaseMatrixService {
  async setRoomName(roomId: string, name: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('state', roomId, { roomId, type: 'name', content: name })
      logger.info(`[MatrixRoom] 离线状态，已将设置房间名称入队: ${roomId} -> ${name}`)
      return
    }

    const client = this.getClient()
    try {
      await client.setRoomName(roomId, name)
      logger.info(`[MatrixRoom] 设置房间名称成功: ${roomId} -> ${name}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 设置房间名称失败: ${err}`)
      throw err
    }
  }

  async setRoomTopic(roomId: string, topic: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('state', roomId, { roomId, type: 'topic', content: topic })
      logger.info(`[MatrixRoom] 离线状态，已将设置房间主题入队: ${roomId} -> ${topic}`)
      return
    }

    const client = this.getClient()
    try {
      await client.setRoomTopic(roomId, topic)
      logger.info(`[MatrixRoom] 设置房间主题成功: ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 设置房间主题失败: ${err}`)
      throw err
    }
  }

  async setRoomAvatar(roomId: string, avatarUrl: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('state', roomId, { roomId, type: 'avatar', content: avatarUrl })
      logger.info(`[MatrixRoom] 离线状态，已将设置房间头像入队: ${roomId} -> ${avatarUrl}`)
      return
    }

    const client = this.getClient()
    try {
      await client.sendStateEvent(roomId, 'm.room.avatar', { url: avatarUrl }, '')
      logger.info(`[MatrixRoom] 设置房间头像成功: ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 设置房间头像失败: ${err}`)
      throw err
    }
  }

  async getRoomState(roomId: string): Promise<unknown[]> {
    const client = this.getClient()
    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`房间不存在: ${roomId}`)
      }
      return room.currentState.getStateEvents('*')
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间状态失败: ${err}`)
      throw err
    }
  }

  async setPushRule(roomId: string, enabled: boolean): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('push_rule', roomId, { roomId, enabled })
      logger.info(`[MatrixRoom] 离线状态，已将设置推送规则入队: ${roomId} -> ${enabled}`)
      return
    }

    const client = this.getClient()
    try {
      if (enabled) {
        await client.deletePushRule('global', 'override', roomId)
      } else {
        await client.addPushRule('global', 'override', roomId, {
          conditions: [
            {
              kind: 'event_match',
              key: 'room_id',
              pattern: roomId
            }
          ],
          actions: []
        })
      }
      logger.info(`[MatrixRoom] 设置推送规则成功: ${roomId} -> ${enabled}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 设置推送规则失败: ${err}`)
      throw err
    }
  }
}

export const matrixRoomStateService = new MatrixRoomStateService()
