/**
 * @deprecated 此文件已废弃，Matrix 使用同步 API 替代 WebSocket
 * 请使用 matrix-js-sdk 的同步机制
 * 迁移完成后此文件将被删除
 */

// WsResponseMessageType 已迁移至 @/enums，此处重新导出以保持向后兼容
export { WsResponseMessageType } from '@/enums'

export type WsTokenExpire = {
  uid: string
  ip: string
  client: string
}

export enum CallResponseStatus {
  TIMEOUT = -1,
  REJECTED = 0,
  ACCEPTED = 1,
  DROPPED = 2,
  CANCEL = 3
}
