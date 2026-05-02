/**
 * Matrix SDK re-exports
 *
 * This file provides a single entry point for matrix-js-sdk symbols
 * while avoiding the main services barrel file.
 */

export type {
  IContent,
  ICreateRoomOpts,
  IPusher,
  IPushRule,
  IPushRules,
  ISendEventResponse,
  MatrixClient,
  MatrixEvent,
  Room,
  RoomMember,
  SearchResponse
} from 'matrix-js-sdk'
export {
  Direction,
  EventType,
  NotificationCountType,
  Preset,
  PushRuleKind,
  Visibility
} from 'matrix-js-sdk'
