import type { MatrixClient, MatrixEvent, Room, RoomMember } from 'matrix-js-sdk'
import { RoomTypeEnum } from '@/enums'
import type { RoomInfo } from '@/services/types'
import matrixClientService from '../MatrixClientService'
import matrixEventServiceLocal from '../MatrixEventService'
import { matrixReadStateService } from '../messaging/MatrixReadStateService'
import { ClientEvent, RoomEvent } from '../sdk'
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
 * 在某个 client 实例上挂监听器，返回卸载函数。
 *
 * client 会在 forceReconnect / token 刷新 / 冷启动恢复时被重建，旧实例上的监听器
 * 随之失效；若不在新实例上重放，实时消息永远进不了 store（表现为「收不到别人发的消息」）。
 */
type ClientListenerBinder = (client: MatrixClient) => () => void

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
  /** key → 监听器绑定器；同一 key 重复注册会覆盖，避免 setupEventListeners 重入时重复渲染 */
  private readonly clientBinders = new Map<string, ClientListenerBinder>()
  /** 当前已挂载监听器的 client 实例，用于识别 client 重建 */
  private boundClient: MatrixClient | null = null
  private boundUnsubscribers: Array<() => void> = []
  private connectionStateHandler: ((...args: unknown[]) => void) | null = null

  /**
   * 登记一个 client 事件监听器，并按当前 client 幂等挂载。
   *
   * client 重建后由 `connectionState`(CONNECTED) 触发整组重放，无需调用方重新注册。
   */
  private bindClientListener(key: string, binder: ClientListenerBinder): void {
    this.clientBinders.set(key, binder)
    this.syncClientListeners()
  }

  /** 把已登记的监听器挂到当前 client；client 实例变化时先卸载旧实例上的监听器再重放。 */
  private syncClientListeners(): void {
    this.watchConnectionState()
    const client = matrixClientService.getClient()
    if (!client || client === this.boundClient) return

    for (const unsubscribe of this.boundUnsubscribers) {
      unsubscribe()
    }
    this.boundUnsubscribers = []
    this.boundClient = client
    for (const binder of this.clientBinders.values()) {
      this.boundUnsubscribers.push(binder(client))
    }
  }

  /** 监听连接状态：client 重建后重新 CONNECTED 时补挂监听器。 */
  private watchConnectionState(): void {
    if (this.connectionStateHandler) return
    this.connectionStateHandler = (...args: unknown[]) => {
      const data = args[0] as { state?: string } | undefined
      if (data?.state === 'CONNECTED') {
        this.syncClientListeners()
      }
    }
    matrixClientService.on('connectionState', this.connectionStateHandler)
  }

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
    this.bindClientListener('timeline', (client) => {
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
        }
        // m.room.redaction 不在此列：目标事件由 SDK 的 tryApplyRedaction 置为已撤回，
        // 撤回提示由 RoomEvent.Redaction → MatrixWsBridge → MSG_RECALL 驱动。

        callback({ roomId: room.roomId, eventType, roomInfo, message })
      }

      const handler = (
        event: MatrixEvent,
        room: Room | undefined,
        _toStartOfTimeline?: boolean,
        _removed?: boolean,
        data?: TimelineEventData
      ): void => {
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

      client.on(ROOM_EVENTS.Timeline, handler)
      return () => client.off(ROOM_EVENTS.Timeline, handler)
    })
  }

  onRoomNameChange(callback: (roomId: string, name: string) => void): void {
    this.bindClientListener('name', (client) => {
      // `Room.name` 由 Room 实例发出（client 不转发），直接监听 client 永远收不到。
      // 逐房间绑定，并为后续新建的房间补挂；初始 state 到达时 Room 也会 emit Name。
      const unsubscribers: Array<() => void> = []
      const bindRoom = (room: Room): void => {
        const handler = (): void => callback(room.roomId, room.name)
        room.on(RoomEvent.Name, handler)
        unsubscribers.push(() => room.off(RoomEvent.Name, handler))
        // 绑定前 state 可能已到达（监听器晚于 sync 挂载），补一次当前值，避免错过首次 Name。
        if (room.name) handler()
      }
      for (const room of client.getRooms()) bindRoom(room)
      const handleNewRoom = (...args: unknown[]): void => {
        const room = args[0] as Room | undefined
        if (room) bindRoom(room)
      }
      client.on(ClientEvent.Room, handleNewRoom)
      return () => {
        client.off(ClientEvent.Room, handleNewRoom)
        for (const unsubscribe of unsubscribers) unsubscribe()
      }
    })
  }

  onRoomAvatarChange(callback: (roomId: string, avatarUrl: string | null) => void): void {
    this.bindClientListener('avatar', (client) => {
      const handler = (room: Room): void => {
        callback(room.roomId, room.getMxcAvatarUrl?.() ?? null)
      }
      client.on(ROOM_EVENTS.Avatar, handler)
      return () => client.off(ROOM_EVENTS.Avatar, handler)
    })
  }

  onRoomMemberChange(callback: (roomId: string, roomInfo: RoomInfo) => void): void {
    this.bindClientListener('member', (client) => {
      const handler = (_event: MatrixEvent, member: RoomMember): void => {
        const roomId = member.roomId
        const room = client.getRoom(roomId)
        if (room) {
          const roomInfo = matrixRoomCreationService.convertRoomToRoomInfo(room)
          callback(roomId, roomInfo)
        }
      }
      client.on(ROOM_EVENTS.Member, handler)
      return () => client.off(ROOM_EVENTS.Member, handler)
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
