import { error, info, warn } from '@tauri-apps/plugin-log'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import { BaseMatrixService } from '../BaseMatrixService'

/**
 * Room tags domain service.
 *
 * Extracted from `MatrixRoomService` as part of the P1-1 split. The facade
 * keeps method signatures for backwards compatibility and forwards here.
 */
export class MatrixRoomTagsService extends BaseMatrixService {
  private tagsUnsupported = false
  private unsupportedLogged = false

  async getTags(roomId: string): Promise<Record<string, { order?: number }>> {
    if (this.tagsUnsupported) {
      return {}
    }

    const client = this.getClient()
    try {
      const result = await client.getRoomTags(roomId)
      return result.tags ?? {}
    } catch (err) {
      if (this.isTagsUnsupportedError(err)) {
        this.tagsUnsupported = true
        if (!this.unsupportedLogged) {
          warn('[MatrixRoom] 当前服务端未提供 room tags 接口，后续跳过标签拉取')
          this.unsupportedLogged = true
        }
        return {}
      }
      // 标签获取失败不输出日志，避免 429 限流时刷屏
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
      if (!client.getUserId()) throw new Error(this.t('matrix_error.common.user_not_logged_in'))
      await client.setRoomTag(roomId, tag, order !== undefined ? { order } : {})
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
      if (!client.getUserId()) throw new Error(this.t('matrix_error.common.user_not_logged_in'))
      await client.deleteRoomTag(roomId, tag)
      info(`[MatrixRoom] 移除标签成功: ${roomId}/${tag}`)
    } catch (err) {
      error(`[MatrixRoom] 移除标签失败: ${err}`)
      throw err
    }
  }

  private isTagsUnsupportedError(err: unknown): boolean {
    const candidate = err as {
      errcode?: string
      httpStatus?: number
      statusCode?: number
      message?: string
    }

    return (
      candidate?.errcode === 'M_UNRECOGNIZED' ||
      candidate?.errcode === 'M_NOT_FOUND' ||
      candidate?.httpStatus === 404 ||
      candidate?.statusCode === 404 ||
      candidate?.message?.includes('404') === true
    )
  }
}

export const matrixRoomTagsService = new MatrixRoomTagsService()
