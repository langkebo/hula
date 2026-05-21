import { type MatrixEvent, NotificationCountType, type Room } from 'matrix-js-sdk'
import { MessageStatusEnum } from '@/enums'
import type { MessageType } from '@/types/message'
import matrixMessageAdapter from '../messaging/MatrixMessageAdapter'
import { getMessagePreviewByType, getRoomTimelinePreview } from './roomPreviewText'

export interface SlidingSyncUnreadCounts {
  notificationCount?: number
  highlightCount?: number
}

/**
 * 将 SDK 的 Room 对象转换为 Hula 内部的 RoomInfo 格式
 */
function convertRoomToRoomInfo(room: Room, isEncrypted: boolean) {
  const timeline = room.getLiveTimeline().getEvents()
  const lastEvent = timeline[timeline.length - 1]

  let lastMessage: string | null = null
  let lastMessageTime: number | null = null

  if (lastEvent) {
    lastMessageTime = lastEvent.getTs()
    lastMessage = getRoomTimelinePreview(lastEvent.getType(), lastEvent.getContent())
  }

  const isSpaceRoom = typeof room.isSpaceRoom === 'function' ? (room.isSpaceRoom() as boolean) : false
  const dmInviter =
    typeof (room as unknown as Record<string, unknown>).getDMInviter === 'function'
      ? ((room as unknown as { getDMInviter: () => string | undefined }).getDMInviter() as string | undefined)
      : undefined

  // 使用 SDK 内部方法获取未读计数
  const unreadCount = room.getUnreadNotificationCount?.(NotificationCountType.Total) || 0
  const highlightCount = room.getUnreadNotificationCount?.(NotificationCountType.Highlight) || 0
  const notificationCount = unreadCount

  return {
    roomId: room.roomId,
    name: room.name || room.roomId,
    avatarUrl: typeof room.getMxcAvatarUrl === 'function' ? room.getMxcAvatarUrl() : null,
    isDirect: isSpaceRoom ? false : dmInviter !== undefined || room.getJoinedMembers().length <= 2,
    isEncrypted,
    unreadCount,
    highlightCount,
    notificationCount,
    lastMessage,
    lastMessageTime,
    members: room.getJoinedMembers().map((member) => ({
      userId: member.userId,
      name: member.name || member.userId,
      avatarUrl: typeof member.getMxcAvatarUrl === 'function' ? (member.getMxcAvatarUrl() ?? undefined) : undefined,
      powerLevel: member.powerLevel
    }))
  }
}

/**
 * 应用来自滑动同步的未读计数
 */
function applySlidingSyncUnreadCounts<
  T extends { unreadCount: number; highlightCount: number; notificationCount: number }
>(roomInfo: T, counts?: SlidingSyncUnreadCounts): T {
  if (!counts) {
    return roomInfo
  }

  if (counts.notificationCount !== undefined) {
    roomInfo.unreadCount = counts.notificationCount
    roomInfo.notificationCount = counts.notificationCount
  }

  if (counts.highlightCount !== undefined) {
    roomInfo.highlightCount = counts.highlightCount
  }

  return roomInfo
}

/**
 * 判断是否为可展示的消息事件
 */
function isDisplayableMessageEvent(event: MatrixEvent): boolean {
  const eventType = event.getType()
  return eventType === 'm.room.message' || eventType === 'm.room.encrypted'
}

/**
 * 将 SDK 的 MatrixEvent 转换为 Hula 内部的 MessageType 格式
 */
function convertMatrixEventToMessage(event: MatrixEvent): MessageType {
  const content = event.getContent()
  const body = (content.body as string | undefined) ?? ''
  const messageType = matrixMessageAdapter.getMsgTypeFromEventLike(event.getType(), content)

  return {
    fromUser: {
      uid: event.getSender() ?? '',
      username: event.getSender() ?? '',
      avatar: ''
    },
    message: {
      id: event.getId() ?? '',
      roomId: event.getRoomId() ?? '',
      type: messageType,
      body: {
        ...content,
        body,
        content: body,
        msgtype: (content.msgtype as string | undefined) ?? 'm.text'
      },
      sendTime: event.getTs(),
      messageMarks: {},
      status: MessageStatusEnum.SUCCESS
    },
    sendTime: event.getTs(),
    loading: false
  }
}

/**
 * 将 SDK 的 MatrixEvent 数组转换为 Hula 内部的 MessageType 数组
 */
function convertMatrixEventsToMessages(events: MatrixEvent[]): MessageType[] {
  return events.filter(isDisplayableMessageEvent).map(convertMatrixEventToMessage)
}

/**
 * 将滑动同步的时间线事件转换为 Hula 内部的 MessageType 格式
 */
function convertTimelineEventToMessage(roomId: string, event: Record<string, unknown>): MessageType {
  const content = (event.content ?? {}) as Record<string, unknown>
  const body = (content.body as string | undefined) ?? ''
  const messageType = matrixMessageAdapter.getMsgTypeFromEventLike(event.type as string, content)

  return {
    fromUser: {
      uid: event.sender as string,
      username: event.sender as string,
      avatar: ''
    },
    message: {
      id: event.event_id as string,
      roomId,
      type: messageType,
      body: {
        ...content,
        body,
        content: body,
        msgtype: (content.msgtype as string | undefined) ?? 'm.text'
      },
      sendTime: event.origin_server_ts as number,
      messageMarks: {},
      status: MessageStatusEnum.SUCCESS
    },
    sendTime: event.origin_server_ts as number,
    loading: false
  }
}

export const matrixRoomStoreAdapter = {
  getTimelineEventPreview: getRoomTimelinePreview,
  getMessagePreview: (message: MessageType) =>
    getMessagePreviewByType(message.message.type, message.message.body as Record<string, unknown>),
  convertRoomToRoomInfo,
  applySlidingSyncUnreadCounts,
  isDisplayableMessageEvent,
  convertMatrixEventToMessage,
  convertMatrixEventsToMessages,
  convertTimelineEventToMessage
}

export default matrixRoomStoreAdapter
