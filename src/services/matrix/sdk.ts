/**
 * Matrix SDK re-exports（SDK 唯一咽喉点）
 *
 * 本文件是 matrix-js-sdk 的唯一转发入口，调用方不得直接 import 子路径；
 * 边界由 `scripts/check-sdk-boundary.mjs` 守护（本文件为其白名单）。
 * 分节顺序：核心 → 扩展管理器与子模块（含契约路由表）。
 */

// ---- 核心 ----
import type { MatrixClient } from 'matrix-js-sdk'

export type {
  IContent,
  ICreateRoomOpts,
  IPublicRoomsChunkRoom,
  IPusher,
  LoginResponse,
  MatrixClient,
  MatrixEvent,
  MBeaconEventContent,
  PushRuleAction,
  Room,
  RoomMember,
  RoomState,
  SlidingSync,
  User
} from 'matrix-js-sdk'
export {
  ContentHelpers,
  createClient,
  Direction,
  EventType,
  initializeManagerExtensions,
  LocationAssetType,
  M_BEACON,
  Preset,
  PushRuleActionName,
  PushRuleKind,
  SlidingSyncState,
  TweakName,
  Visibility
} from 'matrix-js-sdk'
// ---- 扩展管理器与子模块 ----
export type {
  AdminCleanupManager,
  AdminConfigManager,
  AdminFederationCache,
  AdminFederationCacheEntry,
  AdminManager,
  AdminModuleInfo,
  AdminModulePage,
  AdminPushManager,
  AdminServerManager,
  FederationDestination as SdkFederationDestination,
  GlobalMediaQuarantineChange,
  GlobalMediaQuarantineChangesResponse,
  MediaInfo,
  MediaPage,
  MediaProtectionResponse,
  MediaQuarantineChange,
  MediaQuarantineChangesResponse,
  MediaUnprotectionResponse,
  PendingFederationList,
  PendingFederationServer,
  PolicyCheckRequest,
  PolicyCheckResponse,
  PolicyServerStatus,
  RoomMediaItem,
  RoomMediaPage,
  RoomMediaQuarantineResponse,
  RoomMediaUnquarantineResponse,
  RoomStatsOverview,
  UserMediaList,
  UserMediaQuarantineResponse
} from 'matrix-js-sdk/admin'
export { ClientEvent } from 'matrix-js-sdk/client'
export type {} from 'matrix-js-sdk/contract'
// 契约路由表：SDK 的聚合出口（`matrix-js-sdk/contract` 汇总全部 __generated__/route-table）。
// 这里转发而非让 paths/sdk-paths.ts 直接 import，是为了保持「SDK 只有一个咽喉点」的边界约定
// —— scripts/check-sdk-boundary.mjs 只放行本文件这类白名单模块。
export { SDK_CONTRACT_ROUTE_TABLES } from 'matrix-js-sdk/contract'
export type { CryptoCallbacks } from 'matrix-js-sdk/crypto'
export { CryptoEvent, decodeRecoveryKey, encodeRecoveryKey } from 'matrix-js-sdk/crypto'
export type { DeviceKeysManager } from 'matrix-js-sdk/device-keys'
export type {
  CreateDmOptions,
  DirectMessageManager,
  DmPartnerResponse,
  DmRoomInfo,
  IDirectRoomsMap
} from 'matrix-js-sdk/dm'
export type { ReportResponse } from 'matrix-js-sdk/event-report'
export type { Friend, FriendManager, FriendRequest } from 'matrix-js-sdk/friend'
export { FriendEvent } from 'matrix-js-sdk/friend'
export { VendorPrefix } from 'matrix-js-sdk/http-api'
export type { KeyBackupManager as SDKKeyBackupManager } from 'matrix-js-sdk/key-backup'
// 扩展清单：SDK 的权威扩展注册表（AUTO-GENERATED），用于派生关键扩展 ID。
// 与 route-table 类似，这里转发而非让调用方直接 import 子路径，以维持
// 「SDK 只有一个咽喉点」的边界约定（scripts/check-sdk-boundary.mjs 只放行本文件）。
export type { ManagerExtensionsOptions } from 'matrix-js-sdk/manager-extensions'
export { DEFAULT_CORE_EXTENSIONS } from 'matrix-js-sdk/manager-extensions'
export type { MediaManager, MediaQuotaAlert, UrlPreview } from 'matrix-js-sdk/media'
export { RoomEvent } from 'matrix-js-sdk/models/room'
export { RoomStateEvent } from 'matrix-js-sdk/models/room-state'
export type {
  IPushAckResponse,
  IPushDevice,
  IRegisterPushDeviceRequest,
  ISendPushNotificationRequest
} from 'matrix-js-sdk/notifications'
export type { IPresenceEvent } from 'matrix-js-sdk/presence'
export type {} from 'matrix-js-sdk/rendezvous'
// 服务端能力真值（S-01/CAP-08）：SDK 的 `./server-capabilities` **确实**在 package exports 里，
// 之前「未暴露」的注释是错的。测试用它做漂移校验，避免能力映射表与 SDK 常量各写一份。
export {
  SYNAPSE_RUST_CAPABILITY_ALIASES,
  SYNAPSE_RUST_FEATURE_FALLBACK,
  SynapseRustFeature
} from 'matrix-js-sdk/server-capabilities'
export type { TelemetryManager } from 'matrix-js-sdk/telemetry'
// 以下类型由 MatrixClient 访问器派生：SDK 的 package exports 未提供
// `./cas` 与 `./invite-blocklist` 子路径，只能经客户端访问器取回管理器类型。
export type CasManager = ReturnType<MatrixClient['getCasManager']>
export type InviteBlocklistManager = ReturnType<MatrixClient['getInviteBlocklistManager']>

// MSC3720 账号状态：SDK 未在 package exports 暴露 `./account-status` 子路径，
// 同样从客户端访问器派生类型，避免调用方绕开咽喉点直接 import 子路径。
export type AccountStatusManager = ReturnType<MatrixClient['getAccountStatusManager']>
export type AccountStatusBatchResponse = Awaited<ReturnType<AccountStatusManager['getAccountStatuses']>>
export type AccountStatusEntry = NonNullable<AccountStatusBatchResponse['account_statuses']>[string]
export type AccountStatusFailure = NonNullable<AccountStatusBatchResponse['failures']>[string]

// MSC2666 共同房间：`getRoomManager().getMutualRooms()` 未单独导出响应类型。
export type MutualRoomsResponse = Awaited<ReturnType<ReturnType<MatrixClient['getRoomManager']>['getMutualRooms']>>
