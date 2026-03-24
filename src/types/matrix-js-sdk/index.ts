/**
 * matrix-js-sdk 类型扩展
 * 提供官方 SDK 缺失的类型定义
 */
/// <reference types="vite/client" />

// 重新导出官方类型
export * from 'matrix-js-sdk'

// 补充 SDK 缺失的类型
export { PendingEventOrdering, Method, ClientPrefix } from '../matrix-js-sdk.d'
export {
  Visibility,
  Preset,
  PushRuleKind,
  ReceiptType,
  NotificationCountType,
  RoomType,
  EventType,
  TweakName
} from '../matrix-js-sdk.d'
export type {
  PushRuleAction,
  EmptyObject,
  ICreateRoomOpts,
  ICreateClientOpts,
  LoginResponse,
  IEventRelation,
  ISendEventResponse,
  RegisterResponse,
  IRequestTokenResponse
} from '../matrix-js-sdk.d'
