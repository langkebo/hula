import { info, error } from '@tauri-apps/plugin-log'
import matrixClientService from '../MatrixClientService'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'

/**
 * Room pinned / sticky events domain service.
 *
 * `pinned` lives on canonical `m.room.pinned_events` state event;
 * `sticky` is a synapse-rust extension exposed via authedRequest.
 * Extracted from `MatrixRoomService` as part of the P1-1 split.
 */
export class MatrixRoomPinsService {
  private getClient() {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('[MatrixRoom] 客户端未初始化')
    return client
  }

  async getPinnedEvents(roomId: string): Promise<string[]> {
    const client = this.getClient()
    try {
      const room = client.getRoom(roomId)
      if (!room) return []
      const pinEvent = room.currentState?.getStateEvents?.('m.room.pinned_events', '')
      const content = pinEvent?.getContent?.() as { pinned?: string[] } | undefined
      return content?.pinned ?? []
    } catch (err) {
      error(`[MatrixRoom] 获取置顶事件失败: ${err}`)
      return []
    }
  }

  async setPinnedEvents(roomId: string, eventIds: string[]): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('pin', roomId, { roomId, type: 'pinned', eventIds })
      info(`[MatrixRoom] 离线状态，已将设置置顶事件入队: ${roomId}`)
      return
    }
    const client = this.getClient()
    try {
      await client.sendStateEvent(roomId, 'm.room.pinned_events', { pinned: eventIds }, '')
      info(`[MatrixRoom] 设置置顶事件成功: ${roomId}`)
    } catch (err) {
      error(`[MatrixRoom] 设置置顶事件失败: ${err}`)
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
      error(`[MatrixRoom] 获取粘性事件失败: ${err}`)
      return {}
    }
  }

  async setStickyEvents(roomId: string, events: Record<string, unknown>): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('pin', roomId, { roomId, type: 'sticky', events })
      info(`[MatrixRoom] 离线状态，已将设置粘性事件入队: ${roomId}`)
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
      info(`[MatrixRoom] 设置粘性事件成功: ${roomId}`)
    } catch (err) {
      error(`[MatrixRoom] 设置粘性事件失败: ${err}`)
      throw err
    }
  }
}

export const matrixRoomPinsService = new MatrixRoomPinsService()
