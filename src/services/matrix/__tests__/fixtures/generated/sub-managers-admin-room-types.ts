// ⚠️ 由 scripts/gen-fixtures-from-sdk.mjs 生成，请勿手改。
// 结构真值来自 SDK 的 .d.ts；`satisfies` 保证与 SDK 类型不漂移。
import type * as T from 'matrix-js-sdk/admin'

/** `sub-managers/admin-room-types` 的 `AdminReasonPayload` */
export const AdminReasonPayloadFixture = {} satisfies T.AdminReasonPayload

/** `sub-managers/admin-room-types` 的 `AdminBanKickPayload` */
export const AdminBanKickPayloadFixture = {
  user_id: 'x'
} satisfies T.AdminBanKickPayload

/** `sub-managers/admin-room-types` 的 `AdminMakeRoomAdminPayload` */
export const AdminMakeRoomAdminPayloadFixture = {
  user_id: 'x'
} satisfies T.AdminMakeRoomAdminPayload

/** `sub-managers/admin-room-types` 的 `RoomSearchPayload` */
export const RoomSearchPayloadFixture = {} satisfies T.RoomSearchPayload

/** `sub-managers/admin-room-types` 的 `RoomDeletePayload` */
export const RoomDeletePayloadFixture = {} satisfies T.RoomDeletePayload

/** `sub-managers/admin-room-types` 的 `PurgeHistoryPayload` */
export const PurgeHistoryPayloadFixture = {} satisfies T.PurgeHistoryPayload

/** `sub-managers/admin-room-types` 的 `RoomEventSearchPayload` */
export const RoomEventSearchPayloadFixture = {
  search_term: 'x'
} satisfies T.RoomEventSearchPayload

/** `sub-managers/admin-room-types` 的 `AdminRoomRedactPayload` */
export const AdminRoomRedactPayloadFixture = {} satisfies T.AdminRoomRedactPayload

/** `sub-managers/admin-room-types` 的 `AdminRoomRedactResult` */
export const AdminRoomRedactResultFixture = {
  redacted: 0
} satisfies T.AdminRoomRedactResult

/** `sub-managers/admin-room-types` 的 `RoomInfo` */
export const RoomInfoFixture = {
  room_id: 'x'
} satisfies T.RoomInfo

/** `sub-managers/admin-room-types` 的 `AdminRoomMember` */
export const AdminRoomMemberFixture = {
  user_id: 'x',
  displayname: 'x',
  avatar_url: 'x',
  membership: 'x'
} satisfies T.AdminRoomMember

/** `sub-managers/admin-room-types` 的 `AdminRoomMemberPage` */
export const AdminRoomMemberPageFixture = {
  members: [],
  total: 0,
  next_batch: 'x'
} satisfies T.AdminRoomMemberPage

/** `sub-managers/admin-room-types` 的 `RoomStatsOverview` */
export const RoomStatsOverviewFixture = {
  total_rooms: 0,
  encrypted_rooms: 0,
  public_rooms: 0,
  total_messages: 0,
  total_members: 0,
  active_rooms: 0,
  average_messages_per_room: 0
} satisfies T.RoomStatsOverview

/** `sub-managers/admin-room-types` 的 `RoomStats` */
export const RoomStatsFixture = {
  room_id: 'x',
  member_count: 0,
  message_count: 0,
  last_message_ts: 0,
  is_encrypted: false,
  admin_count: 0
} satisfies T.RoomStats

/** `sub-managers/admin-room-types` 的 `RoomStateEvent` */
export const RoomStateEventFixture = {
  type: 'x',
  state_key: 'x',
  content: {},
  sender: 'x',
  event_id: 'x'
} satisfies T.RoomStateEvent

/** `sub-managers/admin-room-types` 的 `RoomMessage` */
export const RoomMessageFixture = {
  event_id: 'x',
  type: 'x',
  content: {},
  sender: 'x',
  origin_server_ts: 0
} satisfies T.RoomMessage

/** `sub-managers/admin-room-types` 的 `RoomMessagePage` */
export const RoomMessagePageFixture = {
  chunk: [],
  start: 'x',
  end: 'x',
  next_batch: 'x'
} satisfies T.RoomMessagePage

/** `sub-managers/admin-room-types` 的 `SpaceInfo` */
export const SpaceInfoFixture = {
  space_id: 'x',
  room_id: 'x',
  name: 'x',
  topic: 'x',
  creator: 'x',
  created_ts: 0
} satisfies T.SpaceInfo

/** `sub-managers/admin-room-types` 的 `SpacePage` */
export const SpacePageFixture = {
  spaces: [],
  total: 0
} satisfies T.SpacePage

/** `sub-managers/admin-room-types` 的 `SpaceStats` */
export const SpaceStatsFixture = {
  space_id: 'x',
  member_count: 0,
  child_room_count: 0
} satisfies T.SpaceStats

/** `sub-managers/admin-room-types` 的 `SpaceUsersResponse` */
export const SpaceUsersResponseFixture = {
  users: [],
  total: 0
} satisfies T.SpaceUsersResponse

/** `sub-managers/admin-room-types` 的 `SpaceRoomsResponse` */
export const SpaceRoomsResponseFixture = {
  rooms: [],
  total: 0
} satisfies T.SpaceRoomsResponse

/** `sub-managers/admin-room-types` 的 `AdminRoomVersionResponse` */
export const AdminRoomVersionResponseFixture = {
  room_version: 'x'
} satisfies T.AdminRoomVersionResponse

/** `sub-managers/admin-room-types` 的 `AdminRoomBlockStatus` */
export const AdminRoomBlockStatusFixture = {
  block: false
} satisfies T.AdminRoomBlockStatus

/** `sub-managers/admin-room-types` 的 `AdminEventContextEvent` */
export const AdminEventContextEventFixture = {
  event_id: 'x',
  type: 'x',
  content: {},
  sender: 'x'
} satisfies T.AdminEventContextEvent

/** `sub-managers/admin-room-types` 的 `AdminEventContext` */
export const AdminEventContextFixture = {
  event: {
    event_id: 'x',
    type: 'x',
    content: {},
    sender: 'x'
  },
  events_before: [],
  events_after: [],
  state: []
} satisfies T.AdminEventContext

/** `sub-managers/admin-room-types` 的 `AdminRoomForwardExtremities` */
export const AdminRoomForwardExtremitiesFixture = {
  room_id: 'x',
  forward_extremities: 0
} satisfies T.AdminRoomForwardExtremities

/** `sub-managers/admin-room-types` 的 `AdminTokenSyncEntry` */
export const AdminTokenSyncEntryFixture = {
  user_id: 'x',
  device_id: 'x',
  conn_id: 'x',
  list_key: 'x',
  pos: 0,
  token_created_ts: 0,
  token_expires_at: 0,
  room_timestamp: 0,
  room_updated_ts: 0,
  bump_stamp: 0,
  highlight_count: 0,
  notification_count: 0,
  is_dm: false,
  is_encrypted: false,
  is_tombstoned: false,
  invited: false,
  name: 'x',
  avatar: 'x',
  is_expired: false
} satisfies T.AdminTokenSyncEntry

/** `sub-managers/admin-room-types` 的 `AdminTokenSyncSummary` */
export const AdminTokenSyncSummaryFixture = {
  active_token_count: 0,
  expired_token_count: 0,
  distinct_users: 0,
  distinct_devices: 0
} satisfies T.AdminTokenSyncSummary

/** `sub-managers/admin-room-types` 的 `AdminTokenSync` */
export const AdminTokenSyncFixture = {
  room_id: 'x',
  results: [],
  total: 0,
  next_batch: 'x',
  summary: {
    active_token_count: 0,
    expired_token_count: 0,
    distinct_users: 0,
    distinct_devices: 0
  }
} satisfies T.AdminTokenSync

/** `sub-managers/admin-room-types` 的 `AdminRoomSearchItem` */
export const AdminRoomSearchItemFixture = {
  room_id: 'x',
  name: 'x',
  topic: 'x',
  creator: 'x',
  is_public: false,
  member_count: 0,
  is_encrypted: false,
  creation_ts: 0
} satisfies T.AdminRoomSearchItem

/** `sub-managers/admin-room-types` 的 `RoomSearchQuery` */
export const RoomSearchQueryFixture = {} satisfies T.RoomSearchQuery

/** `sub-managers/admin-room-types` 的 `AdminRoomSearchPage` */
export const AdminRoomSearchPageFixture = {
  results: [],
  count: 0,
  total: 0,
  limit: 0,
  next_batch: 'x'
} satisfies T.AdminRoomSearchPage

/** `sub-managers/admin-room-types` 的 `AdminRoomEventSearchPage` */
export const AdminRoomEventSearchPageFixture = {
  results: [],
  count: 0,
  room_id: 'x'
} satisfies T.AdminRoomEventSearchPage

/** `sub-managers/admin-room-types` 的 `AdminRoomListings` */
export const AdminRoomListingsFixture = {
  room_id: 'x',
  public: false,
  in_directory: false
} satisfies T.AdminRoomListings

/** `sub-managers/admin-room-types` 的 `AdminReport` */
export const AdminReportFixture = {
  id: 0,
  room_id: 'x',
  event_id: 'x',
  user_id: 'x',
  reported_user_id: 'x',
  reason: 'x',
  content: 'x',
  status: 'x',
  score: 0,
  received_ts: 0
} satisfies T.AdminReport

/** `sub-managers/admin-room-types` 的 `AdminReportPage` */
export const AdminReportPageFixture = {
  reports: [],
  total: 0
} satisfies T.AdminReportPage

/** `sub-managers/admin-room-types` 的 `AdminPurgeHistoryResult` */
export const AdminPurgeHistoryResultFixture = {
  success: false,
  deleted_events: 0,
  dry_run: false
} satisfies T.AdminPurgeHistoryResult

/** `sub-managers/admin-room-types` 的 `RoomBackfillResponse` */
export const RoomBackfillResponseFixture = {
  room_id: 'x',
  source_server: 'x',
  persisted_events: 0,
  candidates_tried: 0
} satisfies T.RoomBackfillResponse

/** `sub-managers/admin-room-types` 的 `CascadeRedactResponse` */
export const CascadeRedactResponseFixture = {
  event_id: 'x',
  redacted_count: 0,
  max_depth: 0
} satisfies T.CascadeRedactResponse
