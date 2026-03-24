/**
 * Matrix 事件工具函数
 * 统一事件 ID、房间成员等常用操作
 */
import type { Room, RoomMember, MatrixClient } from 'matrix-js-sdk'

// 简化类型定义，兼容不同来源的事件对象
type MatrixEventLike = {
  event_id?: string
  room_id?: string
  sender?: string
  type?: string
  origin_server_ts?: number
  content?: unknown
  getId?: () => string
  getRoomId?: () => string
  getSender?: () => string
  getType?: () => string
  getTs?: () => number
  getContent?: () => unknown
  isState?: () => boolean
  isEncrypted?: () => boolean
}

/**
 * 获取事件的 ID
 * 兼容不同来源的事件对象
 */
export function getEventId(event: MatrixEventLike | null | undefined): string {
  if (!event) return ''

  // 优先使用 getId 方法
  if (typeof event.getId === 'function') {
    return event.getId() || ''
  }

  // 兼容旧版或原始事件对象
  return (event as any).event_id || ''
}

/**
 * 获取事件的房间 ID
 */
export function getEventRoomId(event: MatrixEventLike | null | undefined): string {
  if (!event) return ''

  if (typeof event.getRoomId === 'function') {
    return event.getRoomId() || ''
  }

  return (event as any).room_id || ''
}

/**
 * 获取事件的发送者 ID
 */
export function getEventSender(event: MatrixEventLike | null | undefined): string {
  if (!event) return ''

  if (typeof event.getSender === 'function') {
    return event.getSender() || ''
  }

  return (event as any).sender || ''
}

/**
 * 获取事件的类型
 */
export function getEventType(event: MatrixEventLike | null | undefined): string {
  if (!event) return ''

  if (typeof event.getType === 'function') {
    return event.getType() || ''
  }

  return (event as any).type || ''
}

/**
 * 获取事件的时间戳
 */
export function getEventTs(event: MatrixEventLike | null | undefined): number {
  if (!event) return 0

  if (typeof event.getTs === 'function') {
    return event.getTs() || 0
  }

  return (event as any).origin_server_ts || 0
}

/**
 * 获取事件内容
 */
export function getEventContent(event: MatrixEventLike | null | undefined): Record<string, unknown> {
  if (!event) return {}

  if (typeof event.getContent === 'function') {
    return (event.getContent() as Record<string, unknown>) || {}
  }

  return (event as any).content || {}
}

/**
 * 获取房间 ID（兼容 Room 和 roomId 字符串）
 */
export function getRoomId(room: Room | string | { roomId?: string; getRoomId?: () => string }): string {
  if (!room) return ''

  if (typeof room === 'string') {
    return room
  }

  if (typeof room.getRoomId === 'function') {
    return room.getRoomId() || ''
  }

  return (room as any).roomId || ''
}

/**
 * 获取房间名称
 */
export function getRoomName(room: Room | { name?: string; getName?: () => string }): string {
  if (!room) return ''

  if (typeof room.getName === 'function') {
    return room.getName() || ''
  }

  return (room as any).name || ''
}

/**
 * 获取房间成员列表
 */
export function getRoomMembers(room: Room | { getMembers?: () => RoomMember[] }): RoomMember[] {
  if (!room) return []

  if (typeof room.getMembers === 'function') {
    return room.getMembers() || []
  }

  return []
}

/**
 * 获取房间已加入的成员
 */
export function getRoomJoinedMembers(room: Room | { getJoinedMembers?: () => RoomMember[] }): RoomMember[] {
  if (!room) return []

  if (typeof room.getJoinedMembers === 'function') {
    return room.getJoinedMembers() || []
  }

  return []
}

/**
 * 获取房间成员（按用户 ID）
 */
export function getRoomMember(
  room: Room | { getMember?: (userId: string) => RoomMember | null },
  userId: string
): RoomMember | null {
  if (!room || !userId) return null

  if (typeof room.getMember === 'function') {
    return room.getMember(userId) || null
  }

  return null
}

/**
 * 通过 Client 获取房间
 */
export function getRoomById(client: MatrixClient, roomId: string): Room | null {
  if (!client || !roomId) return null

  if (typeof client.getRoom === 'function') {
    return client.getRoom(roomId) || null
  }

  return null
}

/**
 * 获取用户 ID
 */
export function getUserId(event: { user_id?: string }): string {
  if (!event) return ''
  return event.user_id || ''
}

/**
 * 检查事件是否为状态事件
 */
export function isStateEvent(event: MatrixEventLike | null | undefined): boolean {
  if (!event) return false

  if (typeof event.isState === 'function') {
    return event.isState()
  }

  return false
}

/**
 * 检查事件是否加密
 */
export function isEncryptedEvent(event: MatrixEventLike | null | undefined): boolean {
  if (!event) return false

  if (typeof event.isEncrypted === 'function') {
    return event.isEncrypted()
  }

  return false
}
