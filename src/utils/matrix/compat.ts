// Matrix JS SDK 40.x 兼容层
// 用于适配旧 API 调用

import type { MatrixEvent as MatrixEventType, Room as RoomType } from 'matrix-js-sdk'

// 为 MatrixEvent 添加兼容方法
export function patchMatrixEvent(event: MatrixEventType): MatrixEventType {
  const extendedEvent = event as MatrixEventType & {
    eventId?: string
    type?: string
    sender?: { userId: string }
    timestamp?: number
    roomId?: string
  }

  // 如果方法已存在则不覆盖
  if (typeof extendedEvent.getId !== 'function') {
    Object.defineProperty(extendedEvent, 'getId', {
      value: () => extendedEvent.eventId || '',
      writable: true,
      configurable: true
    })
  }
  if (typeof extendedEvent.getType !== 'function') {
    Object.defineProperty(extendedEvent, 'getType', {
      value: () => extendedEvent.type || '',
      writable: true,
      configurable: true
    })
  }
  if (typeof extendedEvent.getSender !== 'function') {
    Object.defineProperty(extendedEvent, 'getSender', {
      value: () => extendedEvent.sender?.userId ?? null,
      writable: true,
      configurable: true
    })
  }
  if (typeof extendedEvent.getTs !== 'function') {
    Object.defineProperty(extendedEvent, 'getTs', {
      value: () => extendedEvent.timestamp || 0,
      writable: true,
      configurable: true
    })
  }
  if (typeof extendedEvent.getRoomId !== 'function') {
    Object.defineProperty(extendedEvent, 'getRoomId', {
      value: () => extendedEvent.roomId || '',
      writable: true,
      configurable: true
    })
  }
  return event
}

// 为 Room 添加兼容方法
export function patchRoom(room: RoomType): RoomType {
  const extendedRoom = room as RoomType & {
    name?: string
  }

  if (typeof extendedRoom.getName !== 'function') {
    Object.defineProperty(extendedRoom, 'getName', {
      value: () => extendedRoom.name || '',
      writable: true,
      configurable: true
    })
  }
  return room
}
