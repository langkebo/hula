/**
 * 读取房间/空间主题（`m.room.topic` 状态事件）的**唯一入口**。
 *
 * 背景（2026-10-11 审计 §13）：前端曾直接读 `room.topic`，但本 fork 的 `Room` 类
 * **没有 `topic` 属性**（类型增强里那条 `interface Room { topic?: string }` 是幻影声明），
 * 于是这些读取点运行时恒为 `undefined` ⇒ 空间/房间简介静默为空。
 * 主题的真实来源是状态事件 `m.room.topic`（state key 为空串）。
 */

interface RoomStateLike {
  currentState?: {
    getStateEvents?: (eventType: string, stateKey?: string) => unknown
  } | null
}

interface MatrixEventLike {
  getContent?: () => unknown
}

/**
 * 读取房间主题。
 *
 * @returns 主题字符串；未设置 / 内容为空 / 非字符串 ⇒ null
 */
export function getRoomTopic(room: RoomStateLike | null | undefined): string | null {
  if (!room) return null
  let event: unknown
  try {
    event = room.currentState?.getStateEvents?.('m.room.topic', '')
  } catch {
    return null
  }

  // `getStateEvents(type, stateKey)` 在给定 stateKey 时返回单个事件（也可能是数组，取决于 SDK 版本）
  const candidate = Array.isArray(event) ? event[0] : event
  const content = (candidate as MatrixEventLike | undefined)?.getContent?.()
  if (!content || typeof content !== 'object') return null
  const topic = (content as { topic?: unknown }).topic
  return typeof topic === 'string' && topic.length > 0 ? topic : null
}
