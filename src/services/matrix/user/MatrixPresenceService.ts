/**
 * Matrix 在线状态服务
 *
 * 提供在线状态设置、查询、订阅等功能
 * 参考 API 契约: presence.md
 */

import { info, error } from '@tauri-apps/plugin-log'
import matrixClientService from '../MatrixClientService'
import type { MatrixClient, PresenceManager } from 'matrix-js-sdk'

/**
 * 在线状态类型
 */
export type PresenceState = 'online' | 'offline' | 'unavailable'

/**
 * 在线状态信息
 */
export interface PresenceInfo {
  user_id: string
  presence: PresenceState
  status_msg?: string | null
  last_active_ago?: number
  currently_active?: boolean
}

/**
 * 在线状态列表响应
 */
export interface PresenceListResponse {
  presences: PresenceInfo[]
}

/**
 * 在线状态服务
 */
class MatrixPresenceService {
  /**
   * 获取客户端实例
   */
  private getClient(): MatrixClient {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('MatrixClient 未初始化')
    }
    return client
  }

  /**
   * 设置在线状态
   *
   * @param presence 在线状态
   * @param statusMsg 状态消息（可选）
   */
  async setPresence(presence: PresenceState, statusMsg?: string): Promise<void> {
    try {
      const client = this.getClient()
      const presenceManager = client.getPresenceManager() as PresenceManager | null
      const userId = client.getUserId()

      if (!userId) {
        throw new Error('用户 ID 未找到')
      }

      if (presenceManager) {
        await presenceManager.setPresence(userId, presence, statusMsg)
        info(`[Presence] 设置在线状态成功: ${presence}`)
      } else {
        await client.http.authedRequest(
          'PUT',
          `/_matrix/client/v3/presence/${encodeURIComponent(userId)}/status`,
          undefined,
          {
            presence,
            status_msg: statusMsg
          }
        )
        info(`[Presence] 设置在线状态成功: ${presence}`)
      }
    } catch (err) {
      error(`[Presence] 设置在线状态失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取用户在线状态
   *
   * @param userId 用户 ID
   */
  async getPresence(userId: string): Promise<PresenceInfo> {
    try {
      const client = this.getClient()
      const presenceManager = client.getPresenceManager() as PresenceManager | null

      if (presenceManager) {
        const presence = await presenceManager.getPresence(userId)
        info(`[Presence] 获取在线状态成功: ${userId}`)
        return {
          user_id: userId,
          presence: (presence.presence || 'offline') as PresenceState,
          status_msg: presence.status_msg,
          last_active_ago: presence.last_active_ago,
          currently_active: presence.currently_active
        }
      } else {
        const response = (await client.http.authedRequest(
          'GET',
          `/_matrix/client/v3/presence/${encodeURIComponent(userId)}/status`
        )) as Omit<PresenceInfo, 'user_id'>
        info(`[Presence] 获取在线状态成功: ${userId}`)
        return {
          user_id: userId,
          ...response
        }
      }
    } catch (err) {
      error(`[Presence] 获取在线状态失败: ${userId}, ${err}`)
      throw err
    }
  }

  /**
   * 获取当前用户在线状态
   */
  async getCurrentPresence(): Promise<PresenceInfo> {
    try {
      const client = this.getClient()
      const userId = client.getUserId()

      if (!userId) {
        throw new Error('用户 ID 未找到')
      }

      return await this.getPresence(userId)
    } catch (err) {
      error(`[Presence] 获取当前用户在线状态失败: ${err}`)
      throw err
    }
  }

  /**
   * 订阅用户在线状态
   *
   * @param userIds 要订阅的用户 ID 列表
   */
  async subscribeToPresence(userIds: string[]): Promise<PresenceListResponse> {
    try {
      const client = this.getClient()
      const presenceManager = client.getPresenceManager() as PresenceManager | null

      if (presenceManager) {
        const result = await presenceManager.subscribeToPresence(userIds)
        info(`[Presence] 订阅在线状态成功: ${userIds.length} 个用户`)
        return result as PresenceListResponse
      } else {
        const response = (await client.http.authedRequest('POST', '/_matrix/client/v3/presence/list', undefined, {
          subscribe: userIds
        })) as PresenceListResponse
        info(`[Presence] 订阅在线状态成功: ${userIds.length} 个用户`)
        return response
      }
    } catch (err) {
      error(`[Presence] 订阅在线状态失败: ${err}`)
      throw err
    }
  }

  /**
   * 取消订阅用户在线状态
   *
   * @param userIds 要取消订阅的用户 ID 列表
   */
  async unsubscribeFromPresence(userIds: string[]): Promise<void> {
    try {
      const client = this.getClient()
      const presenceManager = client.getPresenceManager() as PresenceManager | null

      if (presenceManager) {
        await presenceManager.unsubscribeFromPresence(userIds)
        info(`[Presence] 取消订阅在线状态成功: ${userIds.length} 个用户`)
      } else {
        await client.http.authedRequest('POST', '/_matrix/client/v3/presence/list', undefined, { unsubscribe: userIds })
        info(`[Presence] 取消订阅在线状态成功: ${userIds.length} 个用户`)
      }
    } catch (err) {
      error(`[Presence] 取消订阅在线状态失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取在线状态列表
   *
   * @param userId 用户 ID（可选，默认为当前用户）
   */
  async getPresenceList(userId?: string): Promise<PresenceListResponse> {
    try {
      const client = this.getClient()
      const presenceManager = client.getPresenceManager() as PresenceManager | null
      const targetUserId = userId || client.getUserId()

      if (!targetUserId) {
        throw new Error('用户 ID 未找到')
      }

      if (presenceManager) {
        const result = await presenceManager.getPresenceList(targetUserId)
        info(`[Presence] 获取在线状态列表成功: ${targetUserId}`)
        return result as PresenceListResponse
      } else {
        const response = (await client.http.authedRequest(
          'GET',
          `/_matrix/client/v3/presence/list/${encodeURIComponent(targetUserId)}`
        )) as PresenceListResponse
        info(`[Presence] 获取在线状态列表成功: ${targetUserId}`)
        return response
      }
    } catch (err) {
      error(`[Presence] 获取在线状态列表失败: ${err}`)
      throw err
    }
  }

  /**
   * 批量获取用户在线状态（并行）
   *
   * @param userIds 用户 ID 列表
   */
  async getBatchPresence(userIds: string[]): Promise<PresenceInfo[]> {
    if (userIds.length === 0) return []

    try {
      // 并行获取所有用户状态
      const promises = userIds.map((userId) =>
        this.getPresence(userId).catch((err) => {
          error(`[Presence] 获取用户 ${userId} 在线状态失败: ${err}`)
          return null
        })
      )

      const results = await Promise.all(promises)
      const presences = results.filter((p): p is PresenceInfo => p !== null)

      info(`[Presence] 批量获取在线状态成功: ${presences.length}/${userIds.length}`)
      return presences
    } catch (err) {
      error(`[Presence] 批量获取在线状态失败: ${err}`)
      throw err
    }
  }
}

/**
 * 单例实例
 */
export const matrixPresenceService = new MatrixPresenceService()

/**
 * 初始化在线状态服务
 */
export function initializePresenceService(): void {
  const client = matrixClientService.getClient()
  if (!client) {
    return
  }
  info('[Presence] 服务已就绪')
}

export default matrixPresenceService
