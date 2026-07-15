/**
 * matrix-js-sdk 类型扩展
 * 提供官方 SDK 缺失的类型定义
 */
/// <reference types="vite/client" />

export type {
  EmptyObject,
  ICreateClientOpts,
  ICreateRoomOpts,
  IEventRelation,
  IRequestTokenResponse,
  ISendEventResponse,
  LoginResponse,
  MSC3575RoomData,
  MSC3575SlidingSyncResponse,
  PushRuleAction,
  RegisterResponse,
  SlidingSync
} from 'matrix-js-sdk'
export {
  ClientPrefix,
  EventType,
  Method,
  NotificationCountType,
  PendingEventOrdering,
  Preset,
  PushRuleKind,
  ReceiptType,
  RoomType,
  SlidingSyncEvent,
  SlidingSyncState,
  TweakName,
  Visibility
} from 'matrix-js-sdk'
