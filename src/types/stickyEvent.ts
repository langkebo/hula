/**
 * 粘性事件（MSC4354 sticky events）类型。
 *
 * 数据来源：`matrixRoomActionFacade.getStickyEvents()`（服务端返回 `{ events: [...] }`）。
 * `StickyEventRecord` 是协议条目，`StickyEventInfo` 是补全消息正文后的展示态。
 */
export interface StickyEventRecord {
  eventId: string
  eventType: string
  userId: string
  durationMs: number | null
  /** 过期时间戳（毫秒）；0 表示服务端未返回 */
  expiresAt: number
}

export interface StickyEventInfo extends StickyEventRecord {
  sender: string
  body: string
  timestamp: number
}
