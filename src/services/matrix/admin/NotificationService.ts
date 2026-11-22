import { createLogger } from '@/utils/Logger'
import type { AdminUserPusher } from './AdminTypes'

const logger = createLogger('NotificationService')

/**
 * 用户级通知设置响应。
 *
 * 服务端按用户返回一组开关（含 `global` 子映射），键集合随版本扩展，
 * 因此保留索引签名承载未建模的开关项。
 */
export interface UserNotificationSettingsResponse {
  enabled?: boolean
  [key: string]: unknown
}

/** 更新用户通知设置后的响应。 */
interface UserNotificationUpdateResponse {
  is_enabled?: boolean
}

/**
 * 用户通知设置写入载荷。
 *
 * admin 界面把整组开关扁平化为 `global.*` 等键整体回写；SDK 只读取其中的 `enabled`
 * （映射为 `is_enabled`），其余键当前被忽略。键集合随界面版本变化，属动态配置包。
 */
export interface UserNotificationSettingsPayload {
  [setting: string]: unknown
}

type NotificationAdminSdk = {
  getUserNotification?(userId: string): Promise<UserNotificationSettingsResponse>
  setUserNotification?(
    userId: string,
    payload: UserNotificationSettingsPayload
  ): Promise<UserNotificationUpdateResponse>
  getUserPushers?(userId: string): Promise<{ pushers?: AdminUserPusher[] }>
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

  async getUserNotificationSettings(userId: string): Promise<UserNotificationSettingsResponse | null> {
    try {
      const admin = await this.sdkAdmin()
      return (await admin.getUserNotification?.(userId)) ?? null
    } catch (err) {
      logger.error(`[AdminNotification] 获取用户通知设置失败: ${err}`)
      return null
    }
  }

  async setUserNotificationSettings(userId: string, settings: UserNotificationSettingsPayload): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.setUserNotification?.(userId, settings)
      logger.info(`[AdminNotification] 更新用户通知设置: ${userId}`)
    } catch (err) {
      logger.error(`[AdminNotification] 更新用户通知设置失败: ${err}`)
      throw err
    }
  }

  async getUserPushers(userId: string): Promise<AdminUserPusher[]> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getUserPushers?.(userId)
      return result?.pushers ?? []
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
