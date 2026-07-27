/**
 * Matrix 在线状态服务
 *
 * 提供在线状态设置、查询、订阅等功能
 * 参考 API 契约: presence.md
 */

import type { MatrixClient, PresenceManager } from 'matrix-js-sdk'
import { formatMatrixError } from '@/common/matrixErrorTranslator'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { matrixClientService } from '../MatrixClientService'

const logger = createLogger('MatrixPresenceService')

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
class MatrixPresenceService extends BaseMatrixService {
  private readonly presenceHandlers = new Set<(info: PresenceInfo) => void>()
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
    if (this.clientPresenceListener) {
      return
    }

    this.clientPresenceListener = (_event, user) => {
      this.emitPresence(user)
    }

    client.on('User.presence' as never, this.clientPresenceListener as never)
  }

  private ensurePresenceListenerRegistered(): void {
    if (this.presenceHandlers.size === 0) {
      return
    }

    try {
      const client = this.getClient()
      this.attachPresenceListener(client)
    } catch {
      // Ignore initialization error during auto-registration
      if (this.pendingPresenceRegistration) {
        return
      }

      this.pendingPresenceRegistration = matrixClientService
        .waitForClientReady({ timeoutMs: 5000 })
        .then((readyClient) => {
          if (readyClient && this.presenceHandlers.size > 0) {
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
        throw new Error(this.t('matrix_error.common.user_id_not_found'))
      }

      if (presenceManager) {
        await presenceManager.setPresence(presence, statusMsg ?? '')
        logger.info(`[Presence] 设置在线状态成功: ${presence}`)
      } else {
        await client.http.authedRequest('PUT', `/presence/${encodeURIComponent(userId)}/status`, undefined, {
          presence,
          status_msg: statusMsg
        })
        logger.info(`[Presence] 设置在线状态成功: ${presence}`)
      }
    } catch (err) {
      // 页面关闭/登出时 client 可能已销毁，此时设置 unavailable 失败是预期行为，降级为 warn 避免噪音
      const isClientNotReady = err instanceof Error && err.message === '客户端未初始化'
      const isFetchFailed = err instanceof Error && err.message.includes('Failed to fetch')
      if (isClientNotReady || isFetchFailed) {
        logger.warn(`[Presence] 设置在线状态跳过 [${presence}]: ${formatMatrixError(err)}`)
      } else {
        logger.error(`[Presence] 设置在线状态失败 [${presence}]: ${formatMatrixError(err)}`)
      }
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
        if (!presence) {
          return {
            user_id: userId,
            presence: 'offline' as PresenceState,
            status_msg: null,
            last_active_ago: undefined,
            currently_active: undefined
          }
        }
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
          `/presence/${encodeURIComponent(userId)}/status`
        )) as Omit<PresenceInfo, 'user_id'>
        return {
          user_id: userId,
          ...response
        }
      }
    } catch (err) {
      const isForbidden = this.isForbiddenError(err)
      if (isForbidden) {
        logger.info(`[Presence] 无权查看用户 ${userId} 在线状态，降级为离线`)
        return {
          user_id: userId,
          presence: 'offline' as PresenceState,
          status_msg: null,
          last_active_ago: undefined,
          currently_active: undefined
        }
      }
      logger.error(`[Presence] 获取在线状态失败: ${userId}, ${formatMatrixError(err)}`)
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
        throw new Error(this.t('matrix_error.common.user_id_not_found'))
      }

      return await this.getPresence(userId)
    } catch (err) {
      logger.error(`[Presence] 获取当前用户在线状态失败: ${formatMatrixError(err)}`)
      throw err
    }
  }

  /**
   * 订阅用户在线状态
   *
   * @param userIds 要订阅的用户 ID 列表
   */
  async subscribeToPresence(userIds: string[], unsubscribeUserIds?: string[]): Promise<PresenceListResponse> {
    try {
      const client = this.getClient()
      const presenceManager = client.getPresenceManager() as PresenceManager | null

      const payload: Record<string, string[]> = { subscribe: userIds }
      if (unsubscribeUserIds && unsubscribeUserIds.length > 0) {
        payload.unsubscribe = unsubscribeUserIds
      }

      if (presenceManager) {
        const result = await presenceManager.subscribeToPresence(userIds)
        logger.info(
          `[Presence] 订阅在线状态成功: ${userIds.length} 个用户${unsubscribeUserIds ? `, 取消订阅 ${unsubscribeUserIds.length} 个` : ''}`
        )
        return result as unknown as PresenceListResponse
      } else {
        const response = (await client.http.authedRequest(
          'POST',
          '/presence/list',
          undefined,
          payload
        )) as PresenceListResponse
        logger.info(
          `[Presence] 订阅在线状态成功: ${userIds.length} 个用户${unsubscribeUserIds ? `, 取消订阅 ${unsubscribeUserIds.length} 个` : ''}`
        )
        return response
      }
    } catch (err) {
      logger.error(`[Presence] 订阅在线状态失败: ${formatMatrixError(err)}`)
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
        logger.info(`[Presence] 取消订阅在线状态成功: ${userIds.length} 个用户`)
      } else {
        await client.http.authedRequest('POST', '/presence/list', undefined, { unsubscribe: userIds })
        logger.info(`[Presence] 取消订阅在线状态成功: ${userIds.length} 个用户`)
      }
    } catch (err) {
      logger.error(`[Presence] 取消订阅在线状态失败: ${formatMatrixError(err)}`)
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
        throw new Error(this.t('matrix_error.common.user_id_not_found'))
      }

      if (presenceManager) {
        const result = await presenceManager.getPresenceList(targetUserId)
        logger.info(`[Presence] 获取在线状态列表成功: ${targetUserId}`)
        return result as unknown as PresenceListResponse
      } else {
        const response = (await client.http.authedRequest(
          'GET',
          `/presence/list/${encodeURIComponent(targetUserId)}`
        )) as PresenceListResponse
        logger.info(`[Presence] 获取在线状态列表成功: ${targetUserId}`)
        return response
      }
    } catch (err) {
      logger.error(`[Presence] 获取在线状态列表失败: ${formatMatrixError(err)}`)
      throw err
    }
  }

  /**
   * 批量获取用户在线状态
   * 优先使用 presence/list 批量接口，失败时降级为逐个获取
   *
   * @param userIds 用户 ID 列表
   */
  async getBatchPresence(userIds: string[]): Promise<PresenceInfo[]> {
    if (userIds.length === 0) return []

    try {
      const batchResult = await this.getBatchPresenceViaList(userIds)
      if (batchResult.length > 0) {
        logger.info(`[Presence] 批量获取在线状态成功(批量接口): ${batchResult.length}/${userIds.length}`)
        return batchResult
      }
    } catch (err) {
      logger.info(`[Presence] 批量接口获取失败，降级为逐个获取: ${formatMatrixError(err)}`)
    }

    return this.getBatchPresenceIndividually(userIds)
  }

  /**
   * 通过 presence/list 批量接口获取在线状态
   */
  private async getBatchPresenceViaList(userIds: string[]): Promise<PresenceInfo[]> {
    const subscribeResult = await this.subscribeToPresence(userIds)
    if (subscribeResult?.presences?.length) {
      return subscribeResult.presences
    }
    return []
  }

  /**
   * 逐个获取用户在线状态（降级方案）
   */
  private async getBatchPresenceIndividually(userIds: string[]): Promise<PresenceInfo[]> {
    const promises = userIds.map((userId) => this.getPresence(userId).catch(() => null))

    const results = await Promise.all(promises)
    const presences = results.filter((p): p is PresenceInfo => p !== null)

    logger.info(`[Presence] 批量获取在线状态成功(逐个获取): ${presences.length}/${userIds.length}`)
    return presences
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
      if (this.presenceHandlers.size === 0 && this.clientPresenceListener) {
        try {
          const client = this.getClient()
          client.off('User.presence' as never, this.clientPresenceListener as never)
        } catch (err) {
          logger.warn('Presence update failed (client may be gone):', err)
        }
        this.clientPresenceListener = null
      }
    }
  }

  /**
   * 判断是否为 403/M_FORBIDDEN 错误
   */
  private isForbiddenError(err: unknown): boolean {
    if (!err) return false
    if (typeof err === 'object') {
      const e = err as Record<string, unknown>
      if (e.httpStatus === 403 || e.errcode === 'M_FORBIDDEN') return true
      if (e.cause && typeof e.cause === 'object') {
        const cause = e.cause as Record<string, unknown>
        if (cause.httpStatus === 403 || cause.errcode === 'M_FORBIDDEN') return true
      }
    }
    return false
  }
}

/**
 * 单例实例
 */
export const matrixPresenceService = new MatrixPresenceService()

export default matrixPresenceService
