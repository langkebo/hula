import { type MatrixEvent, NotificationCountType, type Room } from 'matrix-js-sdk'
import { MessageStatusEnum, MsgEnum } from '@/enums'
import type { IContent } from '@/services/matrix/sdk'
import type { MessageType } from '@/types/message'
import matrixMessageAdapter from '../messaging/MatrixMessageAdapter'
import { getMessagePreviewByType, getRoomTimelinePreview } from './roomPreviewText'

interface SlidingSyncUnreadCounts {
  notificationCount?: number
  highlightCount?: number
}

/**
 * 滑动同步时间线原始事件（SDK 事件对象的 JSON 视图）。
 * 后端可能追加扩展字段，故保留索引签名。
 */
interface SlidingSyncRawEvent {
  event_id?: string
  type?: string
  sender?: string
  origin_server_ts?: number
  content?: IContent
  [field: string]: unknown
}

/**
 * 将 SDK 的 Room 对象转换为 Tjg 内部的 RoomInfo 格式
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
  const dmInviter = (room as Room & { getDMInviter?: () => string | undefined }).getDMInviter?.()

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
 * 组装消息 body：
 * - 位置/信标事件使用 MatrixMessageAdapter 解析为 LocationBody/BeaconBody
 * - 其余类型保持原始 content 透传，兼容现有渲染路径
 */
function buildMessageBody(
  content: IContent,
  body: string,
  messageType: MsgEnum,
  encrypted = false
): MessageType['message']['body'] {
  const base =
    messageType === MsgEnum.LOCATION || messageType === MsgEnum.BEACON
      ? (matrixMessageAdapter.convertMatrixContent(content, messageType) as MessageType['message']['body'])
      : {
          ...content,
          body,
          content: body,
          msgtype: (content.msgtype as string | undefined) ?? 'm.text'
        }
  if (!encrypted) return base
  // `hasEncryption` 是消息信任判定的唯一依据（useMessageTrust）。
  // 不落这个标记时，加密房间内的所有消息都会被误判为「明文降级」→ 红锁 risk。
  return { ...(base as Record<string, unknown>), hasEncryption: true } as MessageType['message']['body']
}

/**
 * 判断 SDK 事件是否来自加密传输。
 *
 * 已解密事件 `getType()` 返回明文类型，必须再看 `isEncrypted()` / `getWireType()`；
 * 未解密事件则直接是 `m.room.encrypted`。
 */
function isEncryptedSdkEvent(event: MatrixEvent): boolean {
  if (event.getType() === 'm.room.encrypted') return true
  if (typeof event.isEncrypted === 'function' && event.isEncrypted()) return true
  return typeof event.getWireType === 'function' && event.getWireType() === 'm.room.encrypted'
}

/**
 * 将 SDK 的 MatrixEvent 转换为 Tjg 内部的 MessageType 格式
 */
function convertMatrixEventToMessage(event: MatrixEvent): MessageType {
  const content = event.getContent()
  const body = (content.body as string | undefined) ?? ''
  const messageType = matrixMessageAdapter.getMsgTypeFromEventLike(event.getType(), content)
  const encrypted = isEncryptedSdkEvent(event)

  return {
    clientKey: event.getId() ?? '',
    fromUser: {
      uid: event.getSender() ?? '',
      username: event.getSender() ?? '',
      avatar: ''
    },
    message: {
      id: event.getId() ?? '',
      roomId: event.getRoomId() ?? '',
      type: messageType,
      body: buildMessageBody(content, body, messageType, encrypted),
      sendTime: event.getTs(),
      messageMarks: {},
      status: MessageStatusEnum.SUCCESS
    },
    sendTime: event.getTs(),
    loading: false
  }
}

/**
 * 将 SDK 的 MatrixEvent 数组转换为 Tjg 内部的 MessageType 数组
 */
function convertMatrixEventsToMessages(events: MatrixEvent[]): MessageType[] {
  return events.filter(isDisplayableMessageEvent).map(convertMatrixEventToMessage)
}

/**
 * 将滑动同步的时间线事件转换为 Tjg 内部的 MessageType 格式
 */
function convertTimelineEventToMessage(roomId: string, event: SlidingSyncRawEvent): MessageType {
  const content: IContent = event.content ?? {}
  const body = (content.body as string | undefined) ?? ''
  const messageType = matrixMessageAdapter.getMsgTypeFromEventLike(event.type as string, content)
  const encrypted = event.type === 'm.room.encrypted'

  return {
    clientKey: event.event_id as string,
    fromUser: {
      uid: (event.sender as string | undefined) ?? '',
      username: (event.sender as string | undefined) ?? '',
      avatar: ''
    },
    message: {
      id: event.event_id as string,
      roomId,
      type: messageType,
      body: buildMessageBody(content, body, messageType, encrypted),
      sendTime: event.origin_server_ts as number,
      messageMarks: {},
      status: MessageStatusEnum.SUCCESS
    },
    sendTime: event.origin_server_ts as number,
    loading: false
  }
}

const matrixRoomStoreAdapter = {
  getTimelineEventPreview: getRoomTimelinePreview,
  getMessagePreview: (message: MessageType) =>
    getMessagePreviewByType(message.message.type, message.message.body as IContent),
  convertRoomToRoomInfo,
  applySlidingSyncUnreadCounts,
  isDisplayableMessageEvent,
  convertMatrixEventToMessage,
  convertMatrixEventsToMessages,
  convertTimelineEventToMessage
}

export default matrixRoomStoreAdapter
