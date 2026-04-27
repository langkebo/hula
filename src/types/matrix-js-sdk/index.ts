/**
 * matrix-js-sdk 类型扩展
 * 提供官方 SDK 缺失的类型定义
 */
/// <reference types="vite/client" />

// 重新导出官方类型
export * from 'matrix-js-sdk'

// 补充 SDK 缺失的类型
export { PendingEventOrdering, Method, ClientPrefix } from 'matrix-js-sdk'
export {
  Visibility,
  Preset,
  PushRuleKind,
  ReceiptType,
  NotificationCountType,
  RoomType,
  EventType,
  TweakName,
  SlidingSyncState
} from 'matrix-js-sdk'
export type {
  PushRuleAction,
  EmptyObject,
  ICreateRoomOpts,
  ICreateClientOpts,
  LoginResponse,
  IEventRelation,
  ISendEventResponse,
  RegisterResponse,
  IRequestTokenResponse,
  MSC3575SlidingSyncResponse,
  MSC3575RoomData
} from 'matrix-js-sdk'
