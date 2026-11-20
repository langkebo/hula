import dayjs from 'dayjs'
import type { IContent } from '@/services/matrix/sdk'

/**
 * 通知历史列表的展示辅助。
 *
 * 桌面 `PushSettings.vue` 内已有一份同名私有实现；移动端新页若再抄一遍就是第三份。
 * 这里抽成纯函数供移动端使用，桌面暂不改动（该文件正被其他改动占用），后续可收敛过来。
 */

/**
 * 通知历史条目。
 *
 * SDK `getNotifications` 声明的条目只有 `event` / `read` / `room_id` / `ts`，
 * synapse-rust 在线上额外返回 `notification_id`（i64，ack 端点只认它）与事件 `content`；
 * 历史数据可能存在字段缺失或类型不符，故一律声明为可选并保留索引签名。
 */
export interface NotificationHistoryEntry {
  notification_id?: number | string | null
  event_id?: string
  room_id?: string
  ts?: number
  read?: boolean | number
  content?: IContent | null
  [key: string]: unknown
}

/** 通知正文：取 `notif.content.body`，缺失时用调用方给的兜底文案 */
export const getNotificationContent = (notif: NotificationHistoryEntry, fallback: string): string => {
  const content = notif.content
  if (content && typeof content === 'object' && 'body' in content) {
    return String(content.body)
  }
  return fallback
}

/** 后端 `notification_id` 是 i64，统一转成字符串交给 ack 端点（用 event_id 会 400） */
export const getNotificationId = (notif: NotificationHistoryEntry): string | null => {
  const id = notif.notification_id
  return typeof id === 'number' || typeof id === 'string' ? String(id) : null
}

export const isNotificationRead = (notif: NotificationHistoryEntry): boolean => notif.read === true

/**
 * 只保留未读通知。
 *
 * SDK 的 `getNotifications` 不支持按 `read` 过滤，而 ack 端点又不会把条目从结果里删除，
 * 所以「已读后列表不归零」只能由前端在渲染层过滤。
 */
export const filterUnreadNotifications = <T extends NotificationHistoryEntry>(notifications: T[]): T[] =>
  notifications.filter((notif) => !isNotificationRead(notif))

/** 列表 key：优先稳定的通知 ID，缺失时退回事件 ID / 序号 */
export const notificationKey = (notif: NotificationHistoryEntry, index: number): string =>
  getNotificationId(notif) ?? String(notif.event_id ?? index)

/** 时间戳 → `MM-DD HH:mm`；无效值返回空串（调用方据此不渲染该段） */
export const formatNotificationTime = (ts: unknown): string => {
  if (typeof ts !== 'number' && typeof ts !== 'string') return ''
  const value = dayjs(Number(ts))
  return value.isValid() ? value.format('MM-DD HH:mm') : ''
}
