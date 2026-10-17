/**
 * 通知相关路径常量。
 *
 * 推送规则与 Pusher 已全部走 SDK `PushManager`（`getPushRules` / `setPusher` 等），
 * 此处仅保留 SDK 未覆盖的 `notifications/{id}/ack` 私有端点。
 */
export const NOTIFICATION = {
  NOTIFICATIONS_ACK: (notificationId: string) => `/notifications/${encodeURIComponent(notificationId)}/ack`
} as const
