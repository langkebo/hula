import type {
  AccountStatus,
  AdminAccountDetails,
  AdminEventContext,
  AdminEventContextEvent,
  AdminInfoResponse,
  AdminRoomListings,
  AdminRoomSearchItem,
  AdminServerConfig,
  IContent,
  RoomStats,
  SpaceInfo,
  SpaceStats,
  UserPusher,
  UserSession,
  UserStatsListResponse,
  UserStatsResponse,
  WhoisResponse
} from '@/services/matrix/sdk'

export interface ServerStats {
  roomCount: number
  userCount: number
  dailyActiveUsers: number
  monthlyActiveUsers: number
  messageCount: number
}

export interface ServerStatus {
  status: string
}

/**
 * `/health` 的附加检查项映射：键为检查名，值为该检查的原始结果。
 * 检查项由部署侧插件决定，字段不固定，属真·动态包。
 */
export interface ServerHealthChecks {
  [checkName: string]: unknown
}

export interface ServerHealth {
  healthy: boolean
  checks?: ServerHealthChecks
}

/**
 * 服务器配置更新载荷：键由 synapse-rust 配置项决定，部署侧可增删，属真·动态包。
 */
export interface ServerConfigUpdate {
  [configKey: string]: unknown
}

export interface ServerVersion {
  serverVersion: string
  pythonVersion?: string
}

export interface UserInfo {
  userId: string
  name?: string | undefined
  avatarUrl?: string | undefined
  admin?: boolean | undefined
  deactivated?: boolean | undefined
  isGuest?: boolean | undefined
  createdTs?: number | undefined
  displayname?: string | undefined
}

export interface UserDevice {
  deviceId: string
  displayName?: string | undefined
  lastSeenIp?: string | undefined
  lastSeenTs?: number | undefined
  userAgent?: string | undefined
}

export interface RateLimit {
  messagesPerSecond?: number | undefined
  burstCount?: number | undefined
}

export interface ShadowBanStatus {
  banned: boolean
  bannedAt?: number | undefined
}

export interface RoomInfo {
  roomId: string
  name?: string | undefined
  topic?: string | undefined
  joinedMembers: number
  joinedLocalMembers: number
  invitedMembers: number
  invitedLocalMembers: number
  createTime?: number | undefined
  creator?: string | undefined
  public?: boolean | undefined
}

export interface RoomState {
  state: Array<{ type: string; stateKey: string; content: IContent }>
}

/** 房间消息条目：后端 `getRoomMessages` 返回的原始客户端事件，字段随事件类型变化。 */
export interface AdminRoomMessageChunkItem {
  event_id?: string
  type?: string
  sender?: string
  origin_server_ts?: number
  content?: IContent
  [field: string]: unknown
}

export interface ShutdownRoomResult {
  kickedUsers: string[]
  failedToKickUsers: string[]
}

export interface FederationDestination {
  destination: string
  retryLastTs?: number | undefined
  retryInterval?: number | undefined
  failureTs?: number | undefined
  lastSuccessfulTs?: number | undefined
  failureCount?: number | undefined
  status?: string | undefined
  updatedTs?: number | undefined
}

export interface FederationBlacklistEntry {
  domain: string
  reason?: string | undefined
  addedBy?: string | undefined
  addedAt?: number
}

export interface FederationCacheEntry {
  key: string
  value: unknown
  expiryTs: number | null
}

export interface FederationCachePage {
  entries: FederationCacheEntry[]
  total: number
}

export interface PendingFederationServer {
  serverName: string
  failureCount: number
  lastFailedConnectAt: number | null
  lastSuccessfulConnectAt: number | null
  status: string
  updatedTs: number | null
}

export interface PendingFederationPage {
  servers: PendingFederationServer[]
  total: number
  limit: number
  nextBatch?: string | undefined
}

export interface ServerNoticeResult {
  eventId?: string | undefined
}

export interface ServerNoticeInfo {
  userId: string
  sentTs?: number | undefined
  content?: IContent | undefined
}

/** 系统通知条目（由服务端通知记录归一化而来）。 */
export interface SystemNotificationInfo {
  id: string
  content: string
  type: string
  targetUsers: string[]
  createdAt: number | null
}

export interface RegistrationToken {
  token: string
  usesAllowed?: number | undefined
  pending: number
  completed: number
  expiryTime?: number | undefined
}

export interface ReportRequest {
  roomId: string
  eventId: string
  reason: string
  explanation?: string | undefined
}

// 与 SDK 权威形状（matrix-js-sdk/admin `AdminReport`，对照后端 report.rs::report_to_json）对齐。
export interface AdminReport {
  id: number
  room_id: string
  event_id: string
  user_id: string
  reported_user_id: string | null
  reason: string | null
  content: string | null
  status: string
  score: number
  received_ts: number
}

export interface ReportRoomResponse {
  report_id: string
}

export interface ScannerInfo {
  scanner_id: string
  scan_result: string
  confidence: number
  scanned_at: number
}

export interface Report {
  id: string
  eventId: string
  roomId: string
  reporterUserId: string
  reportedUserId: string
  reason: string
  score: number
  status: 'open' | 'resolved' | 'dismissed'
  createdAt: number
  resolvedAt?: number
  resolvedBy?: string
  resolution?: string
}

export interface ReportFilters {
  status?: 'open' | 'resolved' | 'dismissed'
  roomId?: string
  reporterUserId?: string
  reportedUserId?: string
  from?: number
  to?: number
  limit?: number
  offset?: number
}

export interface UserReputation {
  userId: string
  score: number
  level: 'good' | 'neutral' | 'warning' | 'bad'
  reportCount: number
  lastReportAt?: number
  restrictions: string[]
}

export interface ContentFilter {
  id: string
  type: 'keyword' | 'regex' | 'image_hash'
  pattern: string
  action: 'flag' | 'block' | 'quarantine'
  enabled: boolean
  createdAt: number
  updatedAt: number
  hitCount: number
}

export interface CreateContentFilterRequest {
  type: 'keyword' | 'regex' | 'image_hash'
  pattern: string
  action: 'flag' | 'block' | 'quarantine'
}

export interface ResolveReportRequest {
  action: 'dismiss' | 'warn' | 'mute' | 'ban'
  notes?: string
}

// ── 媒体配额（2026-10-11 对齐后端真实响应形状）──────────────────────────────
// 后端只有 4 条 quota 路由（`registered_routes`）：
//   GET /_matrix/media/v1/quota/{check,stats,alerts}、GET /_synapse/admin/v1/media/quota
// 旧类型的字段（`totalFiles`/`byType`/`byRoom`/`lastUpdated`、`QuotaAlert.id/type/...`、
// `ServerQuota.totalUsed/totalLimit/userCount/averageUsage`、以及整个 `QuotaConfig`）
// 都是**凭空声明**的形状，后端从不返回 —— 已按真实响应重写/删除。

export interface QuotaStatus {
  used: number
  limit: number
  remaining: number
  /** 由 used/limit 推导（后端不返回） */
  percentage: number
  /** 由 used/limit 推导（后端不返回） */
  exceeded: boolean
}

/** `GET /_matrix/media/v1/quota/stats` 的响应（SDK `MediaQuotaStatsResponse`） */
export interface QuotaStats {
  storageBytes: number
  mediaCount: number
  limitBytes: number
}

/** `GET /_matrix/media/v1/quota/alerts` 的条目（SDK `MediaQuotaAlert`，snake_case） */
export interface QuotaAlert {
  alert_id: string
  alert_type: 'quota_warning' | 'quota_exceeded'
  threshold_percent: number
  current_usage_bytes: number
  quota_limit_bytes: number
  message: string
  created_ts: number
  is_read: boolean
}

/** `GET /_synapse/admin/v1/media/quota` 的响应（SDK `MediaQuotaResponse`） */
export interface ServerQuota {
  totalSize: number
  totalCount: number
  defaultSizeLimit: number
  defaultCountLimit: number
}

export interface RetentionPolicy {
  min_lifetime?: number | undefined
  max_lifetime?: number | undefined
}

export interface RoomRetention {
  roomId: string
  policy?: RetentionPolicy | undefined
}

export interface EventReport {
  id: number
  event_id: string
  room_id: string
  reporter_user_id: string
  reported_user_id: string
  reason: string
  description: string | null
  status: 'open' | 'resolved' | 'dismissed' | 'escalated'
  score: number
  received_ts: number
  resolved_ts: number | null
  resolved_by: string | null
  resolution_reason: string | null
}

/**
 * `GET /_synapse/admin/v1/rooms/{room_id}/token_sync` 的单条记录。
 *
 * 逐字对照后端 `AdminRoomTokenSyncEntry`（18 键）。此前本层用匿名 Record
 * 把结构抹平了，UI 只能 `JSON.stringify` 整块 —— 字段名一改、界面也不会报错。
 */
export interface AdminRoomTokenSyncEntry {
  user_id: string
  device_id: string
  conn_id: string | null
  list_key: string | null
  pos: number | null
  token_created_ts: number | null
  token_expires_at: number | null
  /** 缺失时后端回填 0 */
  room_timestamp: number
  room_updated_ts: number
  /** 缺失时后端回填 0 */
  bump_stamp: number
  highlight_count: number
  notification_count: number
  is_dm: boolean
  is_encrypted: boolean
  is_tombstoned: boolean
  /** 后端键名是 `invited`，值来自 `is_invited` */
  invited: boolean
  name: string | null
  avatar: string | null
  is_expired: boolean
}

export interface AdminRoomTokenSyncSummary {
  active_token_count: number
  expired_token_count: number
  distinct_users: number
  distinct_devices: number
}

/**
 * `GET /_synapse/admin/v1/rooms/{room_id}/token_sync` 的响应。
 *
 * ⚠️ 不是 `{stream_ordering}` 之类：后端返回的是**分页 token 列表 + 汇总统计**。
 */
export interface AdminRoomTokenSync {
  room_id: string
  results: AdminRoomTokenSyncEntry[]
  total: number
  next_batch: string | null
  summary: AdminRoomTokenSyncSummary
}

// ── 管理域 DTO（2026-11 类型收口）────────────────────────────────────────────
// SDK 已有权威形状的直接 `Partial<SDK 类型>` 复用；后端扩展端点在此具名建模。
// 不再额外挂 `Record` 交叉类型兜底：SDK 契约缺字段就补到具体类型上，
// 需要动态取键的 DTO 自带具名索引签名接口。

/** `GET /_synapse/admin/v1/rooms/{room_id}` 等列表形态（SDK `AdminRoomListings`）。 */
export type AdminRoomListingsInfo = Partial<AdminRoomListings>

/** `GET /_synapse/admin/v1/room_stats/{room_id}`（SDK `RoomStats`）。 */
export type AdminRoomStatsInfo = Partial<RoomStats>

/** `GET /_synapse/admin/v1/rooms/{room_id}/event_context/{event_id}`（SDK `AdminEventContext`）。 */
export type AdminRoomEventContextInfo = Partial<AdminEventContext>

/** 事件上下文与房间内搜索的单条事件（SDK `AdminEventContextEvent`）。 */
export type AdminRoomEventItem = Partial<AdminEventContextEvent>

/**
 * v1 房间搜索条目相对 SDK `AdminRoomSearchItem` 的扩展字段。
 *
 * `/v1/rooms/search` 用 `joined_members` / `joined_local_members` / `public`，
 * 而 SDK 的 `AdminRoomSearchItem` 对应的是 Space 房间搜索（`member_count` / `is_public`）。
 * 两个端点字段集不同，这里显式建模 v1 侧差异，不再用索引签名兜底。
 */
export interface AdminRoomSearchItemExtensions {
  joined_members?: number
  joined_local_members?: number
  public?: boolean
}

/** `POST /_synapse/admin/v1/rooms/search` 的条目（SDK `AdminRoomSearchItem` + v1 扩展字段）。 */
export type AdminRoomSearchResultItem = Partial<AdminRoomSearchItem> & AdminRoomSearchItemExtensions

/**
 * `GET /_synapse/admin/v1/rooms/{room_id}/forward_extremities`（SDK `AdminRoomForwardExtremities`）。
 *
 * 后端返回**前向极点数（整数）**，不是极点对象数组；服务层归一为 camelCase。
 */
export interface AdminRoomForwardExtremitiesInfo {
  roomId: string
  forwardExtremities: number
}

/** Space 条目（SDK `SpaceInfo`）。 */
export type AdminSpaceInfo = Partial<SpaceInfo>

/** `GET /_synapse/admin/v1/spaces/{space_id}/users` 的单条成员。 */
export interface AdminSpaceUser {
  user_id?: string
  displayname?: string | null
  avatar_url?: string | null
  [key: string]: unknown
}

/** `GET /_synapse/admin/v1/spaces/{space_id}/rooms` 的单条房间。 */
export interface AdminSpaceRoom {
  room_id?: string
  name?: string | null
  [key: string]: unknown
}

/** `GET /_synapse/admin/v1/spaces/{space_id}/stats`（SDK `SpaceStats`）。 */
export type AdminSpaceStatsInfo = Partial<SpaceStats>

/** `GET /_synapse/admin/v1/users/{user_id}/stats`（SDK `UserStatsResponse`）。 */
export type AdminUserStats = Partial<UserStatsResponse>

/** 用户统计列表条目（SDK `UserStatsListResponse`）。 */
export type AdminUserStatsOverview = Partial<UserStatsListResponse>

/**
 * 会话条目的历史字段别名。
 *
 * SDK `UserSession` 用 `display_name` / `last_seen_ip` / `last_seen_ts`，
 * 但既有调用方同时读取 `device_name` 与 camelCase 形态（服务层归一化前后的兼容读取）。
 * 这些别名不在 SDK 契约内，故显式列出，避免整型退化为索引签名。
 */
export interface AdminUserSessionAliases {
  device_name?: string | null
  deviceId?: string
  deviceName?: string
  lastSeenIp?: string
  lastSeenTs?: number
}

/** 用户会话条目（SDK `UserSession` + 历史别名）。 */
export type AdminUserSession = Partial<UserSession> & AdminUserSessionAliases

/** `GET /_synapse/admin/v1/whois/{user_id}`（SDK `WhoisResponse`）。 */
export type AdminWhoisInfo = Partial<WhoisResponse>

/** 账户详情（SDK `AdminAccountDetails`）。 */
export type AdminAccountInfo = Partial<AdminAccountDetails>

/** 账户信息更新载荷：只提交允许修改的字段，未列出的字段由服务端忽略。 */
export type AdminAccountInfoUpdate = Partial<AdminAccountDetails>

/** 账户状态（SDK `AccountStatus`）。 */
export type AdminAccountStatusInfo = Partial<AccountStatus>

/** `GET /_synapse/admin/v1/login_failures` 的条目（后端扩展端点）。 */
export interface AdminLoginFailure {
  user_id?: string
  ip?: string
  timestamp?: number
  created_ts?: number
  failure_reason?: string
  reason?: string
  [key: string]: unknown
}

/** `GET /_synapse/admin/v1/login_failures` 的响应壳。 */
export interface AdminLoginFailurePage {
  failures: AdminLoginFailure[]
  total?: number
  next_token?: string
}

/**
 * 审计 / 安全事件的附加字段。
 *
 * 键随事件类型变化（如 `room_id`、`device_id`、`user_agent`），后端未提供固定 schema，
 * 属真·动态包，故具名承载而非内联匿名 Record。
 */
export interface AdminEventDetails {
  [field: string]: unknown
}

/** `GET /_synapse/admin/v1/audit/events` 的单条审计记录（SDK `AuditEvent`）。 */
export interface AdminAuditLogEntry {
  event_id?: string
  actor_id?: string
  action?: string
  resource_type?: string
  resource_id?: string
  result?: string
  request_id?: string
  created_ts?: number
  details?: AdminEventDetails
  [key: string]: unknown
}

/** `GET /_synapse/admin/v1/audit/events` 的响应壳。 */
export interface AdminAuditLogPage {
  logs: AdminAuditLogEntry[]
  next_batch?: string | undefined
}

/** `GET /_synapse/admin/v1/federation/destinations/{server}` 的状态视图（后端扩展端点）。 */
export interface AdminFederationServerStatus {
  destination?: string
  reachable?: boolean
  failure_count?: number
  retry_interval?: number
  last_successful_stream_ordering?: number
  last_successful_ts?: number
  [key: string]: unknown
}

/** `GET /_synapse/admin/v1/security/events` 的单条安全事件（后端扩展端点）。 */
export interface AdminSecurityEvent {
  event_type?: string
  ip?: string
  user_id?: string
  timestamp?: number
  details?: AdminEventDetails
  [key: string]: unknown
}

/** `GET /_synapse/admin/v1/security/events` 的响应壳。 */
export interface AdminSecurityEventsPage {
  events: AdminSecurityEvent[]
  nextToken?: string | undefined
}

/** `GET /_synapse/admin/v1/security/ip_blocks` 的单条 IP 封禁记录（后端扩展端点）。 */
export interface AdminIpBlock {
  ip?: string
  reason?: string
  blocked_at?: number
  created_ts?: number
  created_at?: number
  blocked_by?: string
  created_by?: string
  [key: string]: unknown
}

/** `GET /_synapse/admin/v1/security/ip_reputation/{ip}` 的响应（后端扩展端点）。 */
export interface AdminIpReputation {
  ip?: string
  reputation?: string
  score?: number
  blocked?: boolean
  last_seen_ts?: number
  [key: string]: unknown
}

/** `GET /_synapse/admin/v1/server/logs` 的单条日志（后端扩展端点）。 */
export interface AdminServerLogEntry {
  timestamp?: number
  level?: string
  target?: string
  message?: string
  [key: string]: unknown
}

/** `GET /_synapse/admin/v1/config` 的配置视图（SDK `AdminServerConfig`）。 */
export type AdminServerConfigInfo = Partial<AdminServerConfig>

/** `GET /_synapse/admin/info` 的管理端信息（SDK `AdminInfoResponse`）。 */
export type AdminInfo = Partial<AdminInfoResponse>

/** Pusher 条目（SDK `UserPusher`）。 */
export type AdminUserPusher = Partial<UserPusher>
