// ⚠️ 由 scripts/gen-fixtures-from-sdk.mjs 生成，请勿手改。
// 结构真值来自 SDK 的 .d.ts；`satisfies` 保证与 SDK 类型不漂移。
import type * as T from 'matrix-js-sdk/admin'

/** `sub-managers/admin-server-types` 的 `WhoamiResponse` */
export const WhoamiResponseFixture = {
  user_id: 'x'
} satisfies T.WhoamiResponse

/** `sub-managers/admin-server-types` 的 `AdminRegisterRequest` */
export const AdminRegisterRequestFixture = {
  nonce: 'x',
  username: 'x',
  password: 'x',
  admin: false,
  mac: 'x'
} satisfies T.AdminRegisterRequest

/** `sub-managers/admin-server-types` 的 `AdminRegisterResult` */
export const AdminRegisterResultFixture = {
  user_id: 'x'
} satisfies T.AdminRegisterResult

/** `sub-managers/admin-server-types` 的 `PurgeHistoryRequest` */
export const PurgeHistoryRequestFixture = {
  room_id: 'x'
} satisfies T.PurgeHistoryRequest

/** `sub-managers/admin-server-types` 的 `ShutdownRoomRequest` */
export const ShutdownRoomRequestFixture = {
  room_id: 'x'
} satisfies T.ShutdownRoomRequest

/** `sub-managers/admin-server-types` 的 `ServerStats` */
export const ServerStatsFixture = {} satisfies T.ServerStats

/** `sub-managers/admin-server-types` 的 `ServerStatus` */
export const ServerStatusFixture = {
  db_ok: false,
  server_ok: false,
  up: false
} satisfies T.ServerStatus

/** `sub-managers/admin-server-types` 的 `ServerHealth` */
export const ServerHealthFixture = {
  status: 'ok',
  database: 'ok'
} satisfies T.ServerHealth

/** `sub-managers/admin-server-types` 的 `ServerInfo` */
export const ServerInfoFixture = {} satisfies T.ServerInfo

/** `sub-managers/admin-server-types` 的 `AdminServerConfig` */
export const AdminServerConfigFixture = {
  server_name: 'x'
} satisfies T.AdminServerConfig

/** `sub-managers/admin-server-types` 的 `AdminInfoResponse` */
export const AdminInfoResponseFixture = {
  server_name: 'x',
  server_version: 'x'
} satisfies T.AdminInfoResponse

/** `sub-managers/admin-server-types` 的 `ServerNotice` */
export const ServerNoticeFixture = {
  id: 0,
  event_id: 'x',
  user_id: 'x',
  content: 'x',
  sent_ts: 0
} satisfies T.ServerNotice

/** `sub-managers/admin-server-types` 的 `ServerNoticePage` */
export const ServerNoticePageFixture = {
  notices: [],
  total: 0,
  next_batch: 'x'
} satisfies T.ServerNoticePage

/** `sub-managers/admin-server-types` 的 `SendServerNoticeResult` */
export const SendServerNoticeResultFixture = {
  event_id: 'x',
  room_id: 'x',
  notice_id: 0
} satisfies T.SendServerNoticeResult

/** `sub-managers/admin-server-types` 的 `SystemNotificationPage` */
export const SystemNotificationPageFixture = {
  notifications: []
} satisfies T.SystemNotificationPage

/** `sub-managers/admin-server-types` 的 `AdminShutdownRoomResult` */
export const AdminShutdownRoomResultFixture = {
  closed_room: false
} satisfies T.AdminShutdownRoomResult

/** `sub-managers/admin-server-types` 的 `AdminExperimentalFeatures` */
export const AdminExperimentalFeaturesFixture = {
  features: {},
  total: 0
} satisfies T.AdminExperimentalFeatures

/** `sub-managers/admin-server-types` 的 `RestartServerPayload` */
export const RestartServerPayloadFixture = {} satisfies T.RestartServerPayload

/** `sub-managers/admin-server-types` 的 `RestartServerResponse` */
export const RestartServerResponseFixture = {
  message: 'x',
  restart_pending: false
} satisfies T.RestartServerResponse

/** `sub-managers/admin-server-types` 的 `PurgeRoomResponse` */
export const PurgeRoomResponseFixture = {
  purge_id: 'x',
  success: false
} satisfies T.PurgeRoomResponse

/** `sub-managers/admin-server-types` 的 `SecurityEvent` */
export const SecurityEventFixture = {} satisfies T.SecurityEvent

/** `sub-managers/admin-server-types` 的 `SecurityEventPage` */
export const SecurityEventPageFixture = {
  events: []
} satisfies T.SecurityEventPage

/** `sub-managers/admin-server-types` 的 `IpBlock` */
export const IpBlockFixture = {
  ip: 'x'
} satisfies T.IpBlock

/** `sub-managers/admin-server-types` 的 `ServerLogEntry` */
export const ServerLogEntryFixture = {
  level: 'x',
  ts: 0,
  message: 'x'
} satisfies T.ServerLogEntry

/** `sub-managers/admin-server-types` 的 `MediaQuotaResponse` */
export const MediaQuotaResponseFixture = {
  total_size: 0,
  total_count: 0,
  default_size_limit: 0,
  default_count_limit: 0
} satisfies T.MediaQuotaResponse

/** `sub-managers/admin-server-types` 的 `MediaProtectionResponse` */
export const MediaProtectionResponseFixture = {
  stream_id: 0,
  server_name: 'x',
  media_id: 'x',
  protected: false,
  changed_by: 'x'
} satisfies T.MediaProtectionResponse

/** `sub-managers/admin-server-types` 的 `MediaUnprotectionResponse` */
export const MediaUnprotectionResponseFixture = {
  stream_id: 0,
  media_id: 'x',
  unprotected: false,
  changed_by: 'x'
} satisfies T.MediaUnprotectionResponse

/** `sub-managers/admin-server-types` 的 `MediaQuarantineChange` */
export const MediaQuarantineChangeFixture = {
  stream_id: 0,
  media_id: 'x',
  server_name: 'x',
  change_type: 'quarantine',
  changed_by: 'x',
  created_ts: 0
} satisfies T.MediaQuarantineChange

/** `sub-managers/admin-server-types` 的 `MediaQuarantineChangesResponse` */
export const MediaQuarantineChangesResponseFixture = {
  changes: [],
  total: 0
} satisfies T.MediaQuarantineChangesResponse

/** `sub-managers/admin-server-types` 的 `GlobalMediaQuarantineChange` */
export const GlobalMediaQuarantineChangeFixture = {
  origin: 'x',
  media_id: 'x',
  quarantined: false
} satisfies T.GlobalMediaQuarantineChange

/** `sub-managers/admin-server-types` 的 `GlobalMediaQuarantineChangesResponse` */
export const GlobalMediaQuarantineChangesResponseFixture = {
  next_batch: 0,
  changes: []
} satisfies T.GlobalMediaQuarantineChangesResponse

/** `sub-managers/admin-server-types` 的 `RoomMediaItem` */
export const RoomMediaItemFixture = {
  media_id: 'x',
  media_type: 'x',
  upload_name: 'x',
  created_ts: 0,
  media_length: 0
} satisfies T.RoomMediaItem

/** `sub-managers/admin-server-types` 的 `RoomMediaPage` */
export const RoomMediaPageFixture = {
  media: [],
  total: 0,
  next_batch: 'x'
} satisfies T.RoomMediaPage

/** `sub-managers/admin-server-types` 的 `RoomMediaQuarantineResponse` */
export const RoomMediaQuarantineResponseFixture = {
  stream_id: 0,
  room_id: 'x',
  quarantined: true,
  changed_by: 'x'
} satisfies T.RoomMediaQuarantineResponse

/** `sub-managers/admin-server-types` 的 `RoomMediaUnquarantineResponse` */
export const RoomMediaUnquarantineResponseFixture = {
  stream_id: 0,
  room_id: 'x',
  quarantined: false,
  changed_by: 'x'
} satisfies T.RoomMediaUnquarantineResponse

/** `sub-managers/admin-server-types` 的 `UserMediaQuarantineResponse` */
export const UserMediaQuarantineResponseFixture = {
  stream_id: 0,
  user_id: 'x',
  quarantined: true,
  changed_by: 'x'
} satisfies T.UserMediaQuarantineResponse

/** `sub-managers/admin-server-types` 的 `RateLimitStatusResponse` */
export const RateLimitStatusResponseFixture = {
  enabled: false,
  backend: 'x',
  redis_available: false,
  active_rules: 0,
  exempt_paths: 0,
  metrics: {
    requests_total: 0,
    rejected_total: 0,
    allowed_total: 0,
    exempt_total: 0,
    fail_open_total: 0,
    fail_closed_total: 0,
    rejected_ratio_percent: 0
  }
} satisfies T.RateLimitStatusResponse
