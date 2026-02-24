import matrixClientService from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

export interface NotificationConfig {
  enableDesktop: boolean
  enableSound: boolean
  enableVibrate: boolean
  showPreview: boolean
  showSender: boolean
  showMessageContent: boolean
}

export interface PushRule {
  ruleId: string
  kind: 'override' | 'underride' | 'sender'
  roomId: string
  conditions: {
    isRoom?: boolean
    isUser?: boolean
    sender?: string
    keywords?: string[]
  }
  actions: string[]
  enabled: boolean
}

export interface NotificationAction {
  notify: boolean
  soundFile?: string
  highlight?: boolean
  threadId?: string
}

class MatrixNotificationService {
  private config: NotificationConfig = {
    enableDesktop: true,
    enableSound: true,
    enableVibrate: true,
    showPreview: true,
    showSender: true,
    showMessageContent: false
  }

  private pushRules: Map<string, PushRule> = new Map()

  async initialize(): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[Notification] 客户端未初始化')
    }

    try {
      const rules = await client.getPushRules()
      const rulesArray = Object.values(rules || {})
      for (const rule of rulesArray) {
        if (rule && (rule as any).rule_id) {
          this.pushRules.set((rule as any).rule_id, rule as PushRule)
        }
      }
      info('[Notification] 通知服务初始化成功')
    } catch (err) {
      error(`[Notification] 初始化失败: ${err}`)
      throw err
    }
  }

  async setPushRule(rule: PushRule): Promise<void> {
    const client = matrixClientService.getClient() as any
    if (!client) {
      throw new Error('[Notification] 客户端未初始化')
    }

    try {
      await client.setPushRule(rule.ruleId, rule)
      this.pushRules.set(rule.ruleId, rule)
      info(`[Notification] 设置推送规则: ${rule.ruleId}`)
    } catch (err) {
      error(`[Notification] 设置推送规则失败: ${err}`)
      throw err
    }
  }

  async deletePushRule(ruleId: string): Promise<void> {
    const client = matrixClientService.getClient() as any
    if (!client) {
      throw new Error('[Notification] 客户端未初始化')
    }

    try {
      await client.deletePushRule(ruleId)
      this.pushRules.delete(ruleId)
      info(`[Notification] 删除推送规则: ${ruleId}`)
    } catch (err) {
      error(`[Notification] 删除推送规则失败: ${err}`)
      throw err
    }
  }

  async setPusher(pusher: any): Promise<void> {
    const client = matrixClientService.getClient() as any
    if (!client) {
      throw new Error('[Notification] 客户端未初始化')
    }

    try {
      await client.setPusher(pusher)
      info('[Notification] 设置 Pusher 成功')
    } catch (err) {
      error(`[Notification] 设置 Pusher 失败: ${err}`)
      throw err
    }
  }

  getPushRules(): PushRule[] {
    return Array.from(this.pushRules.values())
  }

  getPushRule(ruleId: string): PushRule | undefined {
    return this.pushRules.get(ruleId)
  }

  updateConfig(config: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): NotificationConfig {
    return { ...this.config }
  }

  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window) || !window.Notification) {
      return false
    }

    try {
      const permission = await window.Notification.requestPermission()
      return permission === 'granted'
    } catch {
      return false
    }
  }

  async showNotification(title: string, body: string, options?: {
    icon?: string
    tag?: string
  }): Promise<void> {
    if (!this.config.enableDesktop) return

    const hasPermission = await this.requestNotificationPermission()
    if (!hasPermission) {
      info('[Notification] 桌面通知权限未授予')
      return
    }

    try {
      new window.Notification(title, {
        body,
        icon: options?.icon || '/icon.png',
        tag: options?.tag || 'hula-notification',
        requireInteraction: false
      })

      info(`[Notification] 显示通知: ${title}`)
    } catch (err) {
      error(`[Notification] 显示通知失败: ${err}`)
    }
  }

  async hideAllNotifications(): Promise<void> {
    if (!('Notification' in window)) return

    try {
      const notifications = await (window.Notification as any).getNotifications?.()
      if (notifications) {
        for (const notification of notifications) {
          notification.close()
        }
      }
      info('[Notification] 关闭所有通知')
    } catch (err) {
      error(`[Notification] 关闭通知失败: ${err}`)
    }
  }

  async playSound(soundFile: string): Promise<void> {
    if (!this.config.enableSound) return

    try {
      const audio = new Audio(soundFile)
      audio.volume = 0.5
      await audio.play()
      info('[Notification] 播放提示音')
    } catch (err) {
      error(`[Notification] 播放提示音失败: ${err}`)
    }
  }

  async vibrate(): Promise<void> {
    if (!this.config.enableVibrate) return

    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(100)
      }
      info('[Notification] 触发振动')
    } catch (err) {
      error(`[Notification] 振动失败: ${err}`)
    }
  }
}

export const matrixNotificationService = new MatrixNotificationService()
export default matrixNotificationService
