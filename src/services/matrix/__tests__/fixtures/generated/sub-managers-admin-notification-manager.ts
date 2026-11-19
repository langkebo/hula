// ⚠️ 由 scripts/gen-fixtures-from-sdk.mjs 生成，请勿手改。
// 结构真值来自 SDK 的 .d.ts；`satisfies` 保证与 SDK 类型不漂移。
import type * as T from 'matrix-js-sdk/admin'

/** `sub-managers/admin-notification-manager` 的 `ServerNotification` */
export const ServerNotificationFixture = {
  id: 0,
  title: 'x',
  content: 'x',
  notification_type: 'x',
  priority: 0,
  target_audience: 'x',
  target_user_ids: [],
  starts_at: 0,
  expires_at: 0,
  is_enabled: false,
  is_dismissable: false,
  action_url: 'x',
  action_text: 'x',
  created_by: 'x',
  created_ts: 0,
  updated_ts: 0
} satisfies T.ServerNotification

/** `sub-managers/admin-notification-manager` 的 `NotificationsListResponse` */
export const NotificationsListResponseFixture = {
  notifications: [],
  next_batch: 'x'
} satisfies T.NotificationsListResponse

/** `sub-managers/admin-notification-manager` 的 `CreateNotificationRequest` */
export const CreateNotificationRequestFixture = {
  title: 'x',
  content: 'x'
} satisfies T.CreateNotificationRequest

/** `sub-managers/admin-notification-manager` 的 `NotificationPaginationOptions` */
export const NotificationPaginationOptionsFixture = {} satisfies T.NotificationPaginationOptions
