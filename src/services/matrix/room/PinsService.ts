import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('PinsService')

/**
 * Room pinned / sticky events domain service.
 *
 * `pinned` lives on canonical `m.room.pinned_events` state event;
 * `sticky` is a synapse-rust extension exposed via authedRequest.
 * Extracted from `MatrixRoomService` as part of the P1-1 split.
 */
export class MatrixRoomPinsService extends BaseMatrixService {
  async getPinnedEvents(roomId: string): Promise<string[]> {
    const client = this.getClient()
    try {
      const room = client.getRoom(roomId)
      if (!room) return []
      const pinEvent = room.currentState?.getStateEvents?.('m.room.pinned_events', '')
      const content = pinEvent?.getContent?.() as { pinned?: string[] } | undefined
      return content?.pinned ?? []
    } catch (err) {
      logger.error(`[MatrixRoom] 获取置顶事件失败: ${err}`)
      return []
    }
  }

  async setPinnedEvents(roomId: string, eventIds: string[]): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('pin', roomId, { roomId, type: 'pinned', eventIds })
      logger.info(`[MatrixRoom] 离线状态，已将设置置顶事件入队: ${roomId}`)
      return
    }
    const client = this.getClient()
    try {
      await client.sendStateEvent(roomId, 'm.room.pinned_events', { pinned: eventIds }, '')
      logger.info(`[MatrixRoom] 设置置顶事件成功: ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 设置置顶事件失败: ${err}`)
      throw err
    }
  }

  async pinEvent(roomId: string, eventId: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('pin', roomId, { roomId, type: 'pin', eventId })
      logger.info(`[MatrixRoom] 离线状态，已将置顶事件入队: ${roomId}`)
      return
    }
    try {
      // 使用 state event 方式置顶：获取当前置顶列表，添加新事件，发送 m.room.pinned_events
      const pinnedEvents = await this.getPinnedEvents(roomId)
      if (!pinnedEvents.includes(eventId)) {
        pinnedEvents.push(eventId)
      }
      await this.setPinnedEvents(roomId, pinnedEvents)
      logger.info(`[MatrixRoom] 置顶事件成功: ${roomId}/${eventId}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 置顶事件失败: ${err}`)
      throw err
    }
  }

  async unpinEvent(roomId: string, eventId: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('pin', roomId, { roomId, type: 'unpin', eventId })
      logger.info(`[MatrixRoom] 离线状态，已将取消置顶事件入队: ${roomId}`)
      return
    }
    try {
      // 使用 state event 方式取消置顶：获取当前置顶列表，移除事件，发送 m.room.pinned_events
      const pinnedEvents = await this.getPinnedEvents(roomId)
      const updatedEvents = pinnedEvents.filter((id) => id !== eventId)
      await this.setPinnedEvents(roomId, updatedEvents)
      logger.info(`[MatrixRoom] 取消置顶事件成功: ${roomId}/${eventId}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 取消置顶事件失败: ${err}`)
      throw err
    }
  }

  async getStickyEvents(roomId: string): Promise<Record<string, unknown>> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/sticky_events`
      )
      return result as Record<string, unknown>
    } catch (err) {
      logger.error(`[MatrixRoom] 获取粘性事件失败: ${err}`)
      return {}
    }
  }

  async setStickyEvents(roomId: string, events: Record<string, unknown>): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('pin', roomId, { roomId, type: 'sticky', events })
      logger.info(`[MatrixRoom] 离线状态，已将设置粘性事件入队: ${roomId}`)
      return
    }
    const client = this.getClient()
    try {
      await client.http.authedRequest(
        'POST',
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/sticky_events`,
        undefined,
        events
      )
      logger.info(`[MatrixRoom] 设置粘性事件成功: ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 设置粘性事件失败: ${err}`)
      throw err
    }
  }
}

export const matrixRoomPinsService = new MatrixRoomPinsService()
