/**
 * matrix-js-sdk 类型扩展
 * 提供官方 SDK 缺失的类型定义
 */
/// <reference types="vite/client" />

export type { ICreateClientOpts, MSC3575RoomData, MSC3575SlidingSyncResponse, SlidingSync } from 'matrix-js-sdk'
export {
  NotificationCountType,
  PendingEventOrdering,
  SlidingSyncEvent,
  SlidingSyncState
} from 'matrix-js-sdk'
