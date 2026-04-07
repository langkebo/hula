/**
 * Matrix Push API 服务
 *
 * 提供推送通知功能支持
 * 统一使用 SDK PushManager
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { PushManager, PushRuleKind } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('Push')

export interface PushRule {
  ruleId: string
  enabled: boolean
  pattern?: string
  conditions?: Array<{
    kind: string
    [key: string]: unknown
  }>
  actions?: string[]
}

export interface PushPusher {
  key: string
  kind: string
  appId: string
  appDisplayName: string
  deviceDisplayName: string
  pushkey: string
  lang?: string
  data?: Record<string, unknown>
  enabled: boolean
}

export interface PushCapabilities {
  supportsPush: boolean
  supportedFormats: string[]
}

/**
 * Push 服务
 * 统一使用 matrix-js-sdk 的 PushManager
 */
class PushService {
  private pushManager: PushManager | null = null

  /**
   * 初始化服务
   */
  initialize(client: MatrixClient): void {
    this.client = client
    // 使用 SDK 的 PushManager
    this.pushManager = client.getPushManager()
    logger.info('服务已初始化')
  }

  /**
   * 获取推送规则
   */
  async getPushRules(): Promise<PushRule[]> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      const rules = await this.pushManager.getPushRules()
      const allRules: PushRule[] = []

      // Flatten rules from all kinds
      for (const kind of ['override', 'content', 'room', 'sender', 'underride'] as const) {
        const kindRules = rules[kind] || []
        allRules.push(
          ...kindRules.map((r: any) => ({
            ruleId: r.rule_id || '',
            enabled: r.enabled || false,
            pattern: r.pattern,
            conditions: r.conditions,
            actions: r.actions
          }))
        )
      }

      return allRules
    } catch (error) {
      logger.error('获取推送规则失败:', error)
      return []
    }
  }

  /**
   * 获取特定类型的推送规则
   */
  async getRulesByKind(kind: 'override' | 'content' | 'room' | 'sender' | 'underride'): Promise<PushRule[]> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      const rules = await this.pushManager.getRulesByKind(kind)
      return rules.map((r: any) => ({
        ruleId: r.rule_id || '',
        enabled: r.enabled || false,
        pattern: r.pattern,
        conditions: r.conditions,
        actions: r.actions
      }))
    } catch (error) {
      logger.error('获取推送规则失败:', error)
      return []
    }
  }

  /**
   * 添加推送规则
   */
  async addPushRule(
    kind: PushRuleKind,
    ruleId: string,
    options?: {
      pattern?: string
      conditions?: Array<{ kind: string; [key: string]: unknown }>
      actions?: string[]
    }
  ): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.addPushRule('global', kind, ruleId, options)
      logger.info('推送规则已添加:', ruleId)
    } catch (error) {
      logger.error('添加推送规则失败:', error)
      throw error
    }
  }

  /**
   * 删除推送规则
   */
  async deletePushRule(kind: PushRuleKind, ruleId: string): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.deletePushRule('global', kind, ruleId)
      logger.info('推送规则已删除:', ruleId)
    } catch (error) {
      logger.error('删除推送规则失败:', error)
      throw error
    }
  }

  /**
   * 设置推送规则启用状态
   */
  async setPushRuleEnabled(kind: PushRuleKind, ruleId: string, enabled: boolean): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.setPushRuleEnabled('global', kind, ruleId, enabled)
      logger.info('推送规则已', enabled ? '启用' : '禁用', ':', ruleId)
    } catch (error) {
      logger.error('设置推送规则失败:', error)
      throw error
    }
  }

  /**
   * 设置推送规则动作
   */
  async updatePushRuleActions(kind: PushRuleKind, ruleId: string, actions: string[]): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.updatePushRuleActions('global', kind, ruleId, actions)
      logger.info('推送规则动作已更新:', ruleId)
    } catch (error) {
      logger.error('更新推送规则动作失败:', error)
      throw error
    }
  }

  /**
   * 忽略用户
   */
  async ignoreUser(userId: string): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.ignoreUser(userId)
      logger.info('用户已忽略:', userId)
    } catch (error) {
      logger.error('忽略用户失败:', error)
      throw error
    }
  }

  /**
   * 取消忽略用户
   */
  async unignoreUser(userId: string): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.unignoreUser(userId)
      logger.info('用户已取消忽略:', userId)
    } catch (error) {
      logger.error('取消忽略用户失败:', error)
      throw error
    }
  }

  /**
   * 检查用户是否被忽略
   */
  async isUserIgnored(userId: string): Promise<boolean> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      return await this.pushManager.isUserIgnored(userId)
    } catch (error) {
      logger.error('检查用户忽略状态失败:', error)
      return false
    }
  }

  /**
   * 添加关键词高亮
   */
  async addKeywordHighlight(keyword: string): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.addKeywordHighlight(keyword)
      logger.info('关键词已添加:', keyword)
    } catch (error) {
      logger.error('添加关键词失败:', error)
      throw error
    }
  }

  /**
   * 移除关键词高亮
   */
  async removeKeywordHighlight(keyword: string): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.removeKeywordHighlight(keyword)
      logger.info('关键词已移除:', keyword)
    } catch (error) {
      logger.error('移除关键词失败:', error)
      throw error
    }
  }

  /**
   * 静音房间
   */
  async muteRoom(roomId: string): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.muteRoom(roomId)
      logger.info('房间已静音:', roomId)
    } catch (error) {
      logger.error('静音房间失败:', error)
      throw error
    }
  }

  /**
   * 取消静音房间
   */
  async unmuteRoom(roomId: string): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.unmuteRoom(roomId)
      logger.info('房间已取消静音:', roomId)
    } catch (error) {
      logger.error('取消静音房间失败:', error)
      throw error
    }
  }

  /**
   * 检查房间是否被静音
   */
  async isRoomMuted(roomId: string): Promise<boolean> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      return await this.pushManager.isRoomMuted(roomId)
    } catch (error) {
      logger.error('检查房间静音状态失败:', error)
      return false
    }
  }

  /**
   * 获取推送器列表
   */
  async getPushers(): Promise<PushPusher[]> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      const pushers = await this.pushManager.getPushers()
      return pushers.map((p: any) => ({
        key: p.key || `${p.app_id}-${p.pushkey}`,
        kind: p.kind || 'http',
        appId: p.app_id || '',
        appDisplayName: p.app_display_name || '',
        deviceDisplayName: p.device_display_name || '',
        pushkey: p.pushkey || '',
        lang: p.lang,
        data: p.data,
        enabled: p.enabled !== false
      }))
    } catch (error) {
      logger.error('获取推送器列表失败:', error)
      return []
    }
  }

  /**
   * 添加推送器
   */
  async addPusher(config: {
    appId: string
    appDisplayName: string
    deviceDisplayName: string
    pushkey: string
    kind?: string
    lang?: string
    data?: Record<string, unknown>
  }): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.addPusher({
        app_id: config.appId,
        app_display_name: config.appDisplayName,
        device_display_name: config.deviceDisplayName,
        pushkey: config.pushkey,
        kind: (config.kind || 'http') as any,
        lang: config.lang,
        data: config.data,
        enabled: true
      })
      logger.info('推送器已添加:', config.appDisplayName)
    } catch (error) {
      logger.error('添加推送器失败:', error)
      throw error
    }
  }

  /**
   * 移除推送器
   */
  async removePusher(appId: string, pushkey: string): Promise<void> {
    if (!this.pushManager) {
      throw new Error('PushManager 未初始化')
    }

    try {
      await this.pushManager.removePusher(appId, pushkey)
      logger.info('推送器已移除:', appId, pushkey)
    } catch (error) {
      logger.error('移除推送器失败:', error)
      throw error
    }
  }

  /**
   * 获取推送能力
   */
  async getCapabilities(): Promise<PushCapabilities> {
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
      logger.error('获取推送能力失败:', error)
      return {
        supportsPush: false,
        supportedFormats: []
      }
    }
  }
}

export const matrixPushService = new PushService()
