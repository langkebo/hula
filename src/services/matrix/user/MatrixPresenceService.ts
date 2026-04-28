/**
 * Matrix 在线状态服务
 *
 * 提供在线状态设置、查询、订阅等功能
 * 参考 API 契约: presence.md
 */

import { info, error } from '@tauri-apps/plugin-log'
import { formatMatrixError } from '@/common/matrixErrorTranslator'
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
  private readonly presenceHandlers = new Set<(info: PresenceInfo) => void>()
  private registeredPresenceClient: MatrixClient | null = null
  private clientPresenceListener:
    | ((
        event: unknown,
        user: {
          userId: string
          presence?: string
          presenceStatusMsg?: string
          lastActiveAgo?: number
          currentlyActive?: boolean
        }
      ) => void)
    | null = null
  private pendingPresenceRegistration: Promise<void> | null = null

  /**
   * 获取客户端实例
   */
  private async getClient(): Promise<MatrixClient> {
    const client = await matrixClientService.waitForClientReady({
      timeoutMs: 5000
    })
    if (!client) {
      throw new Error('MatrixClient 未初始化')
    }
    return client
  }

  private emitPresence(user: {
    userId: string
    presence?: string
    presenceStatusMsg?: string
    lastActiveAgo?: number
    currentlyActive?: boolean
  }): void {
    if (!user?.userId) return

    const presenceInfo: PresenceInfo = {
      user_id: user.userId,
      presence: (user.presence || 'offline') as PresenceState,
      status_msg: user.presenceStatusMsg ?? null,
      last_active_ago: user.lastActiveAgo,
      currently_active: user.currentlyActive
    }

    for (const handler of this.presenceHandlers) {
      handler(presenceInfo)
    }
  }

  private attachPresenceListener(client: MatrixClient): void {
    if (this.registeredPresenceClient === client && this.clientPresenceListener) {
      return
    }

    if (this.registeredPresenceClient && this.clientPresenceListener) {
      this.registeredPresenceClient.off('User.presence' as never, this.clientPresenceListener as never)
    }

    this.clientPresenceListener = (_event, user) => {
      this.emitPresence(user)
    }

    client.on('User.presence' as never, this.clientPresenceListener as never)
    this.registeredPresenceClient = client
  }

  private ensurePresenceListenerRegistered(): void {
    if (this.presenceHandlers.size === 0) {
      return
    }

    const client = matrixClientService.getClient()
    if (client) {
      this.attachPresenceListener(client)
      return
    }

    if (this.pendingPresenceRegistration) {
      return
    }

    const waitForClientReady = (
      matrixClientService as { waitForClientReady?: typeof matrixClientService.waitForClientReady }
    ).waitForClientReady
    if (typeof waitForClientReady !== 'function') {
      return
    }

    this.pendingPresenceRegistration = waitForClientReady
      .call(matrixClientService, { timeoutMs: 5000 })
      .then((readyClient) => {
        if (this.presenceHandlers.size > 0) {
          this.attachPresenceListener(readyClient)
        }
      })
      .catch(() => {
        // Keep listener registration best-effort during startup.
      })
      .finally(() => {
        this.pendingPresenceRegistration = null
      })
  }

  /**
   * 设置在线状态
   *
   * @param presence 在线状态
   * @param statusMsg 状态消息（可选）
   */
  async setPresence(presence: PresenceState, statusMsg?: string): Promise<void> {
    try {
      const client = await this.getClient()
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
      error(`[Presence] 设置在线状态失败 [${presence}]: ${formatMatrixError(err)}`)
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
      const client = await this.getClient()
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
      error(`[Presence] 获取在线状态失败: ${userId}, ${formatMatrixError(err)}`)
      throw err
    }
  }

  /**
   * 获取当前用户在线状态
   */
  async getCurrentPresence(): Promise<PresenceInfo> {
    try {
      const client = await this.getClient()
      const userId = client.getUserId()

      if (!userId) {
        throw new Error('用户 ID 未找到')
      }

      return await this.getPresence(userId)
    } catch (err) {
      error(`[Presence] 获取当前用户在线状态失败: ${formatMatrixError(err)}`)
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
      const client = await this.getClient()
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
      error(`[Presence] 订阅在线状态失败: ${formatMatrixError(err)}`)
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
      const client = await this.getClient()
      const presenceManager = client.getPresenceManager() as PresenceManager | null

      if (presenceManager) {
        await presenceManager.unsubscribeFromPresence(userIds)
        info(`[Presence] 取消订阅在线状态成功: ${userIds.length} 个用户`)
      } else {
        await client.http.authedRequest('POST', '/_matrix/client/v3/presence/list', undefined, { unsubscribe: userIds })
        info(`[Presence] 取消订阅在线状态成功: ${userIds.length} 个用户`)
      }
    } catch (err) {
      error(`[Presence] 取消订阅在线状态失败: ${formatMatrixError(err)}`)
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
      const client = await this.getClient()
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
      error(`[Presence] 获取在线状态列表失败: ${formatMatrixError(err)}`)
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
          error(`[Presence] 获取用户 ${userId} 在线状态失败: ${formatMatrixError(err)}`)
          return null
        })
      )

      const results = await Promise.all(promises)
      const presences = results.filter((p): p is PresenceInfo => p !== null)

      info(`[Presence] 批量获取在线状态成功: ${presences.length}/${userIds.length}`)
      return presences
    } catch (err) {
      error(`[Presence] 批量获取在线状态失败: ${formatMatrixError(err)}`)
      throw err
    }
  }

  /**
   * 监听 User.presence 事件，实时推送在线状态变化
   *
   * @param handler 状态变化回调
   * @returns 取消监听函数
   */
  onPresenceChange(handler: (info: PresenceInfo) => void): () => void {
    this.presenceHandlers.add(handler)
    this.ensurePresenceListenerRegistered()

    return () => {
      this.presenceHandlers.delete(handler)
      if (this.presenceHandlers.size === 0 && this.registeredPresenceClient && this.clientPresenceListener) {
        this.registeredPresenceClient.off('User.presence' as never, this.clientPresenceListener as never)
        this.registeredPresenceClient = null
        this.clientPresenceListener = null
      }
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
  matrixPresenceService['ensurePresenceListenerRegistered']()
  info('[Presence] 服务已就绪')
}

export default matrixPresenceService
