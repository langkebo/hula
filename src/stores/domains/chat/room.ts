import { defineStore } from 'pinia'
import { computed, ref, shallowRef, triggerRef } from 'vue'
import { MessageStatusEnum, MsgEnum, StoresEnum } from '@/enums'
import matrixClientService from '@/services/matrix/MatrixClientService'
import matrixEventService from '@/services/matrix/MatrixEventService'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'
import { matrixRoomCreationService } from '@/services/matrix/room/CreationService'
import { matrixRoomReadFacade } from '@/services/matrix/room/ReadFacade'
import { matrixRoomRealtimeService } from '@/services/matrix/room/RealtimeService'
import { matrixRoomTagsService } from '@/services/matrix/room/TagsService'
import matrixSlidingSyncService, { type SlidingSyncUnreadUpdate } from '@/services/matrix/sync/MatrixSlidingSyncService'
import type { RoomDetail, RoomInfo } from '@/services/types'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useSessionStore } from '@/stores/domains/chat/chat/session'
import type { MessageType } from '@/stores/domains/chat/chat/types'
import { createLogger } from '@/utils/Logger'
import { LRUCache } from '@/utils/LRUCache'

const logger = createLogger('RoomStore')

type TimelineEvent = {
  event_id: string
  type: string
  sender: string
  content: {
    body?: string
    msgtype?: string
    [key: string]: unknown
  }
  origin_server_ts: number
}

type TimelineUpdate = {
  timeline?: TimelineEvent[]
  notification_count?: number
  highlight_count?: number
  summary?: {
    name?: string
    avatar_url?: string
    joined_member_count?: number
  }
}

export const useRoomStore = defineStore(StoresEnum.ROOM, () => {
  const roomDetailCache = new LRUCache<string, RoomDetail>(50)
  const roomDetailPending = new Map<string, Promise<RoomDetail | null>>()

  const rooms = shallowRef<Map<string, RoomInfo>>(new Map())
  const currentRoomId = ref<string | null>(null)
  const isLoading = ref(false)
  const tagsByRoom = shallowRef<Record<string, Record<string, { order?: number }>>>({})
  let listenersInitialized = false

  const roomList = computed<RoomInfo[]>(() => {
    return Array.from(rooms.value.values()).sort((a, b) => {
      const timeA = a.lastMessageTime || 0
      const timeB = b.lastMessageTime || 0
      return timeB - timeA
    })
  })

  const currentRoom = computed(() => {
    if (!currentRoomId.value) return null
    return rooms.value.get(currentRoomId.value) ?? null
  })

  const directRooms = computed<RoomInfo[]>(() => {
    return roomList.value.filter((room) => room.isDirect)
  })

  const groupRooms = computed<RoomInfo[]>(() => {
    return roomList.value.filter((room) => !room.isDirect)
  })

  async function loadRooms(): Promise<boolean> {
    // 返回 boolean
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    isLoading.value = true
    let roomsChanged = false // 新增标志位
    try {
      const newRoomInfos = matrixRoomRealtimeService.getAllRoomInfos()
      // 比较新旧房间列表，判断是否有变化
      if (
        newRoomInfos.length !== rooms.value.size ||
        !Array.from(newRoomInfos.values()).every((newRoom) => rooms.value.has(newRoom.roomId))
      ) {
        roomsChanged = true
        rooms.value = new Map(newRoomInfos.map((room) => [room.roomId, room])) // 直接替换整个 Map
        triggerRef(rooms)
      }
      // 加载房间列表成功不输出日志，避免 SlidingSync 高频触发时刷屏
      return roomsChanged // 返回是否发生变化
    } catch (err) {
      logger.error(`[RoomStore] 加载房间列表失败: ${err}`)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  interface TimelineEvent {
    type?: string
    content?: Record<string, unknown>
    origin_server_ts?: number | null
    sender?: string
    event_id?: string
  }

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
      for (const event of roomData.timeline) {
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

  async function handleBatchIncrementalUpdate(updates: Record<string, TimelineUpdate>): Promise<void> {
    for (const [roomId, roomData] of Object.entries(updates)) {
      await handleIncrementalUpdate(roomId, roomData)
    }
    logger.info(`[RoomStore] 批量增量更新完成: ${Object.keys(updates).length} 个房间`)
  }

  async function createRoom(options: {
    name?: string
    topic?: string
    isDirect?: boolean
    invite?: string[]
    isEncrypted?: boolean
  }): Promise<RoomInfo> {
    try {
      const room = await matrixRoomActionFacade.createRoom({
        name: options.name,
        topic: options.topic,
        invite: options.invite,
        is_direct: options.isDirect,
        initial_state: options.isEncrypted
          ? [
              {
                type: 'm.room.encryption',
                state_key: '',
                content: {
                  algorithm: 'm.megolm.v1.aes-sha2'
                }
              }
            ]
          : undefined
      })

      const roomInfo: RoomInfo = {
        roomId: room.roomId,
        name: options.name || '',
        avatarUrl: null,
        isDirect: options.isDirect || false,
        isEncrypted: options.isEncrypted || false,
        unreadCount: 0,
        notificationCount: 0,
        highlightCount: 0,
        lastMessage: null,
        lastMessageTime: null,
        members: []
      }
      rooms.value.set(room.roomId, roomInfo)
      triggerRef(rooms)
      logger.info(`[RoomStore] 创建房间成功: ${room.roomId}`)
      return roomInfo
    } catch (err) {
      logger.error(`[RoomStore] 创建房间失败: ${err}`)
      throw err
    }
  }

  async function joinRoom(roomId: string): Promise<RoomInfo> {
    try {
      const roomInfo = await matrixRoomCreationService.joinRoomAndGetInfo(roomId)
      rooms.value.set(roomInfo.roomId, roomInfo)
      triggerRef(rooms)
      logger.info(`[RoomStore] 加入房间成功: ${roomInfo.roomId}`)
      return roomInfo
    } catch (err) {
      logger.error(`[RoomStore] 加入房间失败: ${err}`)
      throw err
    }
  }

  async function leaveRoom(roomId: string): Promise<void> {
    try {
      await matrixRoomActionFacade.leaveRoom(roomId)
      rooms.value.delete(roomId)
      triggerRef(rooms)
      useChatStore().clearRoomMessages(roomId)
      if (currentRoomId.value === roomId) {
        currentRoomId.value = null
      }
      logger.info(`[RoomStore] 离开房间成功: ${roomId}`)
    } catch (err) {
      logger.error(`[RoomStore] 离开房间失败: ${err}`)
      throw err
    }
  }

  function setCurrentRoom(roomId: string | null): void {
    currentRoomId.value = roomId
  }

  function updateRoom(roomId: string, updates: Partial<RoomInfo>): void {
    const roomInfo = rooms.value.get(roomId)
    if (roomInfo) {
      rooms.value.set(roomId, { ...roomInfo, ...updates })
      triggerRef(rooms)
    }
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

  async function loadRoomDetail(roomId: string): Promise<RoomDetail | null> {
    const cached = roomDetailCache.get(roomId)
    if (cached) {
      return cached
    }

    const pending = roomDetailPending.get(roomId)
    if (pending) {
      return pending
    }

    const promise = (async () => {
      try {
        const summary = await matrixRoomReadFacade.getRoomSummary(roomId)
        if (!summary) return null

        const detail: RoomDetail = {
          roomId: summary.roomId,
          topic: summary.topic,
          memberCount: summary.memberCount,
          joinedCount: summary.joinedCount,
          ownerId: null,
          joinRule:
            summary.joinRule && ['public', 'invite', 'knock', 'private'].includes(summary.joinRule)
              ? (summary.joinRule as 'public' | 'invite' | 'knock' | 'private')
              : null,
          canonicalAlias: summary.canonicalAlias,
          avatarUrl: summary.avatarUrl,
          createdTs: null,
          isPublic: summary.isPublic
        }

        roomDetailCache.set(roomId, detail)
        return detail
      } catch (err) {
        logger.error(`[RoomStore] 加载房间详情失败: ${roomId} ${err}`)
        return null
      } finally {
        roomDetailPending.delete(roomId)
      }
    })()

    roomDetailPending.set(roomId, promise)
    return promise
  }

  async function loadRoomDetails(roomIds: string[]): Promise<void> {
    const uncachedIds = roomIds.filter((id) => !roomDetailCache.has(id))

    if (uncachedIds.length === 0) {
      logger.info('[RoomStore] 所有房间详情已缓存')
      return
    }

    logger.info(`[RoomStore] 开始批量加载 ${uncachedIds.length} 个房间详情`)

    const batchSize = 3
    for (let i = 0; i < uncachedIds.length; i += batchSize) {
      const batch = uncachedIds.slice(i, i + batchSize)
      await Promise.allSettled(
        batch.map(async (roomId) => {
          const detail = await loadRoomDetail(roomId)
          if (detail) {
            const roomInfo = rooms.value.get(roomId)
            if (roomInfo) {
              roomInfo.detail = detail
              rooms.value.set(roomId, roomInfo)
              triggerRef(rooms)
            }
          }
        })
      )
    }

    logger.info(`[RoomStore] 批量加载完成`)
  }

  function clearRoomDetailCache(roomId?: string): void {
    if (roomId) {
      roomDetailCache.delete(roomId)
      logger.info(`[RoomStore] 清除房间详情缓存: ${roomId}`)
    } else {
      roomDetailCache.clear()
      logger.info('[RoomStore] 清除所有房间详情缓存')
    }
  }

  function resetState(): void {
    rooms.value = new Map()
    currentRoomId.value = null
    isLoading.value = false
    clearRoomDetailCache()
    triggerRef(rooms)
    logger.info('[RoomStore] 房间状态已重置')
  }

  function pruneCache(keepCount: number = 20): void {
    const currentSize = roomDetailCache.size
    if (currentSize <= keepCount) return

    logger.info(`[RoomStore] 缓存裁剪: ${currentSize} -> ${keepCount}`)
  }

  function getCacheStats(): { size: number; keys: string[] } {
    return {
      size: roomDetailCache.size,
      keys: Array.from(roomDetailCache.keys())
    }
  }

  function setTagsForRoom(roomId: string, tags: Record<string, { order?: number }>): void {
    if (!roomId) return
    const previous = tagsByRoom.value[roomId]
    const next = { ...tags }
    if (previous && JSON.stringify(previous) === JSON.stringify(next)) return
    tagsByRoom.value = { ...tagsByRoom.value, [roomId]: next }
  }

  function getTagsForRoom(roomId: string): Record<string, { order?: number }> {
    return tagsByRoom.value[roomId] ?? {}
  }

  function hasTag(roomId: string, tag: string): boolean {
    const tags = tagsByRoom.value[roomId]
    return !!tags && tag in tags
  }

  let loadRoomsDebounce: ReturnType<typeof setTimeout> | null = null
  let tagsRefreshDebounce: ReturnType<typeof setTimeout> | null = null
  const pendingTagsRefresh = new Set<string>()

  async function refreshRoomTags(roomId: string): Promise<Record<string, { order?: number }>> {
    if (!roomId) return {}
    const tags = await matrixRoomTagsService.getTags(roomId)
    setTagsForRoom(roomId, tags)
    const sessionStore = useSessionStore()
    const isTop = 'm.favourite' in tags
    sessionStore.updateSession(roomId, { top: isTop })
    return tags
  }

  function scheduleTagsRefresh(roomId: string): void {
    pendingTagsRefresh.add(roomId)
    if (tagsRefreshDebounce) {
      clearTimeout(tagsRefreshDebounce)
    }
    tagsRefreshDebounce = setTimeout(() => {
      const roomIds = Array.from(pendingTagsRefresh)
      pendingTagsRefresh.clear()
      tagsRefreshDebounce = null
      // 串行请求标签，避免并发触发 429
      ;(async () => {
        for (const id of roomIds) {
          try {
            await refreshRoomTags(id)
          } catch {
            // 标签获取失败不影响主流程
          }
          // 请求间隔 200ms，避免触发限流
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
      })()
    }, 1000)
  }

  async function batchRefreshTags(): Promise<void> {
    const roomIds = Array.from(rooms.value.keys())
    // 串行请求标签，避免并发触发 429
    for (const id of roomIds) {
      try {
        await refreshRoomTags(id)
      } catch {
        // 标签获取失败不影响主流程
      }
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  async function addRoomTag(roomId: string, tag: string, order?: number): Promise<void> {
    if (!roomId || !tag) return
    const previous = getTagsForRoom(roomId)
    setTagsForRoom(roomId, { ...previous, [tag]: order !== undefined ? { order } : {} })
    try {
      await matrixRoomTagsService.setTag(roomId, tag, order)
      if (tag === 'm.favourite') {
        const sessionStore = useSessionStore()
        sessionStore.updateSession(roomId, { top: true })
      }
    } catch (err) {
      setTagsForRoom(roomId, previous)
      logger.error(`[RoomStore] 写入标签失败, 已回滚: ${roomId}/${tag}`)
      throw err
    }
  }

  async function removeRoomTag(roomId: string, tag: string): Promise<void> {
    if (!roomId || !tag) return
    const previous = getTagsForRoom(roomId)
    if (!(tag in previous)) return
    const next = { ...previous }
    delete next[tag]
    setTagsForRoom(roomId, next)
    try {
      await matrixRoomTagsService.removeTag(roomId, tag)
      if (tag === 'm.favourite') {
        const sessionStore = useSessionStore()
        sessionStore.updateSession(roomId, { top: false })
      }
    } catch (err) {
      setTagsForRoom(roomId, previous)
      logger.error(`[RoomStore] 移除标签失败, 已回滚: ${roomId}/${tag}`)
      throw err
    }
  }

  return {
    rooms,
    currentRoomId,
    isLoading,
    tagsByRoom,
    roomList,
    currentRoom,
    directRooms,
    groupRooms,
    loadRooms,
    createRoom,
    joinRoom,
    leaveRoom,
    setCurrentRoom,
    updateRoom,
    setupEventListeners,
    loadRoomDetail,
    loadRoomDetails,
    resetState,
    clearRoomDetailCache,
    pruneCache,
    getCacheStats,
    handleIncrementalUpdate,
    handleBatchIncrementalUpdate,
    setTagsForRoom,
    getTagsForRoom,
    hasTag,
    refreshRoomTags,
    addRoomTag,
    removeRoomTag
  }
})
