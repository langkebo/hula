import { MatrixRoomType } from '@/common/matrixConstants'
import { NotificationTypeEnum, RoomTypeEnum } from '@/enums'
import type { DmRoomInfo, MatrixClient, MatrixEvent, Room } from '@/services/matrix/sdk'
import { hasOwn } from '@/utils/webCompat'
import { findDmCounterpart, isDirectMessageRoomFromRoom } from '../room/roomTypeUtils'

export interface RoomNotificationSettings {
  shield?: boolean
  muteNotification?: NotificationTypeEnum
}

export interface SessionTagContent {
  tags?: { [tagName: string]: unknown }
}

export interface SessionInfo {
  id?: string
  roomId: string
  name: string
  avatar: string
  type: RoomTypeEnum
  unreadCount: number
  activeTime: number
  top: boolean
  shield: boolean
  muteNotification: NotificationTypeEnum
  detailId?: string | undefined
  remark?: string
  account?: string | undefined
  text?: string
  isFavorite?: boolean
}

export interface SessionDetail extends SessionInfo {}

export interface SessionDetailQuery {
  id: string
  roomType?: number
}

/**
 * 系统容器房间（如后端存放好友关系的 m.friends 房间）只承载协议状态，
 * 不能作为聊天会话展示：否则用户会对着只有自己的房间发消息，对方永远收不到。
 */
export function isSystemContainerRoom(room: Room): boolean {
  const createEvents = room.currentState?.getStateEvents?.('m.room.create')
  const createEvent = Array.isArray(createEvents) ? createEvents[0] : createEvents
  const roomType = (createEvent?.getContent?.() as { type?: unknown } | undefined)?.type
  return roomType === MatrixRoomType.FRIENDS
}

/**
 * 把 SDK `Room` 归一化成会话列表项：判定单聊/群聊、解析对端身份、汇总未读与预览。
 */
export function buildSessionFromRoom(room: Room, dmRoomInfo: DmRoomInfo | null, client: MatrixClient): SessionDetail {
  // 优先用 m.direct 映射的对方身份；若房间未注册进 m.direct（历史/重复创建的 DM 房间常见），
  // 则从房间成员中解析"除自己外的另一名成员"作为 counterpart，确保 detailId 始终填充，
  // 否则下游按 detailId 的去重会退回 roomId，导致同一联系人的多个 DM 房间在消息列表重复出现。
  // findDmCounterpart 优先 join 成员、回退 invite/任意成员，且不会误取自己。
  const selfId = client.getUserId() || undefined
  const joinedMemberCount = typeof room.getJoinedMemberCount === 'function' ? room.getJoinedMemberCount() : 0
  // 判型必须与 `RealtimeService.convertRoomToSession` 用同一判据（m.direct / DM 标记 或 2 人房），
  // 不能看「是否存在除自己外的成员」——群聊同样有对方成员，那样会把所有群聊判成单聊
  // （症状：群组会话列表恒空；群聊还会被当私聊按 counterpart 去重合并）。
  const isSingle = dmRoomInfo !== null || joinedMemberCount === 2 || isDirectMessageRoomFromRoom(client, room)
  // counterpart 只属于单聊：给群聊填 detailId 会让 `id`/`account` 指向某个成员，
  // 下游按该键去重与「进入私聊」动作都会错位。
  const otherMember = isSingle ? findDmCounterpart(room, selfId) : undefined
  const detailId = isSingle ? dmRoomInfo?.invitees?.[0] || dmRoomInfo?.inviter || otherMember : undefined
  const notificationSettings = getRoomNotificationSettings(room)

  return {
    id: detailId ?? room.roomId,
    roomId: room.roomId,
    name: resolveRoomName(room, detailId),
    avatar: room.getMxcAvatarUrl() || '',
    type: isSingle ? RoomTypeEnum.SINGLE : RoomTypeEnum.GROUP,
    unreadCount: getUnreadCount(room),
    activeTime: getLastActiveTime(room),
    top: isTopSession(room),
    shield: notificationSettings.shield ?? false,
    muteNotification: notificationSettings.muteNotification ?? NotificationTypeEnum.RECEPTION,
    detailId,
    account: detailId,
    text: getLastMessagePreview(room)
  }
}

/** 会话显示名：优先房间名，其次对端名，最后回退 roomId，保证列表不出现空标题。 */
export function resolveRoomName(room: Room, fallbackName?: string): string {
  const roomName = room.name?.trim()
  if (roomName) {
    return roomName
  }
  return fallbackName || room.roomId
}

/** 未读通知数：SDK 未提供该方法时按 0 处理，避免第三方房间对象导致列表崩溃。 */
export function getUnreadCount(room: Room): number {
  if (typeof room.getUnreadNotificationCount !== 'function') {
    return 0
  }
  return room.getUnreadNotificationCount() ?? 0
}

/** 最近活跃时间：取实时时间线最后一个事件的时间戳，无事件时为 0。 */
export function getLastActiveTime(room: Room): number {
  const events = typeof room.getLiveTimeline === 'function' ? room.getLiveTimeline().getEvents() : []
  const lastEvent = events[events.length - 1]
  return getEventTimestamp(lastEvent)
}

/** 消息预览：取最后一条事件正文，非文本内容或结构异常时返回空串。 */
export function getLastMessagePreview(room: Room): string {
  const events = typeof room.getLiveTimeline === 'function' ? room.getLiveTimeline().getEvents() : []
  const lastEvent = events[events.length - 1]
  if (!lastEvent || typeof lastEvent.getContent !== 'function') {
    return ''
  }
  const content = lastEvent.getContent()
  if (!content || typeof content !== 'object') {
    return ''
  }
  const body = Reflect.get(content, 'body')
  return typeof body === 'string' ? body : ''
}

/** 事件时间戳：事件缺失或 SDK 未实现 `getTs` 时返回 0。 */
export function getEventTimestamp(event: MatrixEvent | undefined): number {
  if (!event || typeof event.getTs !== 'function') {
    return 0
  }
  return event.getTs() ?? 0
}

/** 置顶判定：读 `m.tag` 账号数据，存在 `m.favourite` 即视为置顶会话。 */
export function isTopSession(room: Room): boolean {
  const accountData = room.getAccountData?.('m.tag')
  const content = accountData?.getContent() as SessionTagContent | undefined
  return !!content?.tags && hasOwn(content.tags, 'm.favourite')
}

/** 房间通知设置：读 `tjg.room.notification_settings` 账号数据，缺失时返回空对象。 */
export function getRoomNotificationSettings(room: Room): RoomNotificationSettings {
  const accountData = room.getAccountData?.('tjg.room.notification_settings')
  const content = accountData?.getContent()
  if (!content || typeof content !== 'object') {
    return {}
  }
  return content as RoomNotificationSettings
}
