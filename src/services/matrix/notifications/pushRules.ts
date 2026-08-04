/**
 * §9.2.5 推送规则扩展
 *
 * 判断事件类型是否应触发本地推送通知。覆盖 Matrix 核心事件类型
 * 以及 Tjg 扩展事件（好友请求、Widget 事件、AI 工具调用结果）。
 *
 * 纯函数实现，不依赖 MatrixClient，便于测试与复用。
 */

/** 触发推送的核心 Matrix 事件类型 */
const CORE_NOTIFY_EVENT_TYPES = new Set([
  'm.room.message',
  'm.room.encrypted',
  'm.room.member',
  'm.call.invite',
  'm.key.verification.request'
])

/** §9.2.5 触发推送的扩展事件类型 */
export const EXTENSION_NOTIFY_EVENT_TYPES = new Set([
  'im.hula.friend_request',
  'im.hula.widget_event',
  'im.hula.ai_tool_result'
])

/** 不触发推送的事件类型（轻量/临时状态） */
const SILENT_EVENT_TYPES = new Set([
  'm.reaction',
  'm.typing',
  'm.presence',
  'm.receipt',
  'm.fully_read',
  'm.marked_unread'
])

/** 合并所有应触发推送的事件类型 */
const NOTIFY_EVENT_TYPES = new Set<string>([...CORE_NOTIFY_EVENT_TYPES, ...EXTENSION_NOTIFY_EVENT_TYPES])

/**
 * 判断事件类型是否应触发推送通知。
 *
 * - 白名单内的核心 + 扩展事件类型 → true
 * - 明确静默的事件类型 → false
 * - 未知事件类型 → false（默认不打扰）
 *
 * 大小写不敏感。
 *
 * @param eventType Matrix/Tjg 事件类型字符串
 */
export function shouldNotifyForEventType(eventType: string): boolean {
  if (!eventType) return false
  const normalized = eventType.toLowerCase()
  if (SILENT_EVENT_TYPES.has(normalized)) return false
  return NOTIFY_EVENT_TYPES.has(normalized)
}
