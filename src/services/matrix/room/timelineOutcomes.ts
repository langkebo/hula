import type { IContent } from '@/services/matrix/sdk'
import { unknownToObject } from '@/utils/typeGuard'

/**
 * 消息视角统计（G-08）。
 *
 * 后端 `GET /_matrix/vendor/v1/rooms/{roomId}/event_perspective` 在 anchor 事件外
 * 附带 `perspective`：anchor 前 99 条 + anchor 的窗口统计。SDK 类型声明里没有
 * 该字段，因此在此归一化。
 */
export interface RoomEventPerspectiveStats {
  /** 窗口内事件总数 */
  eventCount: number
  /** 窗口内最新事件 ID */
  latestEventId: string | null
  /** 发送者活跃度（按条数降序） */
  senderActivity: Array<{ userId: string; count: number }>
  /** 事件类型分布（按条数降序） */
  eventTypes: Array<{ type: string; count: number }>
}

export type RoomEventPerspectiveOutcome =
  /** 端点存在且返回了 perspective */
  | { status: 'ok'; stats: RoomEventPerspectiveStats }
  /** 端点存在，但响应里没有 perspective 字段 */
  | { status: 'empty' }
  /** 端点不存在（该 homeserver 不支持） */
  | { status: 'unsupported' }
  /** 端点存在但本次读取失败（如 anchor 不可见、网络错误） */
  | { status: 'error' }

/**
 * 事件附件媒体地址（ROOM-03）。
 *
 * 后端 `GET …/rooms/{roomId}/event/{eventId}/url` 返回的是附件媒体地址
 * （`urls: [{ type, url, field }]`），SDK 声明为 `{ url?, mxc? }`，两者形状不一致，
 * 因此在此统一归一化；`httpUrl` 为 `mxc://` 解析后的可访问地址。
 */
export interface RoomEventMediaUrl {
  /** 地址类型，后端当前仅返回 `mxc` */
  type: string
  /** 原始地址（`mxc://…` 或 http(s)） */
  url: string
  /** 该地址在事件 content 中的来源字段 */
  field: string
  /** 解析后的可直接访问地址；无法解析时为 null */
  httpUrl: string | null
}

export type RoomEventMediaUrlOutcome =
  /** 端点存在且事件带附件媒体（已按 url 去重） */
  | { status: 'ok'; urls: RoomEventMediaUrl[] }
  /** 端点存在但事件没有附件（如文本消息） */
  | { status: 'empty' }
  /** 端点不存在（该 homeserver 不支持） */
  | { status: 'unsupported' }
  /** 端点存在但本次读取失败（无权限、房间或事件不存在等） */
  | { status: 'error' }

/** 降采样事件条目（ROOM-03，`GET /rooms/{roomId}/reduced_events`）。 */
export interface RoomReducedEvent {
  eventId: string
  type: string
  sender: string
}

export interface RoomReducedEventsSnapshot {
  events: RoomReducedEvent[]
  /** 降采样前的原始事件数；后端未返回时为 null（不伪装 0） */
  total: number | null
}

export type RoomReducedEventsOutcome =
  | { status: 'ok'; snapshot: RoomReducedEventsSnapshot }
  | { status: 'empty' }
  | { status: 'unsupported' }
  | { status: 'error' }

/** 房间渲染结果（ROOM-03，`GET /rooms/{roomId}/rendered/`）。 */
export interface RoomRenderedEvent {
  eventId: string
  renderedContent: string
}

export interface RoomRenderedSnapshot {
  /** 后端是否报告渲染成功；未返回时为 null（不伪装 true） */
  rendered: boolean | null
  plainText: string
  events: RoomRenderedEvent[]
}

export type RoomRenderedOutcome =
  | { status: 'ok'; snapshot: RoomRenderedSnapshot }
  | { status: 'empty' }
  | { status: 'unsupported' }
  | { status: 'error' }

/** 用户时间线片段（ROOM-03，`GET /rooms/{roomId}/fragments/{userId}`）。 */
export interface RoomTimelineFragment {
  start: string
  end: string
  limited: boolean
}

export interface RoomFragmentsSnapshot {
  userId: string
  fragments: RoomTimelineFragment[]
  prevBatch: string | null
  nextBatch: string | null
}

export type RoomFragmentsOutcome =
  | { status: 'ok'; snapshot: RoomFragmentsSnapshot }
  | { status: 'empty' }
  | { status: 'unsupported' }
  | { status: 'error' }

/** 已读回执明细（ROOM-03，`GET /rooms/{roomId}/receipts/{receiptType}/{eventId}`）。 */
export interface RoomReceiptUser {
  userId: string
  ts: number | null
  threadId: string | null
}

export interface RoomReceiptSnapshot {
  receiptType: string
  eventId: string
  users: RoomReceiptUser[]
}

export type RoomReceiptsOutcome =
  | { status: 'ok'; snapshot: RoomReceiptSnapshot }
  | { status: 'empty' }
  | { status: 'unsupported' }
  | { status: 'error' }

/** 房间通知条目（与 SDK `RoomNotificationsResult.notifications` 同形）。 */
export interface RoomNotificationEntry {
  room_id: string
  event_id: string
  notification_type: string
  sender: string
  ts: number
  content: IContent
  is_read: boolean
  client_action: string
  type?: string
  timestamp?: number
  read?: boolean
  highlight?: boolean
}

/** 房间通知列表（`next_token` 为当前服务层约定字段）。 */
export interface RoomNotificationsOutcome {
  notifications: RoomNotificationEntry[]
  next_token?: string
  next_batch?: string
}

/**
 * 房间通话会话信息（后端 voip_tracking 端点未定型，SDK 声明为任意对象）。
 */
export interface RoomCallInfo {
  call_id?: string
  [key: string]: unknown
}

function toCountMap(value: unknown): Record<string, number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const counts: Record<string, number> = {}
  for (const [key, count] of Object.entries(value)) {
    if (typeof count === 'number' && Number.isFinite(count) && count > 0) counts[key] = count
  }
  return counts
}

function toSortedCountRows(map: Record<string, number>): Array<[string, number]> {
  return Object.entries(map).sort(([, a], [, b]) => b - a)
}

/** `event_perspective` 响应包（后端 synapse-rust 扩展，SDK 未声明）。 */
interface RoomEventPerspectiveResponse {
  perspective?: RoomEventPerspectivePayload
}

/** `event_perspective` 的 perspective 段（字段随后端版本变化）。 */
interface RoomEventPerspectivePayload {
  event_count?: unknown
  latest_event_id?: unknown
  sender_activity?: unknown
  event_types?: unknown
}

/**
 * 把 `event_perspective` 响应归一化为统计对象。
 *
 * 响应缺少 `perspective` 字段或类型不符时返回 null，由调用方判定为 `empty`。
 */
export function normalizePerspective(raw: unknown): RoomEventPerspectiveStats | null {
  if (typeof raw !== 'object' || raw === null) return null
  const perspective = (raw as RoomEventPerspectiveResponse).perspective
  if (typeof perspective !== 'object' || perspective === null) return null
  const record: RoomEventPerspectivePayload = perspective

  const senderActivity = toSortedCountRows(toCountMap(record.sender_activity)).map(([userId, count]) => ({
    userId,
    count
  }))
  const eventTypes = toSortedCountRows(toCountMap(record.event_types)).map(([type, count]) => ({ type, count }))

  return {
    eventCount: typeof record.event_count === 'number' && Number.isFinite(record.event_count) ? record.event_count : 0,
    latestEventId: typeof record.latest_event_id === 'string' ? record.latest_event_id : null,
    senderActivity,
    eventTypes
  }
}

/** 从 SDK 抛出的错误中提取 Matrix errcode（部分错误把 errcode 塞在 message 的 JSON 里）。 */
export { readErrcode } from '@/utils/matrixErrcode'

/** 后端媒体/事件条目的动态字段包（字段名随后端版本变化）。 */
export interface UrlFieldRecord {
  [field: string]: unknown
}

/** 按候选键顺序读取第一个非空字符串字段；全部缺失时返回空串。 */
export function readUrlField(record: UrlFieldRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return ''
}

/** 兼容后端的 `urls[]` 与 SDK 声明的 `url` / `mxc` 两种形状。 */
export function toMediaEntries(raw: unknown): Array<{ type: string; url: string; field: string }> {
  const record = unknownToObject(raw)
  if (!record) return []

  const entries: Array<{ type: string; url: string; field: string }> = []
  const list = Array.isArray(record.urls) ? record.urls : []
  for (const item of list) {
    const entry = unknownToObject(item)
    if (!entry) continue
    const url = readUrlField(entry, ['url', 'mxc'])
    if (!url) continue
    entries.push({
      type: readUrlField(entry, ['type']) || 'mxc',
      url,
      field: readUrlField(entry, ['field']) || 'url'
    })
  }

  if (entries.length === 0) {
    const url = readUrlField(record, ['url', 'mxc'])
    if (url) {
      entries.push({
        type: 'mxc',
        url,
        field: typeof record.url === 'string' && record.url.length > 0 ? 'url' : 'mxc'
      })
    }
  }

  return entries
}

/** 非空字符串归一化；缺失或空串返回 null（不伪装空值）。 */
export function toOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** 有限数字归一化；缺失或非有限值返回 null（不伪装 0）。 */
export function toOptionalFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * 把 `reduced_events` 响应归一化为快照。
 *
 * 兼容 snake_case 与 camelCase 字段；没有任何有效事件时返回 null。
 */
export function normalizeReducedEvents(raw: unknown): RoomReducedEventsSnapshot | null {
  const record = unknownToObject(raw)
  if (!record) return null
  const list = Array.isArray(record.events) ? record.events : []
  const events: RoomReducedEvent[] = []
  for (const item of list) {
    const entry = unknownToObject(item)
    if (!entry) continue
    const type = readUrlField(entry, ['type'])
    const eventId = readUrlField(entry, ['event_id', 'eventId'])
    if (!type && !eventId) continue
    events.push({ eventId, type, sender: readUrlField(entry, ['sender']) })
  }
  if (events.length === 0) return null
  return { events, total: toOptionalFiniteNumber(record.total) }
}

/**
 * 把 `rendered` 响应归一化为快照。
 *
 * 纯文本、事件渲染结果与 `rendered` 标记全为空时返回 null。
 */
export function normalizeRendered(raw: unknown): RoomRenderedSnapshot | null {
  const record = unknownToObject(raw)
  if (!record) return null
  const list = Array.isArray(record.events) ? record.events : []
  const events: RoomRenderedEvent[] = []
  for (const item of list) {
    const entry = unknownToObject(item)
    if (!entry) continue
    const eventId = readUrlField(entry, ['event_id', 'eventId'])
    const renderedContent = readUrlField(entry, ['rendered_content', 'renderedContent'])
    if (!eventId && !renderedContent) continue
    events.push({ eventId, renderedContent })
  }
  const plainText = readUrlField(record, ['plain_text', 'plainText'])
  const rendered = typeof record.rendered === 'boolean' ? record.rendered : null
  if (!plainText && events.length === 0 && rendered !== true) return null
  return { rendered, plainText, events }
}

/**
 * 把 `fragments` 响应归一化为时间线片段快照。
 *
 * 缺少 `start`／`end` 的片段被丢弃；没有有效片段时返回 null。
 */
export function normalizeFragments(raw: unknown, fallbackUserId: string): RoomFragmentsSnapshot | null {
  const record = unknownToObject(raw)
  if (!record) return null
  const list = Array.isArray(record.fragments) ? record.fragments : []
  const fragments: RoomTimelineFragment[] = []
  for (const item of list) {
    const entry = unknownToObject(item)
    if (!entry) continue
    const start = readUrlField(entry, ['start'])
    const end = readUrlField(entry, ['end'])
    if (!start || !end) continue
    fragments.push({ start, end, limited: entry.limited === true })
  }
  if (fragments.length === 0) return null
  return {
    userId: readUrlField(record, ['user_id', 'userId']) || fallbackUserId,
    fragments,
    prevBatch: toOptionalString(record.prev_batch),
    nextBatch: toOptionalString(record.next_batch)
  }
}

function toReceiptUsers(value: unknown): RoomReceiptUser[] {
  const record = unknownToObject(value)
  if (!record) return []
  const users: RoomReceiptUser[] = []
  for (const [userId, entry] of Object.entries(record)) {
    if (!userId) continue
    const detail = unknownToObject(entry)
    users.push({
      userId,
      ts: toOptionalFiniteNumber(detail?.ts),
      threadId: toOptionalString(detail?.thread_id)
    })
  }
  return users
}

/**
 * 把 `receipts` 响应按回执类型与事件 ID 过滤后归一化为用户列表。
 *
 * 响应体缺失时返回 null；过滤后无用户时返回空数组，由调用方判定为 `empty`。
 */
export function normalizeReceipts(raw: unknown, receiptType: string, eventId: string): RoomReceiptSnapshot | null {
  const record = unknownToObject(raw)
  if (!record) return null
  const collected: RoomReceiptUser[] = []
  const list = Array.isArray(record.receipts) ? record.receipts : []
  for (const item of list) {
    const entry = unknownToObject(item)
    if (!entry) continue
    const entryType = readUrlField(entry, ['type', 'receipt_type', 'receiptType'])
    const entryEventId = readUrlField(entry, ['event_id', 'eventId'])
    if (entryType && entryType !== receiptType) continue
    if (entryEventId && entryEventId !== eventId) continue
    collected.push(...toReceiptUsers(entry.users))
  }
  if (collected.length === 0) collected.push(...toReceiptUsers(record.users))

  const seen = new Set<string>()
  const users = collected.filter((user) => {
    if (seen.has(user.userId)) return false
    seen.add(user.userId)
    return true
  })
  return users.length > 0 ? { receiptType, eventId, users } : null
}
