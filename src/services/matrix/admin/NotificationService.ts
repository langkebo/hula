import { error, info } from '@tauri-apps/plugin-log'
import type { ServerNoticeInfo, ServerNoticeResult } from './AdminTypes'

type NotificationAdminSdk = {
  sendServerNotice(
    arg1: string,
    arg2?: string | { msgtype: string; body: string; [k: string]: unknown },
    arg3?: string[]
  ): Promise<{ event_id?: string }>
  getServerNotices?(
    fromOrLimit?: string | number,
    limit?: number
  ): Promise<{ notices?: unknown[]; next_token?: string } | null>
  getUserNotification?(userId: string): Promise<Record<string, unknown>>
  setUserNotification?(userId: string, payload: Record<string, unknown>): Promise<Record<string, unknown>>
  getUserPushers?(userId: string): Promise<{ pushers?: unknown[] }>
  deleteUserPusher?(userId: string, pushkey: string): Promise<void>
  createNotification?(payload: Record<string, unknown>): Promise<{ notification_id?: string; [key: string]: unknown }>
  listNotifications?(
    from?: string,
    limit?: number
  ): Promise<{
    notifications: Array<Record<string, unknown>>
    next_token?: string
  }>
  getNotification?(notificationId: string): Promise<Record<string, unknown>>
  updateNotification?(notificationId: string, payload: Record<string, unknown>): Promise<Record<string, unknown>>
  deleteNotification?(notificationId: string): Promise<void>
}

type NotificationDomainSdkGetter = () => Promise<NotificationAdminSdk>

export class AdminNotificationService {
  constructor(private readonly sdkAdmin: NotificationDomainSdkGetter) {}

  async sendServerNotice(userId: string, content: Record<string, unknown>): Promise<ServerNoticeResult> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.sendServerNotice(
        userId,
        content as { msgtype: string; body: string; [k: string]: unknown }
      )
      info(`[AdminNotification] 服务器通知已发送: ${userId}`)
      return { eventId: result?.event_id }
    } catch (err) {
      error(`[AdminNotification] 发送服务器通知失败: ${err}`)
      throw err
    }
  }

  async getServerNotices(limit = 50): Promise<{ notices: ServerNoticeInfo[] } | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getServerNotices?.(undefined, limit)
      if (!result) return null
      return {
        notices: (result.notices ?? []).map((raw) => {
          const n = raw as Record<string, unknown>
          return {
            userId: (n.user_id as string) || '',
            sentTs: n.sent_ts as number | undefined,
            content: n.content as Record<string, unknown> | undefined
          }
        })
      }
    } catch (err) {
      error(`[AdminNotification] 获取服务器通知失败: ${err}`)
      return null
    }
  }

  async getUserNotificationSettings(userId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = await this.sdkAdmin()
      return (await admin.getUserNotification?.(userId)) ?? null
    } catch (err) {
      error(`[AdminNotification] 获取用户通知设置失败: ${err}`)
      return null
    }
  }

  async setUserNotificationSettings(userId: string, settings: Record<string, unknown>): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.setUserNotification?.(userId, settings)
      info(`[AdminNotification] 更新用户通知设置: ${userId}`)
    } catch (err) {
      error(`[AdminNotification] 更新用户通知设置失败: ${err}`)
      throw err
    }
  }

  async getUserPushers(userId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getUserPushers?.(userId)
      return (result?.pushers ?? []) as Array<Record<string, unknown>>
    } catch (err) {
      error(`[AdminNotification] 获取用户 Pushers 失败: ${err}`)
      return []
    }
  }

  async deleteUserPusher(userId: string, pushkey: string, _appId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteUserPusher?.(userId, pushkey)
      info(`[AdminNotification] 删除用户 Pusher: ${userId}`)
    } catch (err) {
      error(`[AdminNotification] 删除用户 Pusher 失败: ${err}`)
      throw err
    }
  }

  async createSystemNotification(
    content: string,
    type: string = 'info',
    targetUsers?: string[]
  ): Promise<{ notificationId: string }> {
    try {
      const admin = await this.sdkAdmin()
      const body: { content: string; type?: string; target_users?: string[] } = { content, type }
      if (targetUsers) body.target_users = targetUsers
      const result = await admin.createNotification?.(body)
      info('[AdminNotification] 创建系统通知成功')
      return { notificationId: result?.notification_id ?? '' }
    } catch (err) {
      error(`[AdminNotification] 创建系统通知失败: ${err}`)
      throw err
    }
  }

  async getSystemNotifications(
    limit = 50,
    from?: string
  ): Promise<{ notifications: Array<Record<string, unknown>>; nextToken?: string }> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.listNotifications?.(from, limit)
      return {
        notifications: result?.notifications ?? [],
        nextToken: result?.next_token
      }
    } catch (err) {
      error(`[AdminNotification] 获取系统通知列表失败: ${err}`)
      return { notifications: [] }
    }
  }

  async getSystemNotification(notificationId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = await this.sdkAdmin()
      return (await admin.getNotification?.(notificationId)) ?? null
    } catch (err) {
      error(`[AdminNotification] 获取系统通知详情失败: ${err}`)
      return null
    }
  }

  async updateSystemNotification(notificationId: string, updates: Record<string, unknown>): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.updateNotification?.(notificationId, updates)
      info(`[AdminNotification] 更新系统通知: ${notificationId}`)
    } catch (err) {
      error(`[AdminNotification] 更新系统通知失败: ${err}`)
      throw err
    }
  }

  async deleteSystemNotification(notificationId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteNotification?.(notificationId)
      info(`[AdminNotification] 删除系统通知: ${notificationId}`)
    } catch (err) {
      error(`[AdminNotification] 删除系统通知失败: ${err}`)
      throw err
    }
  }
}
