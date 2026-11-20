/**
 * admin 系统通知域测试夹具。
 *
 * 类型来自本服务声明的 SDK 子集 `ServerNotificationAdminSdk`（服务实际消费的 wire 契约），
 * 而非 `matrix-js-sdk/admin` 的 `ServerNotification` / `SystemNotificationPage`：
 * 同一批端点被两个 Manager 覆盖，SDK 侧已改用 `next_batch` 与 `id: number`，本服务仍按后端
 * 历史别名（`notification_id` / `next_token`）声明。夹具以服务契约为准，避免改动既有断言；
 * 该漂移作为待收敛项记录在诊断文档。
 */
import type { ServerNotificationAdminSdk, SystemNotificationResponse } from '../../AdminServerNotificationService'

/** `sendServerNotice()` 的 wire 响应 */
type SendServerNoticeWire = Awaited<ReturnType<ServerNotificationAdminSdk['sendServerNotice']>>
/** `getServerNotices()` 的 wire 响应（非空） */
type ServerNoticePageWire = NonNullable<
  Awaited<ReturnType<NonNullable<ServerNotificationAdminSdk['getServerNotices']>>>
>
/** `createNotification()` 的 wire 响应 */
type CreateNotificationWire = NonNullable<
  Awaited<ReturnType<NonNullable<ServerNotificationAdminSdk['createNotification']>>>
>
/** `listNotifications()` 的 wire 响应 */
type SystemNotificationPageWire = Awaited<ReturnType<NonNullable<ServerNotificationAdminSdk['listNotifications']>>>

/** `sendServerNotice()` 响应 */
export function makeSendServerNoticeResult(overrides: Partial<SendServerNoticeWire> = {}): SendServerNoticeWire {
  return { event_id: '$notice:example.org', ...overrides }
}

/**
 * `getServerNotices()` 的列表项。
 *
 * 服务层把 `notices` 声明为 `unknown[]`，这里固定其实际读取的三个字段：
 * `user_id` / `sent_ts` / `content`。
 */
export function makeServerNotice(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { user_id: '@u:hs', sent_ts: 111, content: { body: 'hi' }, ...overrides }
}

/** `getServerNotices()` 响应 */
export function makeServerNoticePage(overrides: Partial<ServerNoticePageWire> = {}): ServerNoticePageWire {
  return { notices: [], ...overrides }
}

/** `createNotification()` 响应 */
export function makeCreateNotificationResult(overrides: Partial<CreateNotificationWire> = {}): CreateNotificationWire {
  return { notification_id: 'n:example.org', ...overrides }
}

/** 单条系统通知（列表项与详情共用） */
export function makeSystemNotificationWire(
  overrides: Partial<SystemNotificationResponse> = {}
): SystemNotificationResponse {
  return { content: '', type: 'info', target_users: [], ...overrides }
}

/** `listNotifications()` 响应 */
export function makeSystemNotificationPage(
  overrides: Partial<SystemNotificationPageWire> = {}
): SystemNotificationPageWire {
  return { notifications: [], ...overrides }
}
