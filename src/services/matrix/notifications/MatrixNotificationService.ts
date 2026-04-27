import type { MatrixClient, IPusherRequest, IPushRule, IPushRules, PushRuleKind } from 'matrix-js-sdk'
import matrixClientService from '../MatrixClientService'
import { info, error, warn } from '@tauri-apps/plugin-log'

export interface NotificationRule {
  ruleId: string
  kind: 'override' | 'content' | 'room' | 'sender' | 'underride'
  roomId?: string
  conditions?: Record<string, unknown>
  actions: unknown[]
  enabled?: boolean
}

export interface NotificationConfig {
  enableDesktop: boolean
  enableSound: boolean
  enableVibrate: boolean
  showPreview: boolean
  showSender: boolean
  showMessageContent: boolean
}

class MatrixNotificationService {
  private pushRules: IPushRule[] = []
  private observedClient: MatrixClient | null = null
  private config: NotificationConfig = {
    enableDesktop: true,
    enableSound: true,
    enableVibrate: true,
    showPreview: true,
    showSender: true,
    showMessageContent: true
  }

  private syncClientState(): MatrixClient | null {
    const client = matrixClientService.getClient()
    if (this.observedClient && this.observedClient !== client) {
      this.pushRules = []
    }
    this.observedClient = client
    return client
  }

  private getClient(): MatrixClient {
    const client = this.syncClientState()
    if (!client) {
      throw new Error('客户端未初始化')
    }
    return client
  }

  private flattenRules(rules: IPushRules): IPushRule[] {
    const allRules: IPushRule[] = []
    const globalRules = rules.global
    for (const value of Object.values(globalRules)) {
      if (Array.isArray(value)) {
        allRules.push(...value)
      }
    }
    return allRules
  }

  async initialize(): Promise<void> {
    try {
      const client = this.getClient()
      const rules = await client.getPushRules()
      this.pushRules = this.flattenRules(rules)
      info('[MatrixNotification] 初始化完成')
    } catch (err) {
      error(`[MatrixNotification] 初始化失败: ${err}`)
      throw err
    }
  }

  async setPushRule(rule: NotificationRule): Promise<void> {
    const client = this.getClient()
    try {
      await client.setPushRule('global', rule.kind as PushRuleKind, rule.ruleId, rule.actions)
      info(`[MatrixNotification] 设置推送规则成功: ${rule.ruleId}`)
    } catch (err) {
      error(`[MatrixNotification] 设置推送规则失败: ${err}`)
      throw err
    }
  }

  async deletePushRule(ruleId: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.deletePushRule('global', 'override', ruleId)
      info(`[MatrixNotification] 删除推送规则成功: ${ruleId}`)
    } catch (err) {
      error(`[MatrixNotification] 删除推送规则失败: ${err}`)
      throw err
    }
  }

  async setPusher(pusher: IPusherRequest): Promise<void> {
    const client = this.getClient()
    try {
      await client.setPusher(pusher)
      info('[MatrixNotification] 设置 pusher 成功')
    } catch (err) {
      error(`[MatrixNotification] 设置 pusher 失败: ${err}`)
      throw err
    }
  }

  getPushRules(): IPushRule[] {
    this.syncClientState()
    return this.pushRules
  }

  getPushRule(ruleId: string): IPushRule | undefined {
    this.syncClientState()
    return this.pushRules.find((rule) => rule.rule_id === ruleId)
  }

  updateConfig(config: Partial<NotificationConfig>): void {
    this.config = {
      ...this.config,
      ...config
    }
  }

  getConfig(): NotificationConfig {
    return { ...this.config }
  }

  async requestNotificationPermission(): Promise<boolean> {
    try {
      if (typeof Notification === 'undefined') {
        return false
      }

      if (Notification.permission === 'granted') {
        return true
      }

      const permission = await Notification.requestPermission()
      return permission === 'granted'
    } catch (err) {
      error(`[MatrixNotification] 请求通知权限失败: ${err}`)
      return false
    }
  }

  async showNotification(title: string, body: string): Promise<void> {
    try {
      if (!this.config.enableDesktop) {
        return
      }

      if (typeof Notification === 'undefined') {
        warn('[MatrixNotification] Notification API 不可用')
        return
      }

      if (Notification.permission !== 'granted') {
        const granted = await this.requestNotificationPermission()
        if (!granted) {
          return
        }
      }

      new Notification(title, {
        body: this.config.showMessageContent ? body : undefined
      })
    } catch (err) {
      error(`[MatrixNotification] 显示通知失败: ${err}`)
    }
  }

  async playSound(url: string): Promise<void> {
    try {
      if (!this.config.enableSound) {
        return
      }

      const audio = new Audio(url)
      await audio.play()
    } catch (err) {
      warn(`[MatrixNotification] 播放提示音失败: ${err}`)
    }
  }

  async vibrate(pattern: number | number[] = [100, 50, 100]): Promise<void> {
    try {
      if (!this.config.enableVibrate || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
        return
      }

      navigator.vibrate(pattern)
    } catch (err) {
      warn(`[MatrixNotification] 震动失败: ${err}`)
    }
  }

  async getNotifications(
    from?: string,
    limit: number = 20
  ): Promise<{
    notifications: Array<Record<string, unknown>>
    next_token?: string
  }> {
    const client = this.getClient()
    try {
      const queryParams: Record<string, string> = { limit: String(limit) }
      if (from) queryParams.from = from

      const result = await client.http.authedRequest('GET', '/_matrix/client/v3/notifications', queryParams)
      return result as { notifications: Array<Record<string, unknown>>; next_token?: string }
    } catch (err) {
      error(`[MatrixNotification] 获取通知列表失败: ${err}`)
      return { notifications: [] }
    }
  }

  async ackNotification(notificationId: string): Promise<boolean> {
    const client = this.getClient()
    try {
      await client.http.authedRequest(
        'POST',
        `/_matrix/client/v3/notifications/${encodeURIComponent(notificationId)}/ack`
      )
      info(`[MatrixNotification] 通知确认成功: ${notificationId}`)
      return true
    } catch (err) {
      error(`[MatrixNotification] 通知确认失败: ${err}`)
      return false
    }
  }
}

export const matrixNotificationService = new MatrixNotificationService()
export default matrixNotificationService
