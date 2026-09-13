/**
 * Shared types and interfaces for the Matrix thread subsystem.
 *
 * Extracted from MatrixThreadService.ts to enable collaborative class split
 * (MatrixThreadApi / MatrixThreadState / threadUtils) without circular imports.
 */

type MsgType = string

export interface IContent {
  [key: string]: unknown
}

export interface RelatesTo {
  rel_type: string
  event_id?: string
  'm.in_reply_to'?: {
    event_id?: string
  }
}

export interface MessageContent {
  msgtype?: MsgType
  body: string
  format?: string
  formatted_body?: string
  'm.relates_to'?: RelatesTo
  mute?: boolean
  frozen?: boolean
  freeze?: boolean
  [key: string]: unknown
}

export interface Thread {
  id: string
  rootEventId: string
  roomId: string
  replyCount: number
  lastReply?: {
    eventId: string
    sender: string
    timestamp: number
    content: IContent
  }
  participants: string[]
}

export interface ThreadMessage {
  eventId: string
  sender: string
  content: IContent
  timestamp: number
  inReplyTo?: string
}

export interface ThreadDisplayMessage {
  eventId: string
  sender: string
  senderName: string
  avatarUrl?: string
  content: string
  timestamp: number
  inReplyTo?: string
}

export interface ThreadViewData {
  thread: Thread | null
  rootMessage: ThreadDisplayMessage | null
  replies: ThreadDisplayMessage[]
}

export interface ThreadListItem {
  id: string
  roomId: string
  threadId: string
  rootEventId: string
  rootSender: string
  rootContent: unknown
  rootOriginServerTs: number
  latestEventId: string
  latestSender: string
  latestContent: unknown
  latestOriginServerTs: number
  replyCount: number
  participants: string[]
  isFrozen: boolean
  createdTs: number
  updatedTs?: number
}

export interface ThreadStatistics {
  totalReplies: number
  totalParticipants: number
  totalEdits: number
  totalRedactions: number
  firstReplyTs?: number
  lastReplyTs?: number
  avgReplyTimeMs?: number
}

export interface ThreadSubscription {
  notificationLevel: string
  isMuted: boolean
  subscribedTs?: number
}

/* ------------------------------------------------------------------------- *
 * 以下类型逐字段镜像 `@langkebo/matrix-js-sdk@40.2.0-langkebo.1`
 * `src/threading/index.ts` 的导出类型（后端 synapse-rust 原生 snake_case 形状）。
 *
 * 维护约定（2026-09-10 校准）：
 * 1. **不要在这里做 camelCase 重命名** —— 这些是后端原始形状，重命名由
 *    MatrixThreadApi 的 `map*` 私有方法统一负责；
 * 2. SDK 侧字段/签名变更时必须同步本段，否则会重现 S-13「签名漂移」类缺陷；
 * 3. SDK 已补 `./threading` 子路径导出（见 matrix-js-sdk/package.json），
 *    待 vendor tgz 重新打包并刷新 `meta/sdk-pin.json` 后，本段可整体替换为
 *    `import type { ... } from 'matrix-js-sdk/threading'`，彻底消除手工镜像。
 * ------------------------------------------------------------------------- */

/** 线程摘要（snake_case）。对应后端 ThreadSummary，也是列表/搜索接口的数组元素。 */
export interface ThreadSummaryResponse {
  id: number
  room_id: string
  thread_id: string
  root_event_id: string
  root_sender: string
  root_content: IContent
  root_origin_server_ts: number
  latest_event_id: string | null
  latest_sender: string | null
  latest_content: IContent | null
  latest_origin_server_ts: number | null
  reply_count: number
  participants: unknown
  is_frozen: boolean
  created_ts: number
  updated_ts: number
}

/** 线程已读回执。注意：**未读**接口返回的 `threads` 元素是这个类型，不是线程摘要。 */
export interface ThreadReadReceiptResponse {
  id: number
  room_id: string
  thread_id: string
  user_id: string
  last_read_event_id: string | null
  last_read_ts: number
  unread_count: number
  updated_ts: number
}

/** 线程订阅。含 id/room_id/thread_id/user_id 主键字段。 */
export interface ThreadSubscriptionResponse {
  id: number
  room_id: string
  thread_id: string
  user_id: string
  notification_level: string
  is_muted: boolean
  subscribed_ts: number
  updated_ts: number
}

/** 线程回复。 */
export interface ThreadReplyResponse {
  event_id: string
  thread_id: string
  room_id: string
  sender: string
  content: IContent
  origin_server_ts: number
  in_reply_to_event_id: string | null
  is_edited: boolean
  is_redacted: boolean
}

/** 创建线程返回值。 */
export interface ThreadCreateResponse {
  thread_id: string | null
  root_event_id: string
  room_id: string
  sender: string
  reply_count: number
  last_reply_event_id: string | null
  last_reply_sender: string | null
  last_reply_ts: number | null
  participants: unknown
  is_fetched: boolean
  created_ts: number
}

/** 线程根事件。注意它**不是** `getRoomThread` 的返回值，只是其中的 `root` 字段。 */
export interface ThreadRootResponse {
  id: number
  room_id: string
  root_event_id: string
  sender: string
  thread_id: string | null
  reply_count: number
  last_reply_event_id: string | null
  last_reply_sender: string | null
  last_reply_ts: number | null
  participants: unknown
  is_fetched: boolean
  created_ts: number
  updated_ts: number | null
}

/** 线程详情。`getRoomThread` 返回的是这个**嵌套**结构，不是扁平的 ThreadRootResponse。 */
export interface ThreadDetailResponse {
  root: ThreadRootResponse
  replies: ThreadReplyResponse[]
  reply_count: number
  participants: string[]
  summary: ThreadSummaryResponse | null
  user_receipt: ThreadReadReceiptResponse | null
  user_subscription: ThreadSubscriptionResponse | null
}

/** 线程列表（keyset 分页）。`next_batch` 为 string | null，非可选。 */
export interface ThreadListResponse {
  threads: ThreadSummaryResponse[]
  next_batch: string | null
  total: number
}

/** 未读线程聚合。`threads` 元素为已读回执类型。 */
export interface ThreadUnreadResponse {
  threads: ThreadReadReceiptResponse[]
  total_unread: number
  total_threads: number
}

/** 已订阅线程（MSC4155/4156）。F-8：此前被 `Array.isArray` 误判，恒返空。 */
export interface SubscribedThreadsResponse {
  threads: ThreadSummaryResponse[]
  subscribed: ThreadSubscriptionResponse[]
  next_batch?: string | null
}

/** 旧版线程列表元素（MSC3026）。 */
export interface ThreadLegacyChunkItem {
  event_id: string
  sender: string
  content: IContent
  origin_server_ts: number
}

/** 旧版线程列表（MSC3026）。 */
export interface ThreadLegacySearchResponse {
  chunk: ThreadLegacyChunkItem[]
  next_batch: string | null
}

/** 线程统计。 */
export interface ThreadStatisticsResponse {
  id: number
  room_id: string
  thread_id: string
  total_replies: number
  total_participants: number
  total_edits: number
  total_redactions: number
  first_reply_ts: number | null
  last_reply_ts: number | null
  avg_reply_time_ms: number | null
  created_ts: number
  updated_ts: number
}

/** 列表查询参数（SDK ThreadListQuery）。 */
export interface ThreadListQuery {
  limit?: number
  from?: string
  includeAll?: boolean
}

/** 搜索查询参数（SDK ThreadSearchQuery）。 */
export interface ThreadSearchQuery {
  q: string
  limit?: number
}

/** 回复列表查询参数（SDK ThreadRepliesQuery）。 */
export interface ThreadRepliesQuery {
  limit?: number
  from?: string
}

/** 详情查询参数（SDK ThreadDetailQuery）。 */
export interface ThreadDetailQuery {
  includeReplies?: boolean
  replyLimit?: number
}

/** 创建线程参数（SDK ThreadCreateParams）。 */
export interface ThreadCreateParams {
  roomId?: string
  rootEventId: string
  content?: IContent
  originServerTs?: number
}

/** 添加回复参数（SDK ThreadReplyCreateParams）。 */
export interface ThreadReplyCreateParams {
  eventId: string
  rootEventId: string
  content: IContent
  inReplyToEventId?: string
  originServerTs?: number
}

/**
 * ThreadingManager 兼容接口 — 与 SDK `ThreadingManager` 公开方法**逐一校准**
 * （对照 `matrix-js-sdk/src/threading/index.ts`，2026-09-10）。
 *
 * 本轮修正的错配：
 * - `getRoomThread`：返回 `ThreadDetailResponse`（嵌套 root/replies/summary），
 *   此前误声明为扁平的 ThreadRootResponse 形状；
 * - `searchRoomThreads` / `getRoomThreadList`：元素为 `ThreadSummaryResponse`
 *   （snake_case），此前误用 camelCase 的 `ThreadListItem`；
 * - `getGlobalUnreadThreads` / `getRoomUnreadThreads`：`threads` 元素为
 *   `ThreadReadReceiptResponse`，此前用 `unknown[]` 掩盖；
 * - `markThreadRead`：`originServerTs` 在 SDK 中有默认值，应为可选；
 * - `getThreadStats`：SDK 返回可为 `null`；
 * - `subscribeToThread` / `muteThread`：补全 id/room_id/thread_id/user_id；
 * - `getLegacyRoomThreadList`：`next_batch` 为 `string | null`（必填）。
 */
export interface ThreadingManagerCompat {
  getGlobalThreadList?: (query?: ThreadListQuery) => Promise<ThreadListResponse>

  createGlobalThread?: (params: ThreadCreateParams) => Promise<ThreadCreateResponse>

  getSubscribedThreads?: (query?: { limit?: number; from?: string }) => Promise<SubscribedThreadsResponse>

  getGlobalUnreadThreads?: () => Promise<ThreadUnreadResponse>

  createRoomThread?: (
    roomId: string,
    rootEventId: string,
    options?: Pick<ThreadCreateParams, 'content' | 'originServerTs'>
  ) => Promise<ThreadCreateResponse>

  getRoomThreadList?: (roomId: string, query?: ThreadListQuery) => Promise<ThreadListResponse>

  searchRoomThreads?: (roomId: string, query: ThreadSearchQuery) => Promise<ThreadSummaryResponse[]>

  getRoomUnreadThreads?: (roomId: string) => Promise<ThreadUnreadResponse>

  getRoomThread?: (roomId: string, threadId: string, query?: ThreadDetailQuery) => Promise<ThreadDetailResponse>

  deleteRoomThread?: (roomId: string, threadId: string) => Promise<void>

  freezeThread?: (roomId: string, threadId: string) => Promise<void>

  unfreezeThread?: (roomId: string, threadId: string) => Promise<void>

  addThreadReply?: (roomId: string, threadId: string, params: ThreadReplyCreateParams) => Promise<ThreadReplyResponse>

  getThreadReplies?: (roomId: string, threadId: string, query?: ThreadRepliesQuery) => Promise<ThreadReplyResponse[]>

  subscribeToThread?: (
    roomId: string,
    threadId: string,
    notificationLevel?: string
  ) => Promise<ThreadSubscriptionResponse>

  unsubscribeFromThread?: (roomId: string, threadId: string) => Promise<void>

  muteThread?: (roomId: string, threadId: string) => Promise<ThreadSubscriptionResponse>

  markThreadRead?: (
    roomId: string,
    threadId: string,
    eventId: string,
    originServerTs?: number
  ) => Promise<ThreadReadReceiptResponse>

  getThreadStats?: (roomId: string, threadId: string) => Promise<ThreadStatisticsResponse | null>

  redactThreadReply?: (roomId: string, eventId: string) => Promise<void>

  getLegacyRoomThreadList?: (
    userId: string,
    roomId: string,
    query?: ThreadListQuery
  ) => Promise<ThreadLegacySearchResponse>
}
