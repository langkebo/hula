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

export interface ServerHealth {
  healthy: boolean
  checks?: Record<string, unknown>
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
  state: Array<{ type: string; stateKey: string; content: Record<string, unknown> }>
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
}

export interface FederationBlacklistEntry {
  domain: string
  reason?: string | undefined
  addedBy?: string | undefined
  addedAt?: number
}

export interface ServerNoticeResult {
  eventId?: string | undefined
}

export interface ServerNoticeInfo {
  userId: string
  sentTs?: number | undefined
  content?: Record<string, unknown> | undefined
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
