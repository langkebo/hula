import dayjs from 'dayjs'

/**
 * 通知历史列表的展示辅助。
 *
 * 桌面 `PushSettings.vue` 内已有一份同名私有实现；移动端新页若再抄一遍就是第三份。
 * 这里抽成纯函数供移动端使用，桌面暂不改动（该文件正被其他改动占用），后续可收敛过来。
 */

/** 通知正文：取 `notif.content.body`，缺失时用调用方给的兜底文案 */
export const getNotificationContent = (notif: Record<string, unknown>, fallback: string): string => {
  const content = notif.content as Record<string, unknown> | undefined
  if (content && typeof content === 'object' && 'body' in content) {
    return String(content.body)
  }
  return fallback
}

/** 后端 `notification_id` 是 i64，统一转成字符串交给 ack 端点（用 event_id 会 400） */
export const getNotificationId = (notif: Record<string, unknown>): string | null => {
  const id = notif.notification_id
  return typeof id === 'number' || typeof id === 'string' ? String(id) : null
}

export const isNotificationRead = (notif: Record<string, unknown>): boolean => notif.read === true

/** 列表 key：优先稳定的通知 ID，缺失时退回事件 ID / 序号 */
export const notificationKey = (notif: Record<string, unknown>, index: number): string =>
  getNotificationId(notif) ?? String(notif.event_id ?? index)

/** 时间戳 → `MM-DD HH:mm`；无效值返回空串（调用方据此不渲染该段） */
export const formatNotificationTime = (ts: unknown): string => {
  if (typeof ts !== 'number' && typeof ts !== 'string') return ''
  const value = dayjs(Number(ts))
  return value.isValid() ? value.format('MM-DD HH:mm') : ''
}
