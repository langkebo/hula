import { error, info } from '@tauri-apps/plugin-log'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import { BaseMatrixService } from '../BaseMatrixService'

/**
 * Room tags domain service.
 *
 * Extracted from `MatrixRoomService` as part of the P1-1 split. The facade
 * keeps method signatures for backwards compatibility and forwards here.
 */
export class MatrixRoomTagsService extends BaseMatrixService {
  async getTags(roomId: string): Promise<Record<string, { order?: number }>> {
    const client = this.getClient()
    try {
      const userId = client.getUserId()
      if (!userId) return {}
      const result = await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/user/${encodeURIComponent(userId)}/rooms/${encodeURIComponent(roomId)}/tags`
      )
      return (result as { tags?: Record<string, { order?: number }> }).tags ?? {}
    } catch (err) {
      error(`[MatrixRoom] 获取标签失败: ${err}`)
      return {}
    }
  }

  async setTag(roomId: string, tag: string, order?: number): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('tag', roomId, { roomId, tag, order, action: 'set' })
      info(`[MatrixRoom] 离线状态，已将设置标签入队: ${roomId}/${tag}`)
      return
    }
    const client = this.getClient()
    try {
      const userId = client.getUserId()
      if (!userId) throw new Error('用户未登录')
      const content: Record<string, unknown> = {}
      if (order !== undefined) content.order = order
      await client.http.authedRequest(
        'PUT',
        `/_matrix/client/v3/user/${encodeURIComponent(userId)}/rooms/${encodeURIComponent(roomId)}/tags/${encodeURIComponent(tag)}`,
        undefined,
        content
      )
      info(`[MatrixRoom] 设置标签成功: ${roomId}/${tag}`)
    } catch (err) {
      error(`[MatrixRoom] 设置标签失败: ${err}`)
      throw err
    }
  }

  async removeTag(roomId: string, tag: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('tag', roomId, { roomId, tag, action: 'remove' })
      info(`[MatrixRoom] 离线状态，已将移除标签入队: ${roomId}/${tag}`)
      return
    }
    const client = this.getClient()
    try {
      const userId = client.getUserId()
      if (!userId) throw new Error('用户未登录')
      await client.http.authedRequest(
        'DELETE',
        `/_matrix/client/v3/user/${encodeURIComponent(userId)}/rooms/${encodeURIComponent(roomId)}/tags/${encodeURIComponent(tag)}`
      )
      info(`[MatrixRoom] 移除标签成功: ${roomId}/${tag}`)
    } catch (err) {
      error(`[MatrixRoom] 移除标签失败: ${err}`)
      throw err
    }
  }
}

export const matrixRoomTagsService = new MatrixRoomTagsService()
