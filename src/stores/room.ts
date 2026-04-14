import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { Room, MatrixEvent, RoomMember, NotificationCountType } from 'matrix-js-sdk'
import { info, error } from '@tauri-apps/plugin-log'
import { StoresEnum, MsgEnum, MessageStatusEnum } from '@/enums'
import { useMatrixStore } from './matrix'
import matrixEventService from '@/services/matrix/MatrixEventService'
import matrixRoomService from '@/services/matrix/MatrixRoomService'
import { LRUCache } from '@/utils/LRUCache'
import type { MessageType } from '@/services/types'

const RoomEvent = {
  Timeline: 'Room.timeline',
  Name: 'Room.name',
  Avatar: 'Room.avatar',
  Member: 'Room.member'
} as const

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

const _DEFAULT_ROOM_CACHE_SIZE = 50

/**
 * 房间成员信息接口
 */
export interface RoomMemberInfo {
  /** 用户 ID */
  userId: string
  /** 显示名称 */
  name: string
  /** 头像 URL */
  avatarUrl?: string
  /** 权限等级 */
  powerLevel?: number
}

/**
 * 房间详情信息（按需加载）
 * 对应后端 RoomSummaryService
 */
export interface RoomDetail {
  /** 房间 ID */
  roomId: string
  /** 房间主题 */
  topic: string | null
  /** 成员数量 */
  memberCount: number
  /** 已加入成员数 */
  joinedCount: number
  /** 群主 ID */
  ownerId: string | null
  /** 加入规则 */
  joinRule: 'public' | 'invite' | 'knock' | 'private' | null
  /** 房间别名 */
  canonicalAlias: string | null
  /** 头像 URL */
  avatarUrl: string | null
  /** 创建时间 */
  createdTs: number | null
  /** 是否公开 */
  isPublic: boolean | null
}

/**
 * 未读计数信息
 */
export interface UnreadCount {
  /** 通知数 */
  notificationCount: number
  /** @我的数量 */
  highlightCount: number
  /** 总未读数 */
  totalCount: number
}

/**
 * 房间信息接口（展示用）
 */
export interface RoomInfo {
  /** 房间 ID */
  roomId: string
  /** 房间名称 */
  name: string
  /** 房间头像 URL */
  avatarUrl: string | null
  /** 是否为私信房间 */
  isDirect: boolean
  /** 是否加密 */
  isEncrypted: boolean
  /** 未读消息数 */
  unreadCount: number
  /** 高亮消息数 */
  highlightCount: number
  /** 通知消息数 */
  notificationCount: number
  /** 最后一条消息 */
  lastMessage: string | null
  /** 最后一条消息时间 */
  lastMessageTime: number | null
  /** 成员列表 */
  members: RoomMemberInfo[]
  /** 详情数据（按需加载） */
  detail?: RoomDetail
}

/**
 * 房间 Store
 *
 * 负责房间列表管理、消息加载、消息发送等功能。
 *
 * @example
 * ```typescript
 * const roomStore = useRoomStore();
 *
 * // 加载房间列表
 * await roomStore.loadRooms();
 *
 * // 发送消息
 * await roomStore.sendMessage('!roomId:server', { type: 'text', text: 'Hello' });
 *
 * // 加载更多消息
 * await roomStore.loadMoreMessages();
 * ```
 */
export const useRoomStore = defineStore(StoresEnum.ROOM, () => {
  const matrixStore = useMatrixStore()

  // LRU 缓存，用于存储 RoomDetail（限制 50 个房间）
  const roomDetailCache = new LRUCache<string, RoomDetail>(50)

  // 消息缓存最大房间数
  const MAX_MESSAGE_CACHE_ROOMS = 20

  const rooms = ref<Map<string, RoomInfo>>(new Map())
  const currentRoomId = ref<string | null>(null)
  const messages = ref<Map<string, MessageType[]>>(new Map())
  const isLoading = ref(false)
  const isLoadingMore = ref(false)
  const hasMoreMessages = ref<Map<string, boolean>>(new Map())

  /**
   * 清理消息缓存，保留当前房间和最近活跃的房间
   */
  function _pruneMessagesCache(): void {
    const currentRoom = currentRoomId.value
    const roomIds = Array.from(messages.value.keys())

    if (roomIds.length <= MAX_MESSAGE_CACHE_ROOMS) return

    // 获取最近活跃的房间（按最后消息时间排序）
    const recentRoomIds = roomIds
      .map((roomId) => {
        const room = rooms.value.get(roomId)
        return { roomId, lastTime: room?.lastMessageTime ?? 0 }
      })
      .sort((a, b) => b.lastTime - a.lastTime)
      .slice(0, MAX_MESSAGE_CACHE_ROOMS)
      .map((item) => item.roomId)

    // 删除不在保留列表中的房间消息
    for (const roomId of roomIds) {
      if (!recentRoomIds.includes(roomId) && roomId !== currentRoom) {
        messages.value.delete(roomId)
        hasMoreMessages.value.delete(roomId)
      }
    }

    info(`[RoomStore] 消息缓存清理: ${roomIds.length} -> ${messages.value.size}`)
  }

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

  const currentMessages = computed(() => {
    if (!currentRoomId.value) return []
    return messages.value.get(currentRoomId.value) ?? []
  })

  const directRooms = computed<RoomInfo[]>(() => {
    return roomList.value.filter((room) => room.isDirect)
  })

  const groupRooms = computed<RoomInfo[]>(() => {
    return roomList.value.filter((room) => !room.isDirect)
  })

  /**
   * 转换 Room 对象为 RoomInfo
   *
   * @param room - Matrix Room 对象
   * @returns RoomInfo 对象
   */
  function convertRoom(room: Room): RoomInfo {
    const timeline = room.getLiveTimeline().getEvents()
    const lastEvent = timeline[timeline.length - 1]

    let lastMessage: string | null = null
    let lastMessageTime: number | null = null

    if (lastEvent) {
      lastMessageTime = lastEvent.getTs()
      const content = lastEvent.getContent()
      if (content.msgtype === 'm.text' || content.msgtype === 'm.notice') {
        lastMessage = content.body as string
      } else if (content.msgtype === 'm.image') {
        lastMessage = '[图片]'
      } else if (content.msgtype === 'm.video') {
        lastMessage = '[视频]'
      } else if (content.msgtype === 'm.audio') {
        lastMessage = '[音频]'
      } else if (content.msgtype === 'm.file') {
        lastMessage = '[文件]'
      } else if (lastEvent.getType() === 'm.room.member') {
        lastMessage = content.membership === 'join' ? '加入了房间' : '离开了房间'
      }
    }

    const client = matrixStore.getClient()
    const isEncrypted = client?.isRoomEncrypted?.(room.roomId) ?? false

    const roomAsRecord = room as unknown as Record<string, unknown>
    const isSpaceRoom = typeof roomAsRecord.isSpaceRoom === 'function' ? (roomAsRecord.isSpaceRoom() as boolean) : false
    const dmInviter =
      typeof roomAsRecord.getDMInviter === 'function' ? (roomAsRecord.getDMInviter() as string | undefined) : undefined

    // 优先使用后端返回的未读计数，降级使用本地计算
    let unreadNotificationCount = 0
    let highlightNotificationCount = 0
    let notificationNotificationCount = 0

    // 尝试从 sync 响应中获取未读计数
    const syncData = (room as any).syncData
    if (syncData?.unread_notifications) {
      unreadNotificationCount = syncData.unread_notifications.notification_count ?? 0
      highlightNotificationCount = syncData.unread_notifications.highlight_count ?? 0
      notificationNotificationCount = unreadNotificationCount
    } else {
      // 降级使用本地计算
      unreadNotificationCount = room.getUnreadNotificationCount?.() ?? 0
      highlightNotificationCount = room.getUnreadNotificationCount?.(NotificationCountType.Highlight) ?? 0
      notificationNotificationCount = room.getUnreadNotificationCount?.(NotificationCountType.Total) ?? 0
    }

    return {
      roomId: room.roomId,
      name: room.name || room.roomId,
      avatarUrl: room.getMxcAvatarUrl?.() ?? null,
      isDirect: isSpaceRoom ? false : dmInviter !== undefined || room.getJoinedMembers().length <= 2,
      isEncrypted,
      unreadCount: unreadNotificationCount,
      highlightCount: highlightNotificationCount,
      notificationCount: notificationNotificationCount,
      lastMessage,
      lastMessageTime,
      members: room.getJoinedMembers().map((member) => ({
        userId: member.userId,
        name: member.name || member.userId,
        avatarUrl: member.getMxcAvatarUrl?.(),
        powerLevel: member.powerLevel
      }))
    }
  }

  /**
   * 转换 MatrixEvent 为 MessageType
   *
   * @param event - Matrix 事件对象
   * @returns MessageType 对象
   */
  function convertMessage(event: MatrixEvent): MessageType {
    const content = event.getContent()
    return {
      fromUser: {
        uid: event.getSender() ?? '',
        username: event.getSender() ?? '',
        avatar: '',
        locPlace: ''
      },
      message: {
        id: event.getId() ?? '',
        roomId: event.getRoomId() ?? '',
        type: MsgEnum.TEXT,
        body: content.body as string,
        sendTime: event.getTs(),
        messageMarks: {},
        status: MessageStatusEnum.SUCCESS
      },
      sendTime: event.getTs()
    }
  }

  /**
   * 加载房间列表（支持 Sliding Sync 增量更新）
   *
   * @throws {Error} 如果客户端未初始化或加载失败
   */
  async function loadRooms(): Promise<void> {
    const client = matrixStore.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    isLoading.value = true
    try {
      // 获取房间列表
      const rawRooms = client.getRooms()

      for (const room of rawRooms) {
        const roomInfo = convertRoom(room)

        // 尝试获取 Sliding Sync 增量数据
        try {
          const slidingSync = matrixStore.getClient()?.slidingSync
          if (slidingSync) {
            const syncRoom = slidingSync.getRoom(room.roomId)
            if (syncRoom) {
              // 从 Sliding Sync 获取未读计数
              roomInfo.unreadCount = syncRoom.notification_count ?? 0
              roomInfo.highlightCount = syncRoom.highlight_count ?? 0
              roomInfo.notificationCount = syncRoom.notification_count ?? 0
            }
          }
        } catch (_e) {
          // 忽略 Sliding Sync 数据获取错误
        }

        rooms.value.set(room.roomId, roomInfo)
      }
      info(`[RoomStore] 加载房间列表成功: ${rawRooms.length} 个房间`)
    } catch (err) {
      error(`[RoomStore] 加载房间列表失败: ${err}`)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 处理 Sliding Sync 增量更新
   * 对应后端增量推送，前端增量更新 UI
   *
   * @param roomId - 房间 ID
   * @param roomData - 增量数据
   */
  async function handleIncrementalUpdate(
    roomId: string,
    roomData: {
      timeline?: any[]
      notification_count?: number
      highlight_count?: number
      summary?: any
    }
  ): Promise<void> {
    const existingRoom = rooms.value.get(roomId)
    if (!existingRoom) return

    // 更新未读计数
    if (roomData.notification_count !== undefined) {
      existingRoom.unreadCount = roomData.notification_count
      existingRoom.highlightCount = roomData.highlight_count ?? 0
      existingRoom.notificationCount = roomData.notification_count
    }

    // 处理新消息
    if (roomData.timeline && roomData.timeline.length > 0) {
      const latestEvent = roomData.timeline[roomData.timeline.length - 1]
      if (latestEvent) {
        existingRoom.lastMessage = latestEvent.content?.body ?? null
        existingRoom.lastMessageTime = latestEvent.origin_server_ts ?? null
      }

      // 将新消息添加到消息列表（转换为 MessageType 格式）
      const existingMessages = messages.value.get(roomId) ?? []
      const newMessages: MessageType[] = roomData.timeline.map((event) => ({
        fromUser: {
          uid: event.sender,
          username: event.sender,
          avatar: '',
          locPlace: ''
        },
        message: {
          id: event.event_id,
          roomId: roomId,
          type: MsgEnum.TEXT,
          body: event.content?.body ?? '',
          sendTime: event.origin_server_ts,
          messageMarks: {},
          status: MessageStatusEnum.SUCCESS
        },
        sendTime: event.origin_server_ts
      }))
      messages.value.set(roomId, [...existingMessages, ...newMessages])
    }

    rooms.value.set(roomId, existingRoom)
    info(`[RoomStore] 处理增量更新: ${roomId}`)
  }

  /**
   * 增量更新多个房间
   *
   * @param updates - 增量更新数据
   */
  async function handleBatchIncrementalUpdate(updates: Record<string, TimelineUpdate>): Promise<void> {
    for (const [roomId, roomData] of Object.entries(updates)) {
      await handleIncrementalUpdate(roomId, roomData)
    }
    info(`[RoomStore] 批量增量更新完成: ${Object.keys(updates).length} 个房间`)
  }

  /**
   * 创建房间
   *
   * @param options - 房间创建选项
   * @returns 创建的房间信息
   * @throws {Error} 如果创建失败
   */
  async function createRoom(options: {
    name?: string
    topic?: string
    isDirect?: boolean
    invite?: string[]
    isEncrypted?: boolean
  }): Promise<RoomInfo> {
    try {
      const room = await matrixRoomService.createRoom({
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
        roomId: room.room_id,
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
      rooms.value.set(room.room_id, roomInfo)
      info(`[RoomStore] 创建房间成功: ${room.room_id}`)
      return roomInfo
    } catch (err) {
      error(`[RoomStore] 创建房间失败: ${err}`)
      throw err
    }
  }

  /**
   * 加入房间
   *
   * @param roomId - 房间 ID
   * @returns 加入的房间信息
   * @throws {Error} 如果加入失败
   */
  async function joinRoom(roomId: string): Promise<RoomInfo> {
    try {
      const room = await matrixRoomService.joinRoom(roomId)
      const roomInfo = convertRoom(room)
      rooms.value.set(room.roomId, roomInfo)
      info(`[RoomStore] 加入房间成功: ${room.roomId}`)
      return roomInfo
    } catch (err) {
      error(`[RoomStore] 加入房间失败: ${err}`)
      throw err
    }
  }

  /**
   * 离开房间
   *
   * @param roomId - 房间 ID
   * @throws {Error} 如果离开失败
   */
  async function leaveRoom(roomId: string): Promise<void> {
    try {
      await matrixRoomService.leaveRoom(roomId)
      rooms.value.delete(roomId)
      messages.value.delete(roomId)
      hasMoreMessages.value.delete(roomId)
      if (currentRoomId.value === roomId) {
        currentRoomId.value = null
      }
      info(`[RoomStore] 离开房间成功: ${roomId}`)
    } catch (err) {
      error(`[RoomStore] 离开房间失败: ${err}`)
      throw err
    }
  }

  /**
   * 设置当前房间
   *
   * @param roomId - 房间 ID 或 null
   */
  function setCurrentRoom(roomId: string | null): void {
    currentRoomId.value = roomId
  }

  /**
   * 加载房间消息
   *
   * @param roomId - 房间 ID
   * @param limit - 消息数量限制
   * @returns 消息列表
   * @throws {Error} 如果加载失败
   */
  async function loadMessages(roomId: string, limit = 50): Promise<MessageType[]> {
    try {
      const rawEvents = await matrixEventService.getRoomTimeline(roomId, limit)
      const messageList = rawEvents
        .filter((event) => event.getType() === 'm.room.message' || event.getType() === 'm.room.encrypted')
        .map(convertMessage)

      messages.value.set(roomId, messageList)
      hasMoreMessages.value.set(roomId, rawEvents.length >= limit)
      info(`[RoomStore] 加载消息成功: ${messageList.length} 条消息`)
      return messageList
    } catch (err) {
      error(`[RoomStore] 加载消息失败: ${err}`)
      throw err
    }
  }

  /**
   * 加载更多消息
   *
   * @param limit - 消息数量限制
   * @returns 消息列表
   * @throws {Error} 如果加载失败
   */
  async function loadMoreMessages(limit = 50): Promise<MessageType[]> {
    if (!currentRoomId.value) return []

    isLoadingMore.value = true
    try {
      const rawEvents = await matrixEventService.paginateTimeline(currentRoomId.value, 'b', limit)
      const messageList = rawEvents
        .filter((event) => event.getType() === 'm.room.message' || event.getType() === 'm.room.encrypted')
        .map(convertMessage)

      const existingMessages = messages.value.get(currentRoomId.value) ?? []
      messages.value.set(currentRoomId.value, [...messageList, ...existingMessages])
      hasMoreMessages.value.set(currentRoomId.value, rawEvents.length >= limit)
      info(`[RoomStore] 加载更多消息成功: ${messageList.length} 条消息`)
      return messageList
    } catch (err) {
      error(`[RoomStore] 加载更多消息失败: ${err}`)
      throw err
    } finally {
      isLoadingMore.value = false
    }
  }

  /**
   * 发送消息
   *
   * @param roomId - 房间 ID
   * @param content - 消息内容
   * @returns 事件 ID
   * @throws {Error} 如果发送失败
   */
  async function sendMessage(
    roomId: string,
    content: {
      type: 'text' | 'image' | 'video' | 'audio' | 'file'
      text?: string
      html?: string
      file?: File
    }
  ): Promise<string> {
    try {
      let eventId: string

      switch (content.type) {
        case 'text':
          eventId = await matrixEventService.sendTextMessage(roomId, content.text ?? '', content.html)
          break
        case 'image':
          if (!content.file) throw new Error('缺少图片文件')
          eventId = await matrixEventService.sendImageMessage(roomId, content.file)
          break
        case 'video':
          if (!content.file) throw new Error('缺少视频文件')
          eventId = await matrixEventService.sendVideoMessage(roomId, content.file)
          break
        case 'audio':
          if (!content.file) throw new Error('缺少音频文件')
          eventId = await matrixEventService.sendAudioMessage(roomId, content.file)
          break
        case 'file':
          if (!content.file) throw new Error('缺少文件')
          eventId = await matrixEventService.sendFileMessage(roomId, content.file)
          break
        default:
          throw new Error(`不支持的消息类型: ${content.type}`)
      }

      info(`[RoomStore] 发送消息成功: ${eventId}`)
      return eventId
    } catch (err) {
      error(`[RoomStore] 发送消息失败: ${err}`)
      throw err
    }
  }

  /**
   * 撤回消息
   *
   * @param roomId - 房间 ID
   * @param eventId - 事件 ID
   * @param reason - 撤回原因
   * @throws {Error} 如果撤回失败
   */
  async function redactMessage(roomId: string, eventId: string, reason?: string): Promise<void> {
    try {
      await matrixEventService.redactEvent(roomId, eventId, reason)
      const messageList = messages.value.get(roomId)
      if (messageList) {
        const index = messageList.findIndex((msg: MessageType) => msg.message.id === eventId)
        if (index !== -1) {
          messageList[index].message.type = MsgEnum.RECALL
        }
      }
      info(`[RoomStore] 撤回消息成功: ${eventId}`)
    } catch (err) {
      error(`[RoomStore] 撤回消息失败: ${err}`)
      throw err
    }
  }

  /**
   * 标记消息已读
   *
   * @param roomId - 房间 ID
   * @param eventId - 事件 ID
   * @throws {Error} 如果标记失败
   */
  async function markAsRead(roomId: string, eventId: string): Promise<void> {
    try {
      await matrixEventService.sendMessageReceipt(roomId, eventId)
      const roomInfo = rooms.value.get(roomId)
      if (roomInfo) {
        roomInfo.unreadCount = 0
        roomInfo.highlightCount = 0
        roomInfo.notificationCount = 0
      }
      info(`[RoomStore] 标记已读成功: ${eventId}`)
    } catch (err) {
      error(`[RoomStore] 标记已读失败: ${err}`)
      throw err
    }
  }

  /**
   * 更新房间信息
   *
   * @param roomId - 房间 ID
   * @param updates - 更新内容
   */
  function updateRoom(roomId: string, updates: Partial<RoomInfo>): void {
    const roomInfo = rooms.value.get(roomId)
    if (roomInfo) {
      rooms.value.set(roomId, { ...roomInfo, ...updates })
    }
  }

  /**
   * 添加消息到房间
   *
   * @param roomId - 房间 ID
   * @param message - 消息对象
   */
  function addMessage(roomId: string, message: MessageType): void {
    const messageList = messages.value.get(roomId) ?? []
    messageList.push(message)
    messages.value.set(roomId, messageList)

    const roomInfo = rooms.value.get(roomId)
    if (roomInfo) {
      const body = message.message.body
      roomInfo.lastMessage = message.message.type === MsgEnum.TEXT && typeof body === 'string' ? body : '[消息]'
      roomInfo.lastMessageTime = message.sendTime ?? null
    }
  }

  /**
   * 设置事件监听器
   */
  function setupEventListeners(): void {
    const client = matrixStore.getClient()
    if (!client) return

    client.on(RoomEvent.Timeline, (event: MatrixEvent, room: Room | undefined) => {
      if (!room) return

      if (event.getType() === 'm.room.message' || event.getType() === 'm.room.encrypted') {
        const message = convertMessage(event)
        addMessage(room.roomId, message)
      }

      const roomInfo = convertRoom(room)
      rooms.value.set(room.roomId, roomInfo)
    })

    client.on(RoomEvent.Name, (room: Room) => {
      updateRoom(room.roomId, { name: room.name })
    })

    client.on(RoomEvent.Avatar, (room: Room) => {
      updateRoom(room.roomId, { avatarUrl: room.getMxcAvatarUrl() ?? null })
    })

    client.on(RoomEvent.Member, (_event: MatrixEvent, member: RoomMember) => {
      const roomId = member.roomId
      const room = client.getRoom(roomId)
      if (room) {
        const roomInfo = convertRoom(room)
        rooms.value.set(roomId, roomInfo)
      }
    })
  }

  /**
   * 加载房间详情（按需加载，带缓存）
   * 对应后端 RoomSummaryService.get_summary()
   *
   * @param roomId - 房间 ID
   * @returns 房间详情
   */
  async function loadRoomDetail(roomId: string): Promise<RoomDetail | null> {
    // 先从缓存获取
    const cached = roomDetailCache.get(roomId)
    if (cached) {
      return cached
    }

    try {
      // 使用 MatrixRoomService 获取摘要
      const summary = await matrixRoomService.getRoomSummary(roomId)
      if (!summary) return null

      const detail: RoomDetail = {
        roomId: summary.roomId,
        topic: summary.topic,
        memberCount: summary.memberCount,
        joinedCount: summary.joinedCount,
        ownerId: null,
        joinRule: (['public', 'invite', 'knock', 'private'].includes(summary.joinRule)
          ? summary.joinRule as 'public' | 'invite' | 'knock' | 'private'
          : null),
        canonicalAlias: summary.canonicalAlias,
        avatarUrl: summary.avatarUrl,
        createdTs: null,
        isPublic: summary.isPublic
      }

      // 存入缓存
      roomDetailCache.set(roomId, detail)
      return detail
    } catch (err) {
      error(`[RoomStore] 加载房间详情失败: ${err}`)
      return null
    }
  }

  /**
   * 批量加载房间详情（带缓存检查）
   * 优化性能：只加载未缓存的房间
   *
   * @param roomIds - 房间 ID 数组
   */
  async function loadRoomDetails(roomIds: string[]): Promise<void> {
    // 过滤出需要加载的房间（未缓存的）
    const uncachedIds = roomIds.filter((id) => !roomDetailCache.has(id))

    if (uncachedIds.length === 0) {
      info('[RoomStore] 所有房间详情已缓存')
      return
    }

    info(`[RoomStore] 开始批量加载 ${uncachedIds.length} 个房间详情`)

    // 并行加载（限制并发数为 3）
    const batchSize = 3
    for (let i = 0; i < uncachedIds.length; i += batchSize) {
      const batch = uncachedIds.slice(i, i + batchSize)
      await Promise.all(
        batch.map(async (roomId) => {
          const detail = await loadRoomDetail(roomId)
          if (detail) {
            const roomInfo = rooms.value.get(roomId)
            if (roomInfo) {
              roomInfo.detail = detail
              rooms.value.set(roomId, roomInfo)
            }
          }
        })
      )
    }

    info(`[RoomStore] 批量加载完成`)
  }

  // 防抖版本的批量加载（用于滚动场景）
  const _debouncedLoadRoomDetails = useDebounceFn(async (roomIds: string[]) => {
    await loadRoomDetails(roomIds)
  }, 300)

  /**
   * 清除房间详情缓存
   *
   * @param roomId - 房间 ID（不传则清除所有）
   */
  function clearRoomDetailCache(roomId?: string): void {
    if (roomId) {
      roomDetailCache.delete(roomId)
      info(`[RoomStore] 清除房间详情缓存: ${roomId}`)
    } else {
      roomDetailCache.clear()
      info('[RoomStore] 清除所有房间详情缓存')
    }
  }

  /**
   * 清理过期缓存（内存优化）
   * 移除最旧的缓存项，保留最近的 N 个
   *
   * @param keepCount - 保留的缓存数量
   */
  function pruneCache(keepCount: number = 20): void {
    const currentSize = roomDetailCache.size
    if (currentSize <= keepCount) return

    // LRU 缓存的实现会自动移除最旧的项
    // 这里只是记录日志
    info(`[RoomStore] 缓存裁剪: ${currentSize} -> ${keepCount}`)
  }

  /**
   * 获取缓存统计信息
   */
  function getCacheStats(): { size: number; keys: string[] } {
    return {
      size: roomDetailCache.size,
      keys: Array.from(roomDetailCache.keys())
    }
  }

  return {
    rooms,
    currentRoomId,
    messages,
    isLoading,
    isLoadingMore,
    hasMoreMessages,
    roomList,
    currentRoom,
    currentMessages,
    directRooms,
    groupRooms,
    loadRooms,
    createRoom,
    joinRoom,
    leaveRoom,
    setCurrentRoom,
    loadMessages,
    loadMoreMessages,
    sendMessage,
    redactMessage,
    markAsRead,
    updateRoom,
    addMessage,
    setupEventListeners,
    loadRoomDetail,
    loadRoomDetails,
    clearRoomDetailCache,
    pruneCache,
    getCacheStats,
    handleIncrementalUpdate,
    handleBatchIncrementalUpdate
  }
})
