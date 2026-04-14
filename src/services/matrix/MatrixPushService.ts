/**
 * Matrix Push API 服务
 *
 * 提供推送通知功能支持
 * 统一使用 SDK PushManager
 * 类型对齐 SDK IPushRule / IPusher / IPushRules
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { PushRuleKind } from 'matrix-js-sdk'
import type { IPushRule, IPusher, IPushRules } from 'matrix-js-sdk'
import { BaseManager } from './BaseManager'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('Push')

export type { IPushRule, IPusher, IPushRules }

export interface PushCapabilities {
  supportsPush: boolean
  supportedFormats: string[]
}

class PushService extends BaseManager {
  private _client: MatrixClient | null = null
  private pushManager: any = null

  initialize(client: MatrixClient): void {
    this._client = client
    this.pushManager = client.getPushManager()
    logger.info('服务已初始化')
  }

  async getPushRules(throwOnError = true): Promise<IPushRules> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      const rules = await this.pushManager.getPushRules()
      logger.debug('推送规则已获取')
      return rules as IPushRules
    } catch (error) {
      return this.handleError(error, 'getPushRules', { global: {} } as unknown as IPushRules, throwOnError)
    }
  }

  async getRawPushRules(throwOnError = true): Promise<IPushRules> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      return await this.pushManager.getPushRules()
    } catch (error) {
      return this.handleError(error, 'getRawPushRules', { global: {} } as unknown as IPushRules, throwOnError)
    }
  }

  async getRulesByKind(
    kind: PushRuleKind | 'override' | 'content' | 'room' | 'sender' | 'underride',
    throwOnError = true
  ): Promise<IPushRule[]> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      const rules = await this.pushManager.getPushRulesByKind('global', kind)
      return rules || []
    } catch (error) {
      return this.handleError(error, 'getRulesByKind', [] as IPushRule[], throwOnError)
    }
  }

  async getPushRule(kind: PushRuleKind, ruleId: string, throwOnError = true): Promise<IPushRule | null> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      return await this.pushManager.getPushRule('global', kind, ruleId, throwOnError)
    } catch (error) {
      return this.handleError(error, 'getPushRule', null, throwOnError)
    }
  }

  async addPushRule(
    kind: PushRuleKind,
    ruleId: string,
    options?: {
      pattern?: string
      conditions?: Array<{ kind: string; [key: string]: unknown }>
      actions?: string[]
    },
    throwOnError = false
  ): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.createPushRule('global', kind, ruleId, options)
      logger.info('推送规则已添加:', ruleId)
    } catch (error) {
      this.handleError(error, 'addPushRule', undefined, throwOnError)
    }
  }

  async deletePushRule(kind: PushRuleKind, ruleId: string, throwOnError = false): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.deletePushRule('global', kind, ruleId)
      logger.info('推送规则已删除:', ruleId)
    } catch (error) {
      this.handleError(error, 'deletePushRule', undefined, throwOnError)
    }
  }

  async setPushRuleEnabled(kind: PushRuleKind, ruleId: string, enabled: boolean, throwOnError = false): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.setPushRuleEnabled('global', kind, ruleId, enabled)
      logger.info('推送规则已', enabled ? '启用' : '禁用', ':', ruleId)
    } catch (error) {
      this.handleError(error, 'setPushRuleEnabled', undefined, throwOnError)
    }
  }

  async getPushRuleEnabled(kind: PushRuleKind, ruleId: string, throwOnError = true): Promise<boolean> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      return await this.pushManager.getPushRuleEnabled('global', kind, ruleId, throwOnError)
    } catch (error) {
      return this.handleError(error, 'getPushRuleEnabled', false, throwOnError)
    }
  }

  async updatePushRuleActions(kind: PushRuleKind, ruleId: string, actions: string[], throwOnError = false): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.setPushRuleActions('global', kind, ruleId, actions)
      logger.info('推送规则动作已更新:', ruleId)
    } catch (error) {
      this.handleError(error, 'updatePushRuleActions', undefined, throwOnError)
    }
  }

  async ignoreUser(userId: string, throwOnError = false): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.ignoreSender(userId)
      logger.info('用户已忽略:', userId)
    } catch (error) {
      this.handleError(error, 'ignoreUser', undefined, throwOnError)
    }
  }

  async unignoreUser(userId: string, throwOnError = false): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.unignoreSender(userId)
      logger.info('用户已取消忽略:', userId)
    } catch (error) {
      this.handleError(error, 'unignoreUser', undefined, throwOnError)
    }
  }

  async isUserIgnored(userId: string, throwOnError = true): Promise<boolean> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      return await this.pushManager.isUserIgnored(userId)
    } catch (error) {
      return this.handleError(error, 'isUserIgnored', false, throwOnError)
    }
  }

  async addKeywordHighlight(keyword: string, throwOnError = false): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.addKeywordHighlight(keyword)
      logger.info('关键词已添加:', keyword)
    } catch (error) {
      this.handleError(error, 'addKeywordHighlight', undefined, throwOnError)
    }
  }

  async removeKeywordHighlight(keyword: string, throwOnError = false): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.removeKeywordHighlight(keyword)
      logger.info('关键词已移除:', keyword)
    } catch (error) {
      this.handleError(error, 'removeKeywordHighlight', undefined, throwOnError)
    }
  }

  async muteRoom(roomId: string, throwOnError = false): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.muteRoom(roomId)
      logger.info('房间已静音:', roomId)
    } catch (error) {
      this.handleError(error, 'muteRoom', undefined, throwOnError)
    }
  }

  async unmuteRoom(roomId: string, throwOnError = false): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.unmuteRoom(roomId)
      logger.info('房间已取消静音:', roomId)
    } catch (error) {
      this.handleError(error, 'unmuteRoom', undefined, throwOnError)
    }
  }

  async isRoomMuted(roomId: string, throwOnError = true): Promise<boolean> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      return await this.pushManager.isRoomMuted(roomId)
    } catch (error) {
      return this.handleError(error, 'isRoomMuted', false, throwOnError)
    }
  }

  async getPushers(throwOnError = true): Promise<IPusher[]> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      const pushers = await this.pushManager.getPushers()
      return pushers || []
    } catch (error) {
      return this.handleError(error, 'getPushers', [] as IPusher[], throwOnError)
    }
  }

  async addPusher(
    config: {
      appId: string
      appDisplayName: string
      deviceDisplayName: string
      pushkey: string
      kind?: string
      lang?: string
      profileTag?: string
      data?: Record<string, unknown>
    },
    throwOnError = false
  ): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.setPusher({
        app_id: config.appId,
        app_display_name: config.appDisplayName,
        device_display_name: config.deviceDisplayName,
        pushkey: config.pushkey,
        kind: config.kind || 'http',
        lang: config.lang,
        profile_tag: config.profileTag,
        data: config.data,
        append: true
      })
      logger.info('推送器已添加:', config.appDisplayName)
    } catch (error) {
      this.handleError(error, 'addPusher', undefined, throwOnError)
    }
  }

  async removePusher(appId: string, pushkey: string, throwOnError = false): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.removePusher(pushkey, appId)
      logger.info('推送器已移除:', appId, pushkey)
    } catch (error) {
      this.handleError(error, 'removePusher', undefined, throwOnError)
    }
  }

  async getNotifications(
    params?: { limit?: number; from?: string; only?: string },
    throwOnError = true
  ): Promise<{ notifications: Array<Record<string, unknown>>; nextToken?: string }> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      const response = await this.pushManager.getNotifications(params)
      return {
        notifications: response?.notifications || [],
        nextToken: response?.next_token ?? undefined
      }
    } catch (error) {
      return this.handleError(
        error,
        'getNotifications',
        { notifications: [] } as { notifications: Array<Record<string, unknown>>; nextToken?: string },
        throwOnError
      )
    }
  }

  async ackNotification(notificationId: string, throwOnError = true): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.ackNotification(notificationId, throwOnError)
    } catch (error) {
      this.handleError(error, 'ackNotification', undefined, throwOnError)
    }
  }

  async getCapabilities(throwOnError = true): Promise<PushCapabilities> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      const caps = await this.pushManager.getCapabilities()
      return {
        supportsPush: caps.supports?.push || false,
        supportedFormats: caps.supports?.formats || []
      }
    } catch (error) {
      return this.handleError(
        error,
        'getCapabilities',
        { supportsPush: false, supportedFormats: [] } as PushCapabilities,
        throwOnError
      )
    }
  }
}

export const matrixPushService = new PushService()
