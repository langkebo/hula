/**
 * Matrix SDK re-exports
 *
 * This file provides a single entry point for matrix-js-sdk symbols
 * while avoiding the main services barrel file.
 */

export type { IPusher, MatrixClient, MatrixEvent, Room, RoomMember, RoomState } from 'matrix-js-sdk'
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
export { ClientPrefix } from 'matrix-js-sdk/http-api'

export { RoomEvent } from 'matrix-js-sdk/models/room'
export { RoomStateEvent } from 'matrix-js-sdk/models/room-state'
