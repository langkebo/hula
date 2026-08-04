export interface ServerStats {
  roomCount: number
  userCount: number
  dailyActiveUsers: number
  monthlyActiveUsers: number
  messageCount: number
  startServerTime: number
}

export interface ServerStatus {
  status: string
  uptime?: number
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
  name?: string
  avatarUrl?: string
  admin?: boolean
  deactivated?: boolean
  isGuest?: boolean
  createdTs?: number
  displayname?: string
  lastSeenTs?: number
}

export interface UserDevice {
  deviceId: string
  displayName?: string
  lastSeenIp?: string
  lastSeenTs?: number
  userAgent?: string
}

export interface RateLimit {
  messagesPerSecond?: number
  burstCount?: number
}

export interface ShadowBanStatus {
  banned: boolean
  bannedAt?: number
}

export interface RoomInfo {
  roomId: string
  name?: string
  topic?: string
  joinedMembers: number
  joinedLocalMembers: number
  invitedMembers: number
  invitedLocalMembers: number
  createTime?: number
  creator?: string
  public?: boolean
}

export interface RoomState {
  state: Array<{ type: string; stateKey: string; content: Record<string, unknown> }>
}

export interface ShutdownRoomResult {
  kickedUsers: string[]
  failedToKickUsers: string[]
  localAliases: string[]
}

export interface FederationDestination {
  destination: string
  retryLastTs?: number
  retryInterval?: number
  failureTs?: number
  lastSuccessfulStreamOrdering?: number
}

export interface FederationBlacklistEntry {
  domain: string
  reason?: string
  addedBy?: string
  addedAt?: number
}

export interface ServerNoticeResult {
  eventId?: string
}

export interface ServerNoticeInfo {
  userId: string
  sentTs?: number
  content?: Record<string, unknown>
}

export interface RegistrationToken {
  token: string
  usesAllowed?: number
  pending: number
  completed: number
  expiryTime?: number
}

export interface ReportRequest {
  roomId: string
  eventId: string
  reason: string
  explanation?: string
}

export interface AdminReport {
  id: number
  received_ts: number
  user_id: string
  score: number
  reason: string
  name: string
  canonical_alias?: string
  sender: string
  event_id: string
  event_json: Record<string, unknown>
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

export interface QuotaStatus {
  used: number
  limit: number
  remaining: number
  percentage: number
  exceeded: boolean
}

export interface QuotaStats {
  totalFiles: number
  totalSize: number
  byType: Record<string, { count: number; size: number }>
  byRoom: Record<string, { count: number; size: number }>
  lastUpdated: number
}

export interface QuotaAlert {
  id: string
  type: 'warning' | 'critical' | 'exceeded'
  message: string
  threshold: number
  currentValue: number
  createdAt: number
  acknowledged: boolean
}

export interface QuotaConfig {
  id: string
  name: string
  defaultQuota: number
  maxQuota: number
  warningThreshold: number
  criticalThreshold: number
  enabled: boolean
}

export interface ServerQuota {
  totalUsed: number
  totalLimit: number
  userCount: number
  averageUsage: number
}

export interface RetentionPolicy {
  min_lifetime?: number
  max_lifetime?: number
}

export interface RoomRetention {
  roomId: string
  policy?: RetentionPolicy
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

export interface EventReportHistory {
  id: number
  report_id: number
  action: string
  actor_user_id: string
  old_status: string | null
  new_status: string
  reason: string | null
  created_ts: number
}
