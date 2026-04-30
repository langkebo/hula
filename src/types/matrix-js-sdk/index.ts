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
  RegisterResponse
} from 'matrix-js-sdk'
// 重新导出官方类型
export * from 'matrix-js-sdk'
// 补充 SDK 缺失的类型
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
  SlidingSyncState,
  TweakName,
  Visibility
} from 'matrix-js-sdk'
