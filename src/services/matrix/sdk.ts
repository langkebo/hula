/**
 * Matrix SDK re-exports
 *
 * This file provides a single entry point for matrix-js-sdk symbols
 * while avoiding the main services barrel file.
 */

export type {
  IContent,
  ICreateRoomOpts,
  IPublicRoomsChunkRoom,
  IPusher,
  LoginResponse,
  MatrixClient,
  MatrixEvent,
  MBeaconEventContent,
  MBeaconInfoEventContent,
  Room,
  RoomMember,
  RoomState,
  SlidingSync,
  StoreStats,
  User
} from 'matrix-js-sdk'
export {
  ContentHelpers,
  createClient,
  Direction,
  EventType,
  IndexedDBStore,
  initializeManagerExtensions,
  LocationAssetType,
  M_BEACON,
  M_BEACON_INFO,
  M_LOCATION,
  MemoryStore,
  Preset,
  PushRuleActionName,
  PushRuleKind,
  SlidingSyncState,
  Visibility
} from 'matrix-js-sdk'
export type { AdminManager, AdminShutdownRoomResult } from 'matrix-js-sdk/admin'
export { ClientEvent } from 'matrix-js-sdk/client'
export type { SdkContractModule, SdkContractRoute } from 'matrix-js-sdk/contract'
// 契约路由表：SDK 的聚合出口（`matrix-js-sdk/contract` 汇总全部 __generated__/route-table）。
// 这里转发而非让 paths/sdk-paths.ts 直接 import，是为了保持「SDK 只有一个咽喉点」的边界约定
// —— scripts/check-sdk-boundary.mjs 只放行本文件这类白名单模块。
export {
  SDK_CONTRACT_MODULE_SIZES,
  SDK_CONTRACT_MODULES,
  SDK_CONTRACT_ROUTE_TABLES,
  SDK_CONTRACT_ROUTES
} from 'matrix-js-sdk/contract'
export type { CryptoCallbacks } from 'matrix-js-sdk/crypto'
export { decodeRecoveryKey, encodeRecoveryKey } from 'matrix-js-sdk/crypto'
export type { DeviceKeysManager } from 'matrix-js-sdk/device-keys'
export type { Friend, FriendManager, FriendRequest } from 'matrix-js-sdk/friend'
export { FriendEvent } from 'matrix-js-sdk/friend'
export { ClientPrefix, VendorPrefix } from 'matrix-js-sdk/http-api'
export type { KeyBackupManager as SDKKeyBackupManager } from 'matrix-js-sdk/key-backup'
export type { KeyVerificationManager } from 'matrix-js-sdk/key-verification'
export type { MediaManager } from 'matrix-js-sdk/media'
export { RoomEvent } from 'matrix-js-sdk/models/room'
export { RoomStateEvent } from 'matrix-js-sdk/models/room-state'
export type { MSC4108RendezvousSession, MSC4108SecureChannel } from 'matrix-js-sdk/rendezvous'
export type { IStore } from 'matrix-js-sdk/store'
export type { TelemetryManager } from 'matrix-js-sdk/telemetry'
