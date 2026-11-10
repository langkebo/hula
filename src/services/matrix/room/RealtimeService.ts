import type { MatrixEvent, Room, RoomMember } from 'matrix-js-sdk'
import { RoomTypeEnum } from '@/enums'
import type { RoomInfo } from '@/services/types'
import matrixClientService from '../MatrixClientService'
import matrixEventServiceLocal from '../MatrixEventService'
import { matrixReadStateService } from '../messaging/MatrixReadStateService'
import matrixSlidingSyncService from '../sync/MatrixSlidingSyncService'
import { matrixRoomCreationService } from './CreationService'
import { findDmCounterpart, isDirectMessageRoomFromRoom } from './roomTypeUtils'

const ROOM_EVENTS = {
  Timeline: 'Room.timeline',
  Name: 'Room.name',
  Avatar: 'Room.avatar',
  Member: 'Room.member'
} as const

/**
 * 实时位置共享（beacon）中可渲染为独立 BEACON 气泡的事件类型，含 MSC3672 不稳定前缀。
 * 实时时间线需将这些事件 dispatch 到 convertEventToMessage，
 * 否则会被当作普通事件丢弃（message 为 null）而无法渲染。
 * m.beacon（位置更新）不在此列：它通过 m.relates_to 关联到 beacon_info，
 * 不单独成气泡（Blocker 3）。
 */
const BEACON_EVENT_TYPES = new Set<string>(['m.beacon_info', 'org.matrix.msc3672.beacon_info'])

/**
 * 解析撤回事件指向的目标消息 ID。
 * room v11 起 redacts 迁移到 content.redacts；legacy 房间仍写在事件顶层 redacts。
 */
export function resolveRedactionTargetId(event: MatrixEvent): string | undefined {
  const contentTarget = event.getContent<{ redacts?: unknown }>()?.redacts
  const legacyTarget = event.event?.redacts
  const target = contentTarget ?? legacyTarget
  return typeof target === 'string' && target.length > 0 ? target : undefined
}

interface RoomSession {
  roomId: string
  name: string
  avatar: string
  type: RoomTypeEnum
  unreadCount: number
  activeTime: number
  /** DM 对方用户 MXID（单聊时填充，供下游按 counterpart 去重；历史重复 DM 房间靠它合并） */
  detailId?: string
  account?: string
}

interface VisibleRoomSession extends RoomSession {
  isFavorite: boolean
}

/**
 * `RoomEvent.Timeline` 的第 5 个参数：`timeline` 表示事件落在哪条时间线，
 * 讨论串时间线的 `getTimelineSet().thread` 非空，用于区分主时间线（D14）。
 */
interface TimelineEventData {
  timeline?: {
    getTimelineSet?: () => { thread?: unknown } | undefined
  }
}

/**
 * Realtime / view-layer domain service.
 *
 * Groups two concerns that share live-client reads:
 * - SDK event subscription wrappers (`onTimelineEvent` / `onRoomNameChange` / `onRoomAvatarChange` / `onRoomMemberChange`)
 * - Room → view-model projections for list UIs (`convertRoomToSession` / `getVisibleRoomSessions` / `getAllRoomInfos` / `getRoomName` / `getRoomAvatarUrl`)
 *
 * Extracted from `MatrixRoomService` as part of the P1-1 split.
 */
export class MatrixRoomRealtimeService {
  convertRoomToSession(room: Room): RoomSession {
    const name = room.name || 'Unknown Room'
    const avatar = room.getMxcAvatarUrl() || ''
    // 判断是否为单聊：优先检查 m.direct account data（DM 标记），
    // 回退到 getJoinedMemberCount() === 2（成员数判断）
    const client = matrixClientService.getClient()
    const isDm = isDirectMessageRoomFromRoom(client, room)
    const type = isDm || room.getJoinedMemberCount() === 2 ? RoomTypeEnum.SINGLE : RoomTypeEnum.GROUP
    const unreadCount = matrixReadStateService.getUnreadCount(room.roomId)
    const lastEvent = room.getLiveTimeline().getEvents().slice(-1)[0]
    const activeTime = lastEvent?.getTs?.() || 0

    // 单聊补 counterpart：从房间成员中解析「除自己外的另一名成员」作为 detailId/account。
    // 与 MatrixSessionService.buildSessionFromRoom 一致——缺失该字段时，下游按 detailId
    // 的会话去重会退回空值，导致同一联系人的多个历史 DM 房间在会话列表重复出现。
    // 用 findDmCounterpart：优先 join 成员，回退 invite/任意成员，且不会误取自己。
    let detailId: string | undefined
    if (type === RoomTypeEnum.SINGLE && client) {
      try {
        const selfId = client.getUserId?.()
        // selfId 未知时无法可靠区分自己/对方，宁可留空（下游按 roomId 兜底），
        // 也不能误把「自己」当 counterpart，否则所有 DM 会被合并成一条。
        if (selfId) {
          detailId = findDmCounterpart(room, selfId)
        }
      } catch {
        detailId = undefined
      }
    }

    return {
      roomId: room.roomId,
      name,
      avatar,
      type,
      unreadCount,
      activeTime,
      ...(detailId ? { detailId, account: detailId } : {})
    }
  }

  onTimelineEvent(
    callback: (data: {
      roomId: string
      eventType: string
      roomInfo: RoomInfo
      message: import('@/stores/domains/chat/chat/types').MessageType | null
    }) => void
  ): void {
    const client = matrixClientService.getClient()
    if (!client) return

    const emitTimelineEvent = (event: MatrixEvent, room: Room): void => {
      const eventType = event.getType()
      const roomInfo = matrixRoomCreationService.convertRoomToRoomInfo(room)
      let message: import('@/stores/domains/chat/chat/types').MessageType | null = null

      if (eventType === 'm.room.message') {
        message = matrixEventServiceLocal.convertEventToMessage(event, room)
      } else if (eventType === 'm.room.encrypted') {
        message = matrixEventServiceLocal.convertEventToMessageType(event)
      } else if (BEACON_EVENT_TYPES.has(eventType)) {
        message = matrixEventServiceLocal.convertEventToMessage(event, room)
      } else if (eventType === 'm.room.redaction') {
        // 撤回提示由 MatrixWsBridge 统一上抛（RoomEvent.Redaction + 本条 timeline 双通道去重），
        // 这里只做目标事件的幂等兜底：SDK 已能解析 content.redacts 并在命中时 makeRedacted，
        // 此调用仅在 SDK 未命中/未生效时补齐，保证重复渲染不会回显原文。
        this.applyRedaction(event, room)
      }

      callback({ roomId: room.roomId, eventType, roomInfo, message })
    }

    client.on(
      ROOM_EVENTS.Timeline,
      (
        event: MatrixEvent,
        room: Room | undefined,
        _toStartOfTimeline?: boolean,
        _removed?: boolean,
        data?: TimelineEventData
      ) => {
        if (!room) return

        // D14：开启 threadSupport 后，讨论串回复只存在于 thread 时间线，
        // SDK 会经 room.reEmitter 把 thread 的 RoomEvent.Timeline 再转发到本回调
        // （第二个参数仍是同一个 Room，只能靠 data.timeline 区分）。
        // 不过滤会在主会话里重复渲染 thread 回复，thread root 更会与主时间线版本重复。
        if (data?.timeline?.getTimelineSet?.()?.thread) return

        emitTimelineEvent(event, room)

        if (event.getType() === 'm.room.encrypted') {
          for (const delay of [250, 1000, 3000]) {
            setTimeout(() => {
              if (event.getType() === 'm.room.message' || BEACON_EVENT_TYPES.has(event.getType())) {
                emitTimelineEvent(event, room)
              }
            }, delay)
          }
        }
      }
    )
  }

  /**
   * 目标事件的幂等兜底：就地补齐已撤回标记。
   *
   * vendored SDK 的 `tryApplyRedaction` 已能解析 content.redacts（room v11+）与顶层 redacts，
   * 并在目标事件仍在本窗口 timeline 中时 makeRedacted。目标已滑出窗口时 SDK 静默跳过，
   * 此时本方法也无事可做（findEventById 为空）；它的价值是防御 SDK 未生效时原文残留，
   * 与 MatrixWsBridge 的 MSG_RECALL 上抛互补（后者负责 UI 撤回态落地）。
   */
  private applyRedaction(event: MatrixEvent, room: Room): void {
    const targetId = resolveRedactionTargetId(event)
    if (!targetId) return

    const target = room.findEventById(targetId)
    if (target && !target.isRedacted()) {
      target.makeRedacted(event, room)
    }
  }

  onRoomNameChange(callback: (roomId: string, name: string) => void): void {
    const client = matrixClientService.getClient()
    if (!client) return

    client.on(ROOM_EVENTS.Name, (room: Room) => {
      callback(room.roomId, room.name)
    })
  }

  onRoomAvatarChange(callback: (roomId: string, avatarUrl: string | null) => void): void {
    const client = matrixClientService.getClient()
    if (!client) return

    client.on(ROOM_EVENTS.Avatar, (room: Room) => {
      callback(room.roomId, room.getMxcAvatarUrl?.() ?? null)
    })
  }

  onRoomMemberChange(callback: (roomId: string, roomInfo: RoomInfo) => void): void {
    const client = matrixClientService.getClient()
    if (!client) return

    client.on(ROOM_EVENTS.Member, (_event: MatrixEvent, member: RoomMember) => {
      const roomId = member.roomId
      const room = client.getRoom(roomId)
      if (room) {
        const roomInfo = matrixRoomCreationService.convertRoomToRoomInfo(room)
        callback(roomId, roomInfo)
      }
    })
  }

  getRoomName(roomId: string): string | null {
    const client = matrixClientService.getClient()
    if (!client) return null
    const room = client.getRoom(roomId)
    return room?.name ?? null
  }

  getRoomAvatarUrl(roomId: string): string | null {
    const client = matrixClientService.getClient()
    if (!client) return null
    const room = client.getRoom(roomId)
    return room?.getMxcAvatarUrl?.() ?? null
  }

  getVisibleRoomSessions(specialFriends: string[]): VisibleRoomSession[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const currentUserId = client.getUserId()
    const rooms = client.getVisibleRooms()

    return rooms.map((room) => {
      const session = this.convertRoomToSession(room)
      const otherMember = room.getJoinedMembers().find((m) => m.userId !== currentUserId)
      const isFavorite = !!(otherMember && specialFriends.includes(otherMember.userId))

      return {
        ...session,
        isFavorite
      }
    })
  }

  getAllRoomInfos(): RoomInfo[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const roomInfos = client.getRooms().map((room) => matrixRoomCreationService.convertRoomToRoomInfo(room))
    matrixSlidingSyncService.applySlidingSyncUnreadCounts(roomInfos)
    return roomInfos
  }
}

export const matrixRoomRealtimeService = new MatrixRoomRealtimeService()
