import { createLogger } from '@/utils/Logger'

const logger = createLogger('NotificationService')

type NotificationAdminSdk = {
  getUserNotification?(userId: string): Promise<Record<string, unknown>>
  setUserNotification?(userId: string, payload: Record<string, unknown>): Promise<Record<string, unknown>>
  getUserPushers?(userId: string): Promise<{ pushers?: unknown[] }>
  deleteUserPusher?(userId: string, pushkey: string): Promise<void>
}

type NotificationDomainSdkGetter = () => Promise<NotificationAdminSdk>

/**
 * 用户级通知设置与 Pusher 管理。
 *
 * 系统通知（服务端通告、系统通知增删改查）已拆分到 `AdminServerNotificationService`。
 */
export class AdminNotificationService {
  constructor(private readonly sdkAdmin: NotificationDomainSdkGetter) {}

  async getUserNotificationSettings(userId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = await this.sdkAdmin()
      return (await admin.getUserNotification?.(userId)) ?? null
    } catch (err) {
      logger.error(`[AdminNotification] 获取用户通知设置失败: ${err}`)
      return null
    }
  }

  async setUserNotificationSettings(userId: string, settings: Record<string, unknown>): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.setUserNotification?.(userId, settings)
      logger.info(`[AdminNotification] 更新用户通知设置: ${userId}`)
    } catch (err) {
      logger.error(`[AdminNotification] 更新用户通知设置失败: ${err}`)
      throw err
    }
  }

  async getUserPushers(userId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getUserPushers?.(userId)
      return (result?.pushers ?? []) as Array<Record<string, unknown>>
    } catch (err) {
      logger.error(`[AdminNotification] 获取用户 Pushers 失败: ${err}`)
      return []
    }
  }

  async deleteUserPusher(userId: string, pushkey: string, _appId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteUserPusher?.(userId, pushkey)
      logger.info(`[AdminNotification] 删除用户 Pusher: ${userId}`)
    } catch (err) {
      logger.error(`[AdminNotification] 删除用户 Pusher 失败: ${err}`)
      throw err
    }
  }
}
