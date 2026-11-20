/**
 * 系统通知页签测试夹具。
 *
 * 类型来自 `AdminServerNotificationService['getSystemNotifications']` 的真实返回：
 * `{ notifications: SystemNotificationInfo[]; nextToken?: string }`。
 */
import type { AdminServerNotificationService } from '@/services/matrix/admin/AdminServerNotificationService'
import type { SystemNotificationInfo } from '@/services/matrix/admin/AdminTypes'

/** `getSystemNotifications()` 的响应 */
type SystemNotificationsPage = Awaited<ReturnType<AdminServerNotificationService['getSystemNotifications']>>

/** 生成单条系统通知（必填字段与 `SystemNotificationInfo` 一致）。 */
export function makeSystemNotification(overrides: Partial<SystemNotificationInfo> = {}): SystemNotificationInfo {
  return {
    id: 'n1',
    content: 'maintenance tonight',
    type: 'info',
    targetUsers: [],
    createdAt: 1795000000000,
    ...overrides
  }
}

/** 生成系统通知分页响应。 */
export function makeSystemNotificationsPage(
  notifications: SystemNotificationInfo[] = [],
  nextToken?: string
): SystemNotificationsPage {
  return nextToken === undefined ? { notifications } : { notifications, nextToken }
}
