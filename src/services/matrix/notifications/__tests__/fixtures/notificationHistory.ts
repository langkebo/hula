/**
 * 通知历史测试夹具。
 *
 * 契约来源：`matrixNotificationService.getNotifications()` 的返回类型
 * （`{ notifications: Array<Record<string, unknown>>; next_token? }`，
 * 见 `MatrixNotificationService.getNotifications`）。
 */
import type { matrixNotificationService } from '@/services/matrix/notifications/MatrixNotificationService'

export type NotificationHistoryFixture = Awaited<ReturnType<typeof matrixNotificationService.getNotifications>>

/** `getNotifications()` 的一页结果。 */
export function makeNotificationHistory(
  overrides: Partial<NotificationHistoryFixture> = {}
): NotificationHistoryFixture {
  return { notifications: [], ...overrides }
}
