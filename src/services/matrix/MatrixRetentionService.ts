/**
 * Matrix 消息保留服务
 *
 * 提供消息保留策略管理功能
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { info, error } from '@tauri-apps/plugin-log'

/**
 * 消息保留策略
 */
export interface RetentionPolicy {
  /** 最小保留时间 (毫秒) */
  min_lifetime?: number
  /** 最大保留时间 (毫秒) */
  max_lifetime?: number
}

/**
 * 房间保留策略
 */
export interface RoomRetention {
  /** 房间 ID */
  roomId: string
  /** 保留策略 */
  policy?: RetentionPolicy
}

/**
 * 消息保留服务
 */
class RetentionService {
  private client: MatrixClient | null = null

  /**
   * 初始化服务
   */
  initialize(client: MatrixClient): void {
    this.client = client
    info('[Retention] 服务已初始化')
  }

  /**
   * 获取房间保留策略
   */
  async getRoomRetention(roomId: string): Promise<RoomRetention> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    try {
      const policy = await (this.client as any).getRoomStateEvent(roomId, 'm.room.retention', '')

      return {
        roomId,
        policy: policy
          ? {
              min_lifetime: policy.min_lifetime,
              max_lifetime: policy.max_lifetime
            }
          : undefined
      }
    } catch (err) {
      error(`[Retention] 获取保留策略失败: ${err}`)
      return { roomId }
    }
  }

  /**
   * 设置房间保留策略
   */
  async setRoomRetention(roomId: string, policy: RetentionPolicy): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    try {
      await (this.client as any).sendStateEvent(roomId, 'm.room.retention', '', policy)
      info(`[Retention] 设置保留策略成功: ${roomId}`)
    } catch (err) {
      error(`[Retention] 设置保留策略失败: ${err}`)
      throw err
    }
  }

  /**
   * 删除房间保留策略
   */
  async deleteRoomRetention(roomId: string): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    try {
      await (this.client as any).redact(roomId, '')
      info(`[Retention] 删除保留策略成功: ${roomId}`)
    } catch (err) {
      error(`[Retention] 删除保留策略失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取默认保留策略
   */
  async getDefaultRetention(): Promise<RetentionPolicy | null> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    try {
      // 获取服务器默认保留策略
      const config = await (this.client as any).getServerRetention()
      return config || null
    } catch (err) {
      error(`[Retention] 获取默认保留策略失败: ${err}`)
      return null
    }
  }
}

/**
 * 单例实例
 */
export const retentionService = new RetentionService()

/**
 * Vue Composable
 */
import { ref } from 'vue'

export function useRetention() {
  const retention = ref<RoomRetention | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function getRoomRetention(roomId: string) {
    isLoading.value = true
    error.value = null
    try {
      retention.value = await retentionService.getRoomRetention(roomId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取失败'
    } finally {
      isLoading.value = false
    }
  }

  async function setRoomRetention(roomId: string, policy: RetentionPolicy) {
    isLoading.value = true
    error.value = null
    try {
      await retentionService.setRoomRetention(roomId, policy)
      retention.value = { roomId, policy }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '设置失败'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function deleteRoomRetention(roomId: string) {
    isLoading.value = true
    error.value = null
    try {
      await retentionService.deleteRoomRetention(roomId)
      retention.value = null
    } catch (err) {
      error.value = err instanceof Error ? err.message : '删除失败'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  return {
    retention,
    isLoading,
    error,
    getRoomRetention,
    setRoomRetention,
    deleteRoomRetention
  }
}

export default retentionService
