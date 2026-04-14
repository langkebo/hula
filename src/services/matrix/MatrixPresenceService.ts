import type { MatrixClient } from 'matrix-js-sdk'
import { BaseManager } from './BaseManager'
import { getGlobalCache } from '@/composables/useCache'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('Presence')

export type PresenceStatus = 'online' | 'offline' | 'unavailable' | 'busy'

export interface PresenceInfo {
  userId: string
  presence: PresenceStatus
  statusMsg?: string
  lastActiveAgo?: number
  currentlyActive?: boolean
}

class MatrixPresenceService extends BaseManager {
  private client: MatrixClient | null = null
  private presenceManager: any = null
  private presenceCache = getGlobalCache<PresenceInfo>('presence', { maxSize: 500, ttl: 30000 })

  initialize(client: MatrixClient): void {
    this.client = client
    this.presenceManager = (client as any).getPresenceManager?.() ?? null
    this.presenceCache.clear()
    logger.info('服务已初始化', this.presenceManager ? '(SDK)' : '(fallback)')
  }

  async setPresence(status: PresenceStatus, statusMessage?: string, throwOnError = false): Promise<void> {
    if (!this.client) throw new Error('客户端未初始化')
    try {
      if (this.presenceManager) {
        switch (status) {
          case 'online':
            await this.presenceManager.setOnline(statusMessage)
            break
          case 'offline':
            await this.presenceManager.setOffline(statusMessage)
            break
          case 'unavailable':
            await this.presenceManager.setUnavailable(statusMessage)
            break
          case 'busy':
            await this.presenceManager.setBusy(statusMessage)
            break
          default:
            await this.presenceManager.setPresence(status, statusMessage)
        }
      } else {
        await this.client.setPresence({ presence: status, status_msg: statusMessage })
      }
      logger.info('在线状态已设置:', status)
    } catch (err) {
      this.handleError(err, 'setPresence', undefined as void, throwOnError)
    }
  }

  async getPresence(userId: string, throwOnError = true): Promise<PresenceInfo | null> {
    const cached = this.presenceCache.get(userId)
    if (cached) return cached

    if (!this.client) throw new Error('客户端未初始化')
    try {
      let result: PresenceInfo
      if (this.presenceManager) {
        const presence = await this.presenceManager.getPresence(userId)
        result = {
          userId,
          presence: presence?.presence || 'offline',
          statusMsg: presence?.status_msg,
          lastActiveAgo: presence?.last_active_ago,
          currentlyActive: presence?.currently_active
        }
      } else {
        const presence = await this.client.getPresence(userId)
        result = {
          userId,
          presence: presence?.presence || 'offline',
          statusMsg: presence?.status_msg,
          lastActiveAgo: presence?.last_active_ago,
          currentlyActive: presence?.currently_active
        }
      }
      this.presenceCache.set(userId, result)
      return result
    } catch (err) {
      return this.handleError(err, 'getPresence', null as PresenceInfo | null, throwOnError)
    }
  }

  async getPresences(userIds: string[], throwOnError = true): Promise<PresenceInfo[]> {
    if (!this.presenceManager) {
      const results: PresenceInfo[] = []
      for (const userId of userIds) {
        const info = await this.getPresence(userId, throwOnError)
        if (info) results.push(info)
      }
      return results
    }
    try {
      const presences = await this.presenceManager.getPresences(userIds)
      return presences.map((p: any) => ({
        userId: p.user_id,
        presence: p.presence || 'offline',
        statusMsg: p.status_msg,
        lastActiveAgo: p.last_active_ago,
        currentlyActive: p.currently_active
      }))
    } catch (err) {
      return this.handleError(err, 'getPresences', [] as PresenceInfo[], throwOnError)
    }
  }

  async subscribeToPresence(userIds: string[], throwOnError = false): Promise<void> {
    if (!this.presenceManager) {
      logger.warn('PresenceManager 不可用，无法订阅在线状态')
      return
    }
    try {
      await this.presenceManager.subscribeToPresence(userIds)
      logger.info('已订阅在线状态:', userIds.length, '个用户')
    } catch (err) {
      this.handleError(err, 'subscribeToPresence', undefined as void, throwOnError)
    }
  }

  async unsubscribeFromPresence(userIds: string[], throwOnError = false): Promise<void> {
    if (!this.presenceManager) return
    try {
      await this.presenceManager.unsubscribeFromPresence(userIds)
      logger.info('已取消订阅在线状态:', userIds.length, '个用户')
    } catch (err) {
      this.handleError(err, 'unsubscribeFromPresence', undefined as void, throwOnError)
    }
  }

  async getPresenceList(userId: string, throwOnError = true): Promise<PresenceInfo[]> {
    if (!this.presenceManager) {
      return this.handleError(
        new Error('PresenceManager 不可用'),
        'getPresenceList',
        [] as PresenceInfo[],
        throwOnError
      )
    }
    try {
      const presences = await this.presenceManager.getPresenceList(userId)
      return (presences || []).map((p: any) => ({
        userId: p.user_id,
        presence: p.presence || 'offline',
        statusMsg: p.status_msg,
        lastActiveAgo: p.last_active_ago,
        currentlyActive: p.currently_active
      }))
    } catch (err) {
      return this.handleError(err, 'getPresenceList', [] as PresenceInfo[], throwOnError)
    }
  }

  async clearStatusMessage(throwOnError = false): Promise<void> {
    if (!this.client) throw new Error('客户端未初始化')
    try {
      if (this.presenceManager) {
        await this.presenceManager.clearStatusMessage()
      } else {
        const currentPresence = await this.client.getPresence(this.client.getUserId()!)
        await this.client.setPresence({
          presence: currentPresence?.presence || 'online',
          status_msg: undefined
        })
      }
      logger.info('状态消息已清除')
    } catch (err) {
      this.handleError(err, 'clearStatusMessage', undefined as void, throwOnError)
    }
  }

  getCachedPresence(userId: string): PresenceInfo | null {
    if (!this.presenceManager) return null
    try {
      const cached = this.presenceManager.getCachedPresence(userId)
      if (!cached) return null
      return {
        userId,
        presence: cached.presence || 'offline',
        statusMsg: cached.status_msg,
        lastActiveAgo: cached.last_active_ago,
        currentlyActive: cached.currently_active
      }
    } catch {
      return null
    }
  }

  onPresenceUpdate(callback: (userId: string, presence: PresenceInfo) => void): () => void {
    if (!this.presenceManager) return () => {}
    const handler = (userId: string, data: any) => {
      callback(userId, {
        userId,
        presence: data?.presence || 'offline',
        statusMsg: data?.status_msg,
        lastActiveAgo: data?.last_active_ago,
        currentlyActive: data?.currently_active
      })
    }
    this.presenceManager.on('PresenceUpdated', handler)
    return () => this.presenceManager?.off('PresenceUpdated', handler)
  }
}

export const matrixPresenceService = new MatrixPresenceService()
export default matrixPresenceService
