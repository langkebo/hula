import { type ShallowRef, triggerRef } from 'vue'
import { MessageStatusEnum, MsgEnum } from '@/enums'
import matrixClientService from '@/services/matrix/MatrixClientService'
import matrixEventService from '@/services/matrix/MatrixEventService'
import { matrixRoomCreationService } from '@/services/matrix/room/CreationService'
import { matrixRoomRealtimeService } from '@/services/matrix/room/RealtimeService'
import matrixSlidingSyncService, { type SlidingSyncUnreadUpdate } from '@/services/matrix/sync/MatrixSlidingSyncService'
import type { RoomInfo } from '@/services/types'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useSessionStore } from '@/stores/domains/chat/chat/session'
import type { MessageType } from '@/stores/domains/chat/chat/types'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('RoomStore.Sync')

interface TimelineEvent {
  type?: string
  content?: Record<string, unknown>
  origin_server_ts?: number | null
  sender?: string
  event_id?: string
}

export type RoomSyncContext = {
  rooms: ShallowRef<Map<string, RoomInfo>>
  updateRoom: (roomId: string, updates: Partial<RoomInfo>) => void
  loadRooms: () => Promise<boolean>
  scheduleTagsRefresh: (roomId: string) => void
  batchRefreshTags: () => Promise<void>
}

/**
 * 房间实时同步模块
 *
 * 监听 RealtimeService 时间线/解密/成员/名称/头像事件与 SlidingSync 回调，
 * 将增量数据写入 rooms 与 chatStore/message。含 listenersInitialized 幂等闸门、
 * onRoomListRefresh 300ms 防抖、标签刷新调度。
 */
export function createRoomSync(ctx: RoomSyncContext) {
  const { rooms, updateRoom, loadRooms, scheduleTagsRefresh, batchRefreshTags } = ctx

  let listenersInitialized = false
  let loadRoomsDebounce: ReturnType<typeof setTimeout> | null = null

  async function handleIncrementalUpdate(
    roomId: string,
    roomData: {
      timeline?: TimelineEvent[]
      notification_count?: number
      highlight_count?: number
      summary?: Record<string, unknown>
    }
  ): Promise<void> {
    const existingRoom = rooms.value.get(roomId)
    if (!existingRoom) return

    if (roomData.notification_count !== undefined) {
      existingRoom.unreadCount = roomData.notification_count
      existingRoom.highlightCount = roomData.highlight_count ?? 0
      existingRoom.notificationCount = roomData.notification_count
    }

    if (roomData.summary) {
      if (roomData.summary.name) {
        existingRoom.name = roomData.summary.name as string
      }
      if (roomData.summary.avatar_url) {
        existingRoom.avatarUrl = roomData.summary.avatar_url as string
      }
      if (existingRoom.detail) {
        if (roomData.summary.joined_member_count !== undefined) {
          existingRoom.detail.joinedCount = roomData.summary.joined_member_count as number
        }
      }
    }

    if (roomData.timeline && roomData.timeline.length > 0) {
      const latestEvent = roomData.timeline[roomData.timeline.length - 1]
      if (latestEvent) {
        const msgtype = latestEvent.content?.msgtype as string | undefined
        if (msgtype === 'm.text' || msgtype === 'm.notice') {
          existingRoom.lastMessage = (latestEvent.content?.body as string) ?? null
        } else if (msgtype === 'm.image') {
          existingRoom.lastMessage = '[图片]'
        } else if (msgtype === 'm.video') {
          existingRoom.lastMessage = '[视频]'
        } else if (msgtype === 'm.audio' || msgtype === 'm.voice') {
          existingRoom.lastMessage = '[音频]'
        } else if (msgtype === 'm.file') {
          existingRoom.lastMessage = '[文件]'
        } else if (latestEvent.type === 'm.room.member') {
          existingRoom.lastMessage = latestEvent.content?.membership === 'join' ? '加入了房间' : '离开了房间'
        } else {
          existingRoom.lastMessage = (latestEvent.content?.body as string) ?? null
        }
        existingRoom.lastMessageTime = (latestEvent.origin_server_ts as number | null) ?? null
      }

      const chatStore = useChatStore()
      // 可显示的消息事件类型白名单，非消息事件（如 m.thread、m.reaction）不渲染为消息气泡
      const DISPLAYABLE_EVENT_TYPES = new Set([
        'm.room.message',
        'm.room.encrypted',
        'm.room.member',
        'm.room.redaction',
        'm.beacon_info',
        'm.beacon'
      ])
      for (const event of roomData.timeline) {
        if (!DISPLAYABLE_EVENT_TYPES.has(event.type ?? '')) continue
        const msgtype = event.content?.msgtype as string | undefined
        let msgEnum = MsgEnum.TEXT
        if (msgtype === 'm.image') msgEnum = MsgEnum.IMAGE
        else if (msgtype === 'm.video') msgEnum = MsgEnum.VIDEO
        else if (msgtype === 'm.audio' || msgtype === 'm.voice') msgEnum = MsgEnum.VOICE
        else if (msgtype === 'm.file') msgEnum = MsgEnum.FILE
        else if (event.type === 'm.room.member') msgEnum = MsgEnum.SYSTEM

        const msg: MessageType = {
          clientKey: event.event_id ?? '',
          fromUser: {
            uid: event.sender ?? '',
            username: event.sender ?? '',
            avatar: ''
          },
          message: {
            id: event.event_id ?? '',
            roomId: roomId,
            type: msgEnum,
            body: (event.content?.body as Record<string, unknown>) ?? '',
            sendTime: (event.origin_server_ts as number | null) ?? 0,
            messageMarks: {},
            status: MessageStatusEnum.SUCCESS
          },
          sendTime: (event.origin_server_ts as number | null) ?? 0
        }
        chatStore.pushMsg(msg)
      }
    }

    rooms.value.set(roomId, existingRoom)
    triggerRef(rooms)
    logger.info(`[RoomStore] 处理增量更新: ${roomId}`)
  }

  async function setupEventListeners(): Promise<void> {
    if (listenersInitialized) {
      return
    }

    const chatStore = useChatStore()
    const normalizeMessageBody = (body: unknown): Record<string, unknown> => {
      if (body && typeof body === 'object') {
        return body as Record<string, unknown>
      }

      return {
        body: String(body ?? ''),
        content: String(body ?? '')
      }
    }
    const hasRenderableMessageBody = (body: unknown): boolean => {
      if (!body || typeof body !== 'object') {
        return typeof body === 'string' && body.length > 0
      }

      const typedBody = body as { content?: unknown; body?: unknown }
      return typeof typedBody.content === 'string' || typeof typedBody.body === 'string'
    }

    matrixRoomRealtimeService.onTimelineEvent(({ roomId, eventType, roomInfo, message }) => {
      if ((eventType === 'm.room.message' || eventType === 'm.room.encrypted') && message) {
        if (chatStore.checkMsgExist(roomId, message.message.id)) {
          if (eventType === 'm.room.message' && hasRenderableMessageBody(message.message.body)) {
            chatStore.updateMsg({
              msgId: message.message.id,
              roomId,
              status: MessageStatusEnum.SUCCESS,
              body: normalizeMessageBody(message.message.body)
            })
          }
        } else {
          chatStore.pushMsg(message)
        }
      }

      rooms.value.set(roomId, roomInfo)
      triggerRef(rooms)
    })

    matrixClientService.on('eventDecrypted', (payload: unknown) => {
      const { event, err, room } = payload as {
        event?: Parameters<typeof matrixEventService.convertEventToMessage>[0]
        err?: Error
        room?: Parameters<typeof matrixEventService.convertEventToMessage>[1]
      }
      if (err || !event || !room) {
        return
      }

      const message = matrixEventService.convertEventToMessage(event, room)
      if (!message?.message?.id) {
        return
      }

      const roomId = message.message.roomId
      const body = normalizeMessageBody(message.message.body)

      if (chatStore.checkMsgExist(roomId, message.message.id)) {
        chatStore.updateMsg({
          msgId: message.message.id,
          roomId,
          status: MessageStatusEnum.SUCCESS,
          body
        })
      } else {
        chatStore.pushMsg(message)
      }

      rooms.value.set(roomId, matrixRoomCreationService.convertRoomToRoomInfo(room))
      triggerRef(rooms)
    })

    matrixRoomRealtimeService.onRoomNameChange((roomId, name) => {
      updateRoom(roomId, { name })
    })

    matrixRoomRealtimeService.onRoomAvatarChange((roomId, avatarUrl) => {
      updateRoom(roomId, { avatarUrl })
    })

    matrixRoomRealtimeService.onRoomMemberChange((roomId, roomInfo) => {
      rooms.value.set(roomId, roomInfo)
      triggerRef(rooms)
    })

    matrixSlidingSyncService.registerCallbacks({
      onUnreadCountsUpdate: (updates: SlidingSyncUnreadUpdate[]) => {
        const sessionStore = useSessionStore()
        for (const update of updates) {
          const roomInfo = rooms.value.get(update.roomId)
          if (roomInfo) {
            roomInfo.unreadCount = update.unreadCount
            roomInfo.highlightCount = update.highlightCount
            roomInfo.notificationCount = update.notificationCount
            rooms.value.set(update.roomId, roomInfo)
          }
          sessionStore.updateSession(update.roomId, { unreadCount: update.unreadCount })
          sessionStore.writeUnreadDetail(update.roomId, {
            total: update.notificationCount ?? update.unreadCount,
            highlight: update.highlightCount ?? 0,
            silent: sessionStore.getUnreadDetail(update.roomId)?.silent ?? false
          })
        }
      },
      onRoomUpdate: (roomId: string) => {
        updateRoom(roomId, {})
        const roomInfo = rooms.value.get(roomId)
        if (roomInfo) {
          const sessionStore = useSessionStore()
          sessionStore.updateSession(roomId, {
            name: roomInfo.name,
            avatar: roomInfo.avatarUrl ?? undefined,
            unreadCount: roomInfo.unreadCount
          })
        }
        scheduleTagsRefresh(roomId)
      },
      onRoomListRefresh: () => {
        // 防抖：300ms 内只执行一次 loadRooms 和 (如果房间列表有变化则) batchRefreshTags，避免 SlidingSync 高频触发
        if (loadRoomsDebounce) {
          clearTimeout(loadRoomsDebounce)
        }
        loadRoomsDebounce = setTimeout(async () => {
          // 添加 async
          loadRoomsDebounce = null
          const roomsChanged = await loadRooms() // 等待 loadRooms 返回结果
          if (roomsChanged) {
            // 只有房间列表发生变化才刷新标签
            batchRefreshTags().catch(() => {
              // 标签批量刷新失败不输出日志，避免刷屏
            })
          }
        }, 300)
      }
    })

    listenersInitialized = true

    try {
      await matrixSlidingSyncService.initialize()
    } catch (err) {
      logger.error(`[RoomStore] Sliding Sync 服务初始化失败: ${err}`)
    }
  }

  return {
    handleIncrementalUpdate,
    setupEventListeners
  }
}
