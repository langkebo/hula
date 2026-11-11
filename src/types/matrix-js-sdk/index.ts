/**
 * matrix-js-sdk 类型再导出入口
 *
 * 本文件只做「从 SDK 顶层再导出」，不声明任何新类型：
 * - 需要给 SDK 补声明时 → src/types/matrix-js-sdk-augmentations.d.ts（唯一 augmentation 归属）
 * - 需要 tjg 自有扩展类型时 → src/types/matrix-extensions.d.ts（唯一独立类型归属）
 */
/// <reference types="vite/client" />

export type {
  ICreateClientOpts,
  MatrixClient,
  MSC3575RoomData,
  MSC3575SlidingSyncResponse,
  ReadReceiptsManager,
  Room,
  SlidingSync
} from 'matrix-js-sdk'
export {
  NotificationCountType,
  PendingEventOrdering,
  SlidingSyncEvent,
  SlidingSyncState
} from 'matrix-js-sdk'
