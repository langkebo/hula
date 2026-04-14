/**
 * Matrix API 类型定义
 * 用于替代服务层的 any[] 和 Record<string, any> 类型
 */

// ==================== Matrix SDK 扩展类型 ====================

/**
 * 扩展的 Matrix SDK 类型，用于访问未在官方类型中定义的属性
 */
/**
 * 扩展的 MatrixClient 类型，用于事件监听器
 */
export interface ExtendedMatrixClientForEvents {
  on: (event: string, handler: (...args: unknown[]) => void) => void
  off: (event: string, handler: (...args: unknown[]) => void) => void
}

/**
 * Captcha 验证码响应
 */
export interface CaptchaResponse {
  captcha_id: string
  type?: 'image' | 'audio'
  data: string
  expires_in?: number
}

/**
 * Captcha 验证响应
 */
export interface CaptchaVerifyResponse {
  valid: boolean
}

/**
 * Captcha 是否必需响应
 */
export interface CaptchaRequiredResponse {
  required: boolean
}

/**
 * 应用服务列表响应
 */
export interface ApplicationServiceListResponse {
  services: Array<{
    id: string
    url: string
    asToken: string
    sender: string
    namespacedUsers: string[]
    enabled: boolean
  }>
}

/**
 * 应用服务命名空间响应
 */
export interface ApplicationServiceNamespaceResponse {
  namespaces?: {
    users?: Array<{ exclusive: boolean; pattern: string }>
    rooms?: Array<{ exclusive: boolean; pattern: string }>
  }
}

/**
 * 扩展的 MatrixClient 类型，用于用户目录搜索
 */
export interface ExtendedMatrixClientForUserDirectory {
  searchUserDirectory: (params: { term: string; limit: number }) => Promise<{
    results: Array<{
      user_id: string
      display_name?: string
      avatar_url?: string
    }>
  }>
  getProfile: (userId: string) => Promise<unknown>
}

/**
 * 搜索响应类型
 */
export interface SearchResponse {
  search_categories?: {
    room_events?: {
      results?: Array<{
        result: {
          room_id: string
          event_id: string
          sender: string
          content: Record<string, unknown>
          origin_server_ts: number
        }
        context?: {
          events_before?: unknown[]
          events_after?: unknown[]
          profile_info?: Record<string, { displayname?: string }>
        }
      }>
    }
  }
}

/**
 * 表情上传响应
 */
export interface EmojiUploadResponse {
  id?: string
}

/**
 * 表情包创建响应
 */
export interface EmojiPackCreateResponse {
  pack_id?: string
}

/**
 * 扩展的 MatrixClient 类型，用于举报功能
 */
export interface ExtendedMatrixClientForReport {
  reportEvent: (roomId: string, eventId: string, reason: string, explanation: string) => Promise<unknown>
}

/**
 * 扩展的 MatrixClient 类型，用于 DM 管理
 */
export interface ExtendedMatrixClientForDM {
  dmManager?: import('matrix-js-sdk/dm').DirectMessageManager
}

/**
 * 扩展的 MatrixClient 类型，用于配额管理
 */
export interface ExtendedMatrixClientForQuota {
  quotaManager?: {
    checkQuota: () => Promise<unknown>
    getQuotaStats: () => Promise<unknown>
    getQuotaAlerts: () => Promise<unknown[]>
    getQuotaConfigs: () => Promise<unknown[]>
    setUserQuota: (userId: string, quota: number) => Promise<void>
    getServerQuota: () => Promise<unknown>
  }
}

/**
 * 扩展的事件发送者类型
 */
export interface ExtendedEventSender {
  name?: string
  getMxcAvatarUrl?: () => string | null
}

/**
 * 扩展的 Room 类型，用于消息已读状态
 */
export interface ExtendedRoomForMessage {
  hasUserReadEvent?: (userId: string, eventId: string) => boolean
}

/**
 * 扩展的 Room 类型，用于输入状态
 */
export interface ExtendedRoomForTyping {
  getLiveTimeline?: () => {
    getState?: (direction: string) => {
      getStateEvents?: (eventType: string) => {
        getContent: () => { user_ids?: string[] }
      } | null
    } | null
  } | null
}

// ==================== Matrix 标准类型 ====================

/**
 * Matrix 用户 ID 格式：@username:domain
 */
export type MatrixUserId = string

/**
 * Matrix 房间 ID 格式：!roomid:domain
 */
export type MatrixRoomId = string

/**
 * Matrix 事件 ID 格式：$eventid:domain
 */
export type MatrixEventId = string

/**
 * Matrix 设备 ID
 */
export type MatrixDeviceId = string

/**
 * 登录响应
 */
export interface LoginResponse {
  user_id: MatrixUserId
  access_token: string
  device_id: MatrixDeviceId
  home_server?: string
  refresh_token?: string
  expires_in_ms?: number
  well_known?: WellKnown
}

/**
 * Well-known 配置
 */
export interface WellKnown {
  'm.homeserver': {
    base_url: string
  }
  'm.identity_server'?: {
    base_url: string
  }
}

/**
 * 注册响应
 */
export interface RegisterResponse {
  user_id: MatrixUserId
  access_token?: string
  device_id?: MatrixDeviceId
  refresh_token?: string
  expires_in_ms?: number
}

/**
 * 房间创建响应
 */
export interface CreateRoomResponse {
  room_id: MatrixRoomId
}

/**
 * 发送事件响应
 */
export interface SendEventResponse {
  event_id: MatrixEventId
}

/**
 * 用户资料
 */
export interface UserProfile {
  displayname?: string
  avatar_url?: string
}

/**
 * 媒体信息
 */
export interface MediaInfo {
  size?: number
  mimetype?: string
  w?: number
  h?: number
  thumbnail_url?: string
  thumbnail_info?: {
    w?: number
    h?: number
    mimetype?: string
    size?: number
  }
}

/**
 * 消息内容基础接口
 */
export interface MessageContent {
  msgtype: string
  body: string
  format?: string
  formatted_body?: string
  url?: string
  info?: MediaInfo
  'm.relates_to'?: {
    rel_type?: string
    event_id?: MatrixEventId
    'm.in_reply_to'?: {
      event_id: MatrixEventId
    }
  }
}

/**
 * Matrix 错误响应
 */
export interface MatrixError {
  errcode: string
  error: string
}

// ==================== AI 服务相关类型 ====================

export interface AIModel {
  id: string
  name: string
  provider: string
  config: {
    apiKey?: string
    baseUrl?: string
    maxTokens?: number
    temperature?: number
  }
  createdAt: number
  updatedAt: number
}

export interface AIModelListResponse {
  list: AIModel[]
  total: number
}

export interface AIImage {
  id: string
  url: string
  picUrl?: string
  width: number
  height: number
  format: 'png' | 'jpg' | 'webp' | 'gif'
  size: number
  createdAt: number
  status?: number
  errorMessage?: string
}

export interface AIImageListResponse {
  list: AIImage[]
  total: number
}

export interface AIVideo {
  id: string
  url: string
  videoUrl?: string
  width: number
  height: number
  duration: number
  format: 'mp4' | 'webm' | 'mov'
  size: number
  createdAt: number
  status?: number
  errorMessage?: string
}

export interface AIVideoListResponse {
  list: AIVideo[]
  total: number
}

export interface AIAudio {
  id: string
  url: string
  audioUrl?: string
  duration: number
  format: 'mp3' | 'wav' | 'ogg' | 'm4a'
  size: number
  createdAt: number
  status?: number
  errorMessage?: string
}

export interface AIAudioListResponse {
  list: AIAudio[]
  total: number
}

export interface AIVoice {
  id: string
  name: string
  language: string
  gender: 'male' | 'female' | 'neutral'
  preview?: string
}

export interface AIChatRole {
  id: string
  name: string
  description?: string
  avatar?: string
  systemPrompt?: string
  model?: string
  createdAt: number
}

export interface AIChatRoleListResponse {
  list: AIChatRole[]
  total: number
}

// ==================== 搜索服务相关类型 ====================

export interface SearchEventContext {
  eventsBefore: SearchEvent[]
  eventsAfter: SearchEvent[]
}

export interface SearchEvent {
  eventId: string
  roomId: string
  sender: string
  type: string
  content: Record<string, unknown>
  originServerTs: number
}

export interface SearchResult {
  eventId: string
  roomId: string
  sender: string
  content: string
  timestamp: number
  highlights: string[]
  context?: SearchEventContext
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
  nextBatch?: string
}

export interface UserSearchResult {
  userId: string
  displayName?: string
  avatarUrl?: string
}

// ==================== 管理服务相关类型 ====================

export interface AdminUser {
  userId: string
  displayName?: string
  avatarUrl?: string
  isAdmin: boolean
  isDeactivated: boolean
  createdAt: number
  lastSeenTs?: number
}

export interface AdminRoom {
  roomId: string
  name?: string
  topic?: string
  avatarUrl?: string
  memberCount: number
  isPublic: boolean
  createdAt: number
  creator: string
}

export interface ServerStats {
  userCount: number
  roomCount: number
  messageCount: number
  storageUsed: number
  uptime: number
  version: string
}

// ==================== 审核服务相关类型 ====================

export interface ModerationRule {
  id: string
  type: 'ban' | 'mute' | 'warn'
  pattern: string
  reason: string
  createdBy: string
  createdAt: number
  isActive: boolean
}

export interface ModerationAction {
  id: string
  type: 'ban' | 'mute' | 'warn' | 'delete'
  targetUserId: string
  targetRoomId?: string
  targetEventId?: string
  reason: string
  duration?: number
  performedBy: string
  performedAt: number
}

// ==================== Widget 服务相关类型 ====================

export interface WidgetData {
  type: string
  url?: string
  name?: string
  data?: Record<string, unknown>
}

export interface WidgetEventContent {
  type?: string
  url?: string
  name?: string
  data?: Record<string, unknown>
}

// ==================== VoIP 服务相关类型 ====================

export interface VoIPFeed {
  id: string
  stream: MediaStream
  purpose: 'usermedia' | 'screenshare'
  audioMuted: boolean
  videoMuted: boolean
}

// ==================== 表情包服务相关类型 ====================

export interface EmojiPackImage {
  url: string
  body: string
  info?: {
    w?: number
    h?: number
    mimetype?: string
    size?: number
  }
  usage?: string[]
}

export interface EmojiPack {
  id: string
  name: string
  avatarUrl?: string
  attribution?: string
  description?: string
  isPublic?: boolean
  images: Record<string, EmojiPackImage>
}

export interface EmojiPackResponse {
  packs: Record<string, EmojiPackData>
}

export interface EmojiPackData {
  name: string
  avatar_url?: string
  attribution?: string
  description?: string
  isPublic?: boolean
  emoticons: Record<string, EmojiImageData>
}

export interface EmojiImageData {
  url: string
  body: string
  info?: {
    w?: number
    h?: number
    mimetype?: string
    size?: number
  }
  usage?: string[]
}

// ==================== 消息服务相关类型 ====================

export interface ReadReceipt {
  eventId: string
  ts: number
  userId: string
}

export interface ReadReceiptResponse {
  [userId: string]: {
    data: {
      [eventId: string]: ReadReceipt
    }
  }
}

// ==================== 服务器通知相关类型 ====================

export interface ServerNotification {
  notificationId: string
  roomId: string
  eventId: string
  userId: string
  type: string
  severity?: 'info' | 'warning' | 'error'
  title?: string
  content?: string
  timestamp: number
  active?: boolean
  read?: boolean
  dismissed?: boolean
  data?: Record<string, unknown>
}

// ==================== 脱水设备相关类型 ====================

export interface DehydratedDeviceData {
  deviceId: string
  deviceData?: Record<string, unknown>
  algorithm?: string
  format?: string
  account?: string
}

export interface DehydratedDeviceKey {
  deviceId: string
  key: string
  deviceData?: Record<string, unknown>
}

// ==================== 扩展服务相关类型 ====================

export interface SynapseExtensionEvent {
  eventId: string
  roomId: string
  sender: string
  type: string
  content: Record<string, unknown>
  originServerTs: number
}

// ==================== 分页请求参数 ====================

export interface PaginationParams {
  pageNo?: number
  pageSize?: number
  nextBatch?: string
  prevBatch?: string
}

export interface PaginationResponse<T> {
  list: T[]
  total: number
  nextBatch?: string
  prevBatch?: string
}

// ==================== 消息服务相关类型 ====================

export interface MessageData {
  msgId: string
  roomId: string
  content: Record<string, unknown>
  sender: string
  timestamp: number
  type: string
}

export interface MessageListByIdsParams {
  msgIds?: string[]
  async?: boolean
}

// ==================== 搜索上下文类型 ====================
// SearchEventContext 已在 MatrixSearchService.ts 中定义

// ==================== 加密服务相关类型 ====================

/**
 * 加密事件内容
 */
export interface EncryptionEventContent {
  algorithm: string
  rotation_period_ms?: number
  rotation_period_msgs?: number
}

/**
 * 交叉签名状态
 */
export interface CrossSigningStatus {
  privateKeysCached?: boolean
}

/**
 * 密钥备份版本信息
 */
export interface KeyBackupVersion {
  version: string
  algorithm: string
  auth_data: Record<string, unknown>
  count?: number
  etag: string
}

/**
 * 密钥备份恢复结果
 */
export interface KeyBackupRestoreResult {
  imported: number
  total: number
}

/**
 * 验证请求对象
 */
export interface MatrixVerificationRequest {
  transactionId: string
  phase: string
  methods: string[]
  userId: string
  deviceId: string
}

/**
 * 设备信息
 */
export interface MatrixDevice {
  deviceId: string
  isVerified?: () => boolean
  isUnverified?: () => boolean
}

/**
 * 设备信任信息
 */
export interface DeviceTrustInfo {
  isCrossSigningVerified?: () => boolean
}

/**
 * 密钥轮换状态响应
 */
export interface KeyRotationStatusResponse {
  enabled?: boolean
  interval_ms?: number
  last_rotation?: number
  needs_rotation?: boolean
}

/**
 * 密钥轮换检查响应
 */
export interface KeyRotationCheckResponse {
  needs_rotation?: boolean
}

/**
 * 密钥轮换响应
 */
export interface KeyRotationResponse {
  success?: boolean
  key_id?: string
  rotated_at?: number
}

/**
 * 密钥轮换历史响应
 */
export interface KeyRotationHistoryResponse {
  rotations?: Array<{
    key_id?: string
    rotated_at?: number
  }>
}

/**
 * 密钥撤销响应
 */
export interface KeyRevocationResponse {
  revoked?: number
}

/**
 * HTTP 请求配置
 */
export interface HttpRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  data?: Record<string, unknown>
}

/**
 * 扩展的 MatrixClient 类型（包含加密方法）
 */
export interface ExtendedMatrixClient {
  isCryptoEnabled?: () => boolean
  getCrypto?: () => MatrixCrypto | null
  isRoomEncrypted?: (roomId: string) => boolean
  isCrossSigningReady?: () => boolean
  requestVerificationDM?: (userId: string, deviceId: string, methods: string[]) => Promise<MatrixVerificationRequest>
  requestVerification?: (userId: string, methods: string[]) => Promise<MatrixVerificationRequest>
  getVerificationRequestsToDevice?: (userId: string) => MatrixVerificationRequest[]
  setDeviceVerified?: (userId: string, deviceId: string) => Promise<void>
  setDeviceKnown?: (userId: string, deviceId: string, known: boolean) => Promise<void>
  setDeviceBlocked?: (userId: string, deviceId: string, blocked: boolean) => Promise<void>
  getStoredDevice?: (userId: string, deviceId: string) => Promise<MatrixDevice | null>
  checkDeviceTrust?: (userId: string, deviceId: string) => Promise<DeviceTrustInfo>
  getStoredDevicesForUser?: (userId: string) => Promise<MatrixDevice[]>
  http: {
    request: ((config: HttpRequestConfig) => Promise<Record<string, unknown>>) &
      ((
        method: string,
        path: string,
        queryParams?: Record<string, unknown>,
        body?: unknown,
        options?: { prefix?: string }
      ) => Promise<Record<string, unknown>>)
  }
}

/**
 * MatrixCrypto 接口
 */
export interface MatrixCrypto {
  bootstrapCrossSigning?: (options: {
    authUploadDeviceSigningKeys: (
      makeRequest: (authData: Record<string, unknown>) => Promise<Record<string, unknown>>
    ) => Promise<Record<string, unknown>>
  }) => Promise<void>
  getCrossSigningStatus?: () => Promise<CrossSigningStatus>
  crossSigningInfo?: {
    getId?: (type?: string) => string | undefined
  }
  restoreKeyBackup?: (
    recoveryKey: string,
    roomId?: string,
    sessionId?: string,
    backupInfo?: KeyBackupVersion
  ) => Promise<KeyBackupRestoreResult>
  resetKeyBackup?: () => Promise<string>
  getKeyBackupVersion?: () => Promise<KeyBackupVersion | null>
  deleteKeyBackupVersion?: (version: string) => Promise<void>
  exportRoomKeys?: () => Promise<unknown[]>
  importRoomKeys?: (keys: unknown[], options?: { progressCallback?: () => void }) => Promise<unknown[]>
  resetCrossSigningKeys?: () => Promise<void>
}

// ==================== 房间服务相关类型 ====================

/**
 * 房间预设类型
 */
export type RoomPreset = 'private_chat' | 'trusted_private_chat' | 'public_chat'

/**
 * 房间可见性
 */
export type RoomVisibility = 'public' | 'private'

/**
 * 推送规则条件
 */
export interface PushRuleCondition {
  kind: 'event_match' | 'contains_display_name' | 'room_member_count'
  key?: string
  pattern?: string
  is?: string
}

/**
 * 推送规则
 */
export interface PushRule {
  conditions: PushRuleCondition[]
  actions: string[]
}

/**
 * 成员事件内容
 */
export interface MemberEventContent {
  displayname?: string
  avatar_url?: string
  membership: 'invite' | 'join' | 'leave' | 'ban' | 'knock'
  [key: string]: unknown
}

// ==================== 事件服务相关类型 ====================

/**
 * 上传内容选项
 */
export interface UploadContentOptions {
  type?: string
  name?: string
  includeFilename?: boolean
  progressHandler?: (progress: { loaded: number; total: number }) => void
}

/**
 * 上传响应
 */
export interface UploadContentResponse {
  content_uri: string
}

/**
 * 时间线窗口选项
 */
export interface TimelineWindowOptions {
  windowLimit: number
}

/**
 * 时间线方向
 */
export type TimelineDirection = 'b' | 'f'

// ==================== VoIP 服务相关类型 ====================

/**
 * VoIP 通话处理器
 */
export interface VoIPCallHandler {
  calls: Record<string, unknown>
}

/**
 * 扩展的 MatrixClient 类型（VoIP 相关方法）
 */
export interface ExtendedMatrixClientForVoIP {
  voipHandler?: VoIPCallHandler
  getCallHandler?: () => VoIPCallHandler
  createCall?: (roomId: string, type: unknown, options: { audio: boolean; video: boolean }) => unknown
}

/**
 * RTC 统计报告
 */
export interface RTCStatsReport {
  type: string
  bytesReceived?: number
  bytesSent?: number
  packetsLost?: number
  jitter?: number
  currentRoundTripTime?: number
  state?: string
}

// ==================== Session Service 扩展类型 ====================

/**
 * 扩展的 Room 接口，包含 isDirect 方法
 */
export interface ExtendedRoom {
  isDirect?: () => boolean
}

/**
 * 房间头像事件内容
 */
export interface RoomAvatarContent {
  url?: string
}

/**
 * 直接消息账户数据内容
 */
export interface DirectMessageAccountData {
  [userId: string]: string[]
}

/**
 * 扩展的 RoomMember 接口，包含 presence 属性
 */
export interface ExtendedRoomMember {
  presence?: string
}

/**
 * 好友同步状态（从 MatrixFriendService 访问）
 */
export interface FriendSyncState {
  friends: Array<{
    user_id: string
    [key: string]: unknown
  }>
}

// ==================== Profile Service 扩展类型 ====================

/**
 * 扩展的 MatrixClient 接口，包含用户资料相关方法
 */
export interface ExtendedMatrixClientForProfile {
  getProfile?: (userId: string) => Promise<{
    displayname?: string
    avatar_url?: string
  }>
  setDisplayName?: (displayname: string) => Promise<void>
  setAvatarUrl?: (avatarUrl: string) => Promise<void>
  uploadContent?: (
    file: File | Blob,
    options: { type: string; rawResponse: boolean }
  ) => Promise<{ content_uri: string }>
}

// ==================== Notification Service 扩展类型 ====================

/**
 * 推送规则原始数据
 */
export interface PushRuleRaw {
  rule_id: string
  kind?: 'override' | 'underride' | 'sender'
  [key: string]: unknown
}

/**
 * 扩展的 MatrixClient 接口，包含通知相关方法
 */
export interface ExtendedMatrixClientForNotification {
  setPushRule?: (ruleId: string, rule: unknown) => Promise<void>
  deletePushRule?: (ruleId: string) => Promise<void>
  setPusher?: (pusher: PusherConfig) => Promise<void>
}

/**
 * Pusher 配置
 */
export interface PusherConfig {
  pushkey: string
  kind: 'http' | 'email' | null
  app_id: string
  app_display_name: string
  device_display_name: string
  profile_tag?: string
  lang: string
  data: {
    url?: string
    format?: string
  }
  append?: boolean
}

/**
 * 扩展的 Notification 接口
 */
export interface ExtendedNotification {
  getNotifications?: () => Promise<Notification[]>
}

// ==================== Server Notification Service 扩展类型 ====================

/**
 * 服务器通知 API 响应
 */
export interface ServerNotificationResponse {
  notification_id: number
  room_id?: string
  event_id?: string
  user_id: string
  type: string
  severity?: 'info' | 'warning' | 'error'
  title: string
  content: string
  timestamp: number
  active: boolean
  read: boolean
  dismissed: boolean
  data?: Record<string, unknown>
}

/**
 * 服务器通知列表响应
 */
export interface ServerNotificationListResponse {
  notifications: ServerNotificationResponse[]
}

/**
 * 标记已读响应
 */
export interface MarkAllReadResponse {
  count: number
}

/**
 * 通知模板列表响应
 */
export interface NotificationTemplateListResponse {
  templates: Array<{
    name: string
    type: string
    severity: string
    title: string
    content: string
    variables: string[]
  }>
}

// ==================== Group Service 扩展类型 ====================

/**
 * 房间加入规则内容
 */
export interface RoomJoinRuleContent {
  join_rule?: 'public' | 'invite' | 'knock' | 'private'
}

/**
 * 房间主题内容
 */
export interface RoomTopicContent {
  topic?: string
}

/**
 * 扩展的 RoomMember 接口，包含事件访问
 */
export interface ExtendedRoomMemberForGroup {
  events?: {
    member?: {
      getContent: () => Record<string, unknown>
    }
  }
}

// ==================== Media Service 扩展类型 ====================

/**
 * 上传内容响应
 */
export interface UploadContentResponse {
  content_uri: string
}

// ==================== Sync Service 扩展类型 ====================

/**
 * 扩展的 MatrixClient 接口，包含同步相关方法
 */
export interface SyncResponse {
  next_batch: string
  rooms?: {
    join?: Record<
      string,
      {
        unread_notifications?: {
          notification_count?: number
          highlight_count?: number
        }
        timeline?: {
          events?: unknown[]
          limited?: boolean
          prev_batch?: string
        }
        state?: {
          events?: unknown[]
        }
      }
    >
    invite?: Record<string, unknown>
    leave?: Record<string, unknown>
  }
  presence?: Record<string, unknown>
  account_data?: {
    events?: unknown[]
  }
  [key: string]: unknown
}

export interface ExtendedMatrixClientForSync {
  sync?: (options: Record<string, unknown>) => Promise<SyncResponse>
  on?: (event: string, callback: (...args: unknown[]) => void) => void
  off?: (event: string, callback: (...args: unknown[]) => void) => void
}

/**
 * 未读通知计数
 */
export interface UnreadNotificationCount {
  highlight?: number
  notification?: number
}

/**
 * 扩展的 Room 接口，包含未读计数方法
 */
export interface ExtendedRoomForSync {
  getUnreadNotificationCount?: () => UnreadNotificationCount
}

// ==================== Admin Service 扩展类型 ====================

/**
 * 服务器统计信息响应
 */
export interface ServerStatsResponse {
  room_count?: number
  user_count?: number
  daily_active_users?: number
  total_nonlocal_users?: number
  server_start_time?: number
}

// ==================== CAS Service 扩展类型 ====================

/**
 * CAS 服务注册响应
 */
export interface CasServiceResponse {
  service_id: string
  name: string
  url: string
  enabled: boolean
}

/**
 * CAS 服务列表响应
 */
export interface CasServiceListResponse {
  services: Array<{
    service_id: string
    name: string
    url: string
    enabled: boolean
  }>
}

/**
 * CAS 票据验证响应
 */
export interface CasValidateResponse {
  valid: boolean
  user_id?: string
}

/**
 * CAS 票据创建响应
 */
export interface CasTicketResponse {
  ticket: string
  expires_at: number
}

/**
 * CAS 用户属性响应
 */
export interface CasUserAttributesResponse {
  attributes: Record<string, string>
}

// ==================== Announcement Service Types ====================

/**
 * Extended MatrixEvent for accessing raw event data
 */
export interface ExtendedMatrixEvent {
  event?: {
    content?: unknown
  }
}

// ==================== Voice Service Types ====================

/**
 * Extended MatrixClient with VoiceMessageManager
 */
export interface ExtendedMatrixClientForVoice {
  voiceManager?: {
    on: (event: string, callback: (...args: unknown[]) => void) => void
    getConfig: () => VoiceConfigExtended | undefined
    uploadVoiceMessage: (params: unknown) => Promise<{ url?: string; eventId?: string }>
    getVoiceMessageInfo: (roomId: string, messageId: string) => Promise<unknown>
    deleteVoice?: (roomId: string, messageId: string) => Promise<void>
    getUserVoices?: (roomId: string, userId: string) => Promise<unknown[]>
    getRoomVoices?: (roomId: string) => Promise<unknown[]>
    getVoiceStats: (roomId: string) => Promise<unknown>
    getUserStats?: (roomId: string, userId: string) => Promise<unknown>
    convertVoiceMessage: (params: unknown) => Promise<unknown>
    optimizeVoiceMessage: (params: unknown) => Promise<unknown>
    transcribeVoiceMessage: (params: unknown) => Promise<unknown>
    removeAllListeners: () => void
  }
}

/**
 * Extended VoiceConfig with additional properties
 */
export interface VoiceConfigExtended {
  maxDuration?: number
  supported_formats?: string[]
  max_size_bytes?: number
}

// ==================== Space Service Types ====================

// ==================== Retention Service Types ====================

/**
 * Extended MatrixClient for retention operations
 */
export interface ExtendedMatrixClientForRetention {
  getRoomStateEvent?: (roomId: string, eventType: string, stateKey: string) => Promise<unknown>
  sendStateEvent?: (roomId: string, eventType: string, stateKey: string, content: unknown) => Promise<void>
  redact?: (roomId: string, eventId: string) => Promise<void>
  getServerRetention?: () => Promise<unknown>
}

// ==================== Registration Token Service Types ====================

/**
 * Registration token response
 */
export interface RegistrationTokenResponse {
  token: string
  uses_allowed: number
  uses_redeemed: number
  expires_at?: number
  pending?: number
}

/**
 * Registration token list response
 */
export interface RegistrationTokenListResponse {
  tokens: RegistrationTokenResponse[]
}

/**
 * Registration response
 */
export interface RegistrationResponse {
  user_id: string
  access_token: string
}

// ==================== Friend Service Types ====================

/**
 * Extended FriendManager with optional methods
 */
export interface ExtendedFriendManager {
  setFriendNote?: (userId: string, note: string) => Promise<void>
  setFriendStatus?: (userId: string, status: string) => Promise<void>
}

// ==================== Federation Blacklist Service Types ====================

/**
 * Federation blacklist entry response
 */
export interface FederationBlacklistEntryResponse {
  domain: string
  reason?: string
  added_by: string
  added_ts: number
  expires_ts?: number
}

/**
 * Federation blacklist list response
 */
export interface FederationBlacklistListResponse {
  entries: FederationBlacklistEntryResponse[]
}

/**
 * Federation blacklist check response
 */
export interface FederationBlacklistCheckResponse {
  blacklisted: boolean
}

/**
 * Federation blacklist import response
 */
export interface FederationBlacklistImportResponse {
  imported: number
}

// ==================== Event Report Service Types ====================

/**
 * Event report response
 */
export interface EventReportResponse {
  report_id: number
  room_id: string
  event_id: string
  sender: string
  reason: string
  created_ts: number
  status?: 'pending' | 'actioned' | 'ignored'
  user_id?: string
  reason_code?: string
}

/**
 * Event report create response
 */
export interface EventReportCreateResponse {
  report_id: number
}

/**
 * Event report list response
 */
export interface EventReportListResponse {
  event_reports: EventReportResponse[]
}

// ==================== Account Service Types ====================

/**
 * Extended MatrixClient for account operations
 */
export interface ExtendedMatrixClientForAccount {
  setDeviceName?: (deviceId: string, displayName: string) => Promise<void>
  getAccountDataFromServer?: (eventType: string) => Promise<unknown>
  setAccountData?: (eventType: string, content: unknown) => Promise<void>
}

/**
 * Password auth data
 */
export interface PasswordAuthData {
  identifier: {
    type: string
    user: string
  }
  password: string
}

// ==================== Receipt Service Types ====================

/**
 * Extended Room with getReadReceipts method
 */
export interface ExtendedRoomForReceipt {
  getReadReceipts?: () => Array<{
    userId: string
    eventId: string
    data?: { ts?: number }
  }>
}

// ==================== Push Service Types ====================

/**
 * Capabilities response with push support
 */
export interface CapabilitiesResponse {
  m?: {
    push?: {
      enabled?: boolean
      formats?: string[]
    }
  }
}
