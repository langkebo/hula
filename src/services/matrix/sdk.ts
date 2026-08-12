/**
 * Matrix SDK re-exports
 *
 * This file provides a single entry point for matrix-js-sdk symbols
 * while avoiding the main services barrel file.
 */

export type {
  ICreateRoomOpts,
  IPusher,
  LoginResponse,
  MatrixClient,
  MatrixEvent,
  Room,
  RoomMember,
  RoomState,
  SlidingSync,
  User
} from 'matrix-js-sdk'
export {
  createClient,
  Direction,
  EventType,
  initializeManagerExtensions,
  Preset,
  PushRuleActionName,
  PushRuleKind,
  Visibility
} from 'matrix-js-sdk'
export type { AdminManager, AdminShutdownRoomResult } from 'matrix-js-sdk/admin'
export { ClientEvent } from 'matrix-js-sdk/client'
export type { CryptoCallbacks } from 'matrix-js-sdk/crypto'
export type { DeviceKeysManager } from 'matrix-js-sdk/device-keys'
export type { Friend, FriendManager, FriendRequest } from 'matrix-js-sdk/friend'
export { FriendEvent } from 'matrix-js-sdk/friend'
export { ClientPrefix } from 'matrix-js-sdk/http-api'
export type { KeyBackupManager as SDKKeyBackupManager } from 'matrix-js-sdk/key-backup'
export type { KeyVerificationManager } from 'matrix-js-sdk/key-verification'
export { RoomEvent } from 'matrix-js-sdk/models/room'
export { RoomStateEvent } from 'matrix-js-sdk/models/room-state'
export type { TelemetryManager } from 'matrix-js-sdk/telemetry'
