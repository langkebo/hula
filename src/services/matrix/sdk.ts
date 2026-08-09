/**
 * Matrix SDK re-exports
 *
 * This file provides a single entry point for matrix-js-sdk symbols
 * while avoiding the main services barrel file.
 */

export type { MatrixClient, MatrixEvent, Room, RoomMember, RoomState } from 'matrix-js-sdk'
export { Direction, EventType, Preset, PushRuleKind, Visibility } from 'matrix-js-sdk'
export type { AdminManager } from 'matrix-js-sdk/admin'
export { ClientEvent } from 'matrix-js-sdk/client'

export { RoomEvent } from 'matrix-js-sdk/models/room'
export { RoomStateEvent } from 'matrix-js-sdk/models/room-state'
