import { EXTENSION_NOTIFY_EVENT_TYPES, shouldNotifyForEventType } from '@/services/matrix/notifications/pushRules'

/**
 * §9.2.5 推送规则扩展 composable
 *
 * 在 Vue 组件中提供对 Tjg 扩展推送规则（friend_request / widget_event / ai_tool_result）
 * 的响应式访问。底层逻辑复用 {@link shouldNotifyForEventType} 与 {@link EXTENSION_NOTIFY_EVENT_TYPES}，
 * 保持纯函数语义,便于组件按通知优先级过滤/排序事件。
 *
 * 使用示例:
 * ```ts
 * const { shouldNotify, isExtensionEvent, getExtensionEventTypes } = usePushRulesExtended()
 * const notifiableEvents = events.filter((e) => shouldNotify(e.type))
 * ```
 */
export function usePushRulesExtended() {
  /**
   * 判断事件类型是否应触发推送通知。
   * 包装 pushRules 模块的 shouldNotifyForEventType,大小写不敏感。
   *
   * @param eventType Matrix/Tjg 事件类型字符串
   */
  function shouldNotify(eventType: string): boolean {
    return shouldNotifyForEventType(eventType)
  }

  /**
   * 判断事件类型是否属于 Tjg 扩展事件（friend_request/widget_event/ai_tool_result）。
   * 大小写不敏感。
   *
   * @param eventType Matrix/Tjg 事件类型字符串
   */
  function isExtensionEvent(eventType: string): boolean {
    if (!eventType) return false
    return EXTENSION_NOTIFY_EVENT_TYPES.has(eventType.toLowerCase())
  }

  /**
   * 返回当前所有 Tjg 扩展事件类型列表。
   * 返回新数组,调用方可安全修改。
   */
  function getExtensionEventTypes(): string[] {
    return Array.from(EXTENSION_NOTIFY_EVENT_TYPES)
  }

  return {
    shouldNotify,
    isExtensionEvent,
    getExtensionEventTypes
  }
}
