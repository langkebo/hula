// Matrix JS SDK 40.x 兼容层
// 用于适配旧 API 调用

import type { MatrixEvent as MatrixEventType, Room as RoomType } from 'matrix-js-sdk'

// 为 MatrixEvent 添加兼容方法
export function patchMatrixEvent(event: MatrixEventType): MatrixEventType {
  // 如果方法已存在则不覆盖
  if (typeof (event as any).getId !== 'function') {
    ;(event as any).getId = () => (event as any).eventId
  }
  if (typeof (event as any).getType !== 'function') {
    ;(event as any).getType = () => (event as any).type
  }
  if (typeof (event as any).getSender !== 'function') {
    ;(event as any).getSender = () => (event as any).sender?.userId ?? null
  }
  if (typeof (event as any).getTs !== 'function') {
    ;(event as any).getTs = () => (event as any).timestamp
  }
  if (typeof (event as any).getRoomId !== 'function') {
    ;(event as any).getRoomId = () => (event as any).roomId
  }
  return event
}

// 为 Room 添加兼容方法
export function patchRoom(room: RoomType): RoomType {
  if (typeof (room as any).getId !== 'function') {
    ;(room as any).getId = () => (room as any).roomId
  }
  if (typeof (room as any).getName !== 'function') {
    ;(room as any).getName = () => (room as any).name
  }
  return room
}
