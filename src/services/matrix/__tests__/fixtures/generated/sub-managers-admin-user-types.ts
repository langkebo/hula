// ⚠️ 由 scripts/gen-fixtures-from-sdk.mjs 生成，请勿手改。
// 结构真值来自 SDK 的 .d.ts；`satisfies` 保证与 SDK 类型不漂移。
import type * as T from 'matrix-js-sdk/admin'

/** `sub-managers/admin-user-types` 的 `AdminToken` */
export const AdminTokenFixture = {
  id: 0,
  device_id: 'x',
  created_ts: 0,
  expires_at: 0,
  is_revoked: false
} satisfies T.AdminToken

/** `sub-managers/admin-user-types` 的 `AdminRefreshToken` */
export const AdminRefreshTokenFixture = {
  id: 0,
  device_id: 'x',
  created_ts: 0,
  expires_at: 0,
  is_revoked: false
} satisfies T.AdminRefreshToken

/** `sub-managers/admin-user-types` 的 `UserTokensResponse` */
export const UserTokensResponseFixture = {
  tokens: [],
  total: 0
} satisfies T.UserTokensResponse

/** `sub-managers/admin-user-types` 的 `UserRefreshTokensResponse` */
export const UserRefreshTokensResponseFixture = {
  refresh_tokens: [],
  total: 0
} satisfies T.UserRefreshTokensResponse

/** `sub-managers/admin-user-types` 的 `AdminLogoutRequest` */
export const AdminLogoutRequestFixture = {} satisfies T.AdminLogoutRequest

/** `sub-managers/admin-user-types` 的 `AdminEvictRequest` */
export const AdminEvictRequestFixture = {} satisfies T.AdminEvictRequest

/** `sub-managers/admin-user-types` 的 `DeactivateUserResponse` */
export const DeactivateUserResponseFixture = {} satisfies T.DeactivateUserResponse

/** `sub-managers/admin-user-types` 的 `DeviceInfo` */
export const DeviceInfoFixture = {
  device_id: 'x'
} satisfies T.DeviceInfo

/** `sub-managers/admin-user-types` 的 `AdminUserDevicesResponse` */
export const AdminUserDevicesResponseFixture = {
  devices: [],
  total: 0
} satisfies T.AdminUserDevicesResponse

/** `sub-managers/admin-user-types` 的 `UserSession` */
export const UserSessionFixture = {
  session_id: 'x',
  device_id: 'x'
} satisfies T.UserSession

/** `sub-managers/admin-user-types` 的 `UserSessionsResponse` */
export const UserSessionsResponseFixture = {
  user_id: 'x',
  sessions: [],
  total: 0
} satisfies T.UserSessionsResponse

/** `sub-managers/admin-user-types` 的 `InvalidateUserSessionsResponse` */
export const InvalidateUserSessionsResponseFixture = {
  invalidated: false,
  sessions_removed: 0
} satisfies T.InvalidateUserSessionsResponse

/** `sub-managers/admin-user-types` 的 `AdminAccountDetails` */
export const AdminAccountDetailsFixture = {} satisfies T.AdminAccountDetails

/** `sub-managers/admin-user-types` 的 `AccountStatus` */
export const AccountStatusFixture = {
  user_id: 'x'
} satisfies T.AccountStatus

/** `sub-managers/admin-user-types` 的 `ShadowBanStatus` */
export const ShadowBanStatusFixture = {
  shadow_banned: false
} satisfies T.ShadowBanStatus

/** `sub-managers/admin-user-types` 的 `AdminStatusResult` */
export const AdminStatusResultFixture = {
  admin: false
} satisfies T.AdminStatusResult

/** `sub-managers/admin-user-types` 的 `RateLimitConfig` */
export const RateLimitConfigFixture = {} satisfies T.RateLimitConfig

/** `sub-managers/admin-user-types` 的 `WhoisResponse` */
export const WhoisResponseFixture = {
  user_id: 'x',
  devices: {}
} satisfies T.WhoisResponse

/** `sub-managers/admin-user-types` 的 `PusherData` */
export const PusherDataFixture = {} satisfies T.PusherData

/** `sub-managers/admin-user-types` 的 `UserPusher` */
export const UserPusherFixture = {
  pushkey: 'x',
  app_id: 'x'
} satisfies T.UserPusher

/** `sub-managers/admin-user-types` 的 `LoginWellKnown` */
export const LoginWellKnownFixture = {} satisfies T.LoginWellKnown

/** `sub-managers/admin-user-types` 的 `AdminLoginAsUserRequest` */
export const AdminLoginAsUserRequestFixture = {} satisfies T.AdminLoginAsUserRequest

/** `sub-managers/admin-user-types` 的 `AdminLoginAsUserResponse` */
export const AdminLoginAsUserResponseFixture = {
  access_token: 'x',
  device_id: 'x',
  user_id: 'x'
} satisfies T.AdminLoginAsUserResponse

/** `sub-managers/admin-user-types` 的 `BatchCreateUsersRequest` */
export const BatchCreateUsersRequestFixture = {
  users: []
} satisfies T.BatchCreateUsersRequest

/** `sub-managers/admin-user-types` 的 `BatchCreateUsersResponse` */
export const BatchCreateUsersResponseFixture = {
  created: [],
  failed: [],
  total: 0
} satisfies T.BatchCreateUsersResponse

/** `sub-managers/admin-user-types` 的 `BatchDeactivateUsersRequest` */
export const BatchDeactivateUsersRequestFixture = {
  users: []
} satisfies T.BatchDeactivateUsersRequest

/** `sub-managers/admin-user-types` 的 `BatchDeactivateUsersResponse` */
export const BatchDeactivateUsersResponseFixture = {
  deactivated: [],
  failed: [],
  total: 0
} satisfies T.BatchDeactivateUsersResponse

/** `sub-managers/admin-user-types` 的 `UpdateAccountDetailsRequest` */
export const UpdateAccountDetailsRequestFixture = {} satisfies T.UpdateAccountDetailsRequest

/** `sub-managers/admin-user-types` 的 `UpdateAccountDetailsResponse` */
export const UpdateAccountDetailsResponseFixture = {
  user_id: 'x',
  updated: false
} satisfies T.UpdateAccountDetailsResponse

/** `sub-managers/admin-user-types` 的 `AdminLogoutResponse` */
export const AdminLogoutResponseFixture = {
  devices_deleted: 0
} satisfies T.AdminLogoutResponse

/** `sub-managers/admin-user-types` 的 `AdminEvictResponse` */
export const AdminEvictResponseFixture = {
  user_id: 'x',
  rooms_evicted: 0,
  rooms: [],
  failures: []
} satisfies T.AdminEvictResponse

/** `sub-managers/admin-user-types` 的 `UserStatsResponse` */
export const UserStatsResponseFixture = {
  user_id: 'x',
  rooms_joined: 0,
  messages_sent: 0,
  last_seen_ts: 0
} satisfies T.UserStatsResponse

/** `sub-managers/admin-user-types` 的 `UserStatsListResponse` */
export const UserStatsListResponseFixture = {
  total_users: 0,
  active_users: 0,
  admin_users: 0,
  deactivated_users: 0,
  guest_users: 0,
  average_rooms_per_user: 0,
  user_registration_enabled: false
} satisfies T.UserStatsListResponse

/** `sub-managers/admin-user-types` 的 `UserRoomsResponse` */
export const UserRoomsResponseFixture = {
  joined_rooms: [],
  total: 0
} satisfies T.UserRoomsResponse

/** `sub-managers/admin-user-types` 的 `UserNotificationResponse` */
export const UserNotificationResponseFixture = {
  enabled: false
} satisfies T.UserNotificationResponse

/** `sub-managers/admin-user-types` 的 `UserNotificationUpdateResponse` */
export const UserNotificationUpdateResponseFixture = {
  is_enabled: false
} satisfies T.UserNotificationUpdateResponse

/** `sub-managers/admin-user-types` 的 `UserNotificationPayload` */
export const UserNotificationPayloadFixture = {
  enabled: false
} satisfies T.UserNotificationPayload

/** `sub-managers/admin-user-types` 的 `MediaInfo` */
export const MediaInfoFixture = {
  media_id: 'x'
} satisfies T.MediaInfo

/** `sub-managers/admin-user-types` 的 `MediaPage` */
export const MediaPageFixture = {
  media: [],
  total: 0,
  next_batch: 'x'
} satisfies T.MediaPage

/** `sub-managers/admin-user-types` 的 `UserMediaList` */
export const UserMediaListFixture = {
  media: [],
  total: 0
} satisfies T.UserMediaList

/** `sub-managers/admin-user-types` 的 `AdminDeviceVerificationStatus` */
export const AdminDeviceVerificationStatusFixture = {
  user_id: 'x',
  device_id: 'x',
  is_verified: false,
  is_cross_signed: false,
  signature_valid: false
} satisfies T.AdminDeviceVerificationStatus
