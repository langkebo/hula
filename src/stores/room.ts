import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Room, MatrixEvent } from 'matrix-js-sdk'
import type { RoomMember } from 'matrix-js-sdk'
import { StoresEnum, MsgEnum } from '@/enums'
import { useMatrixStore } from '@/stores/matrix'
import { matrixRoomService, matrixEventService } from '@/services/matrix'
import { matrixMessageAdapter } from '@/services/matrix/MatrixMessageAdapter'
import type { MessageType } from '@/services/types'
import { info, error } from '@tauri-apps/plugin-log'

export interface RoomInfo {
  roomId: string
  name: string
  avatarUrl: string | null
  isDirect: boolean
  isEncrypted: boolean
  unreadCount: number
  highlightCount: number
  notificationCount: number
  lastMessage: string | null
  lastMessageTime: number | null
  members: any[]
}

export const useRoomStore = defineStore(StoresEnum.ROOM, () => {
  const matrixStore = useMatrixStore()

  const rooms = ref<Map<string, RoomInfo>>(new Map())
  const currentRoomId = ref<string | null>(null)
  const messages = ref<Map<string, MessageType[]>>(new Map())
  const isLoading = ref(false)
  const isLoadingMore = ref(false)
  const hasMoreMessages = ref<Map<string, boolean>>(new Map())

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

  function convertRoom(room: Room): RoomInfo {
    const timeline = room.getLiveTimeline().getEvents()
    const lastEvent = timeline[timeline.length - 1]

    let lastMessage: string | null = null
    let lastMessageTime: number | null = null

    if (lastEvent) {
      lastMessageTime = lastEvent.getTs()
      const content = lastEvent.getContent()
      if (content.msgtype === 'm.text' || content.msgtype === 'm.notice') {
        lastMessage = content.body
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

    const client = matrixStore.getClient() as any
    const isEncrypted = client?.isRoomEncrypted?.(room.roomId) ?? false
    const isSpaceRoom = (room as any).isSpaceRoom?.() ?? false
    const dmInviter = (room as any).getDMInviter?.()

    return {
      roomId: room.roomId,
      name: room.name || room.roomId,
      avatarUrl: room.getMxcAvatarUrl?.() ?? null,
      isDirect: isSpaceRoom ? false : (dmInviter !== null || room.getJoinedMembers().length <= 2),
      isEncrypted,
      unreadCount: room.getUnreadNotificationCount?.() ?? 0,
      highlightCount: room.getUnreadNotificationCount?.('highlight' as any) ?? 0,
      notificationCount: room.getUnreadNotificationCount?.('notification' as any) ?? 0,
      lastMessage,
      lastMessageTime,
      members: room.getJoinedMembers()
    }
  }

  function convertMessage(event: MatrixEvent): MessageType {
    return matrixMessageAdapter.convertMatrixEventToMessageType(event, event.getRoomId() ?? '')
  }

  async function loadRooms(): Promise<void> {
    const client = matrixStore.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    isLoading.value = true
    try {
      const rawRooms = client.getRooms()
      for (const room of rawRooms) {
        const roomInfo = convertRoom(room)
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

      const roomInfo = convertRoom(room)
      rooms.value.set(room.roomId, roomInfo)
      info(`[RoomStore] 创建房间成功: ${room.roomId}`)
      return roomInfo
    } catch (err) {
      error(`[RoomStore] 创建房间失败: ${err}`)
      throw err
    }
  }

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

  async function leaveRoom(roomId: string): Promise<void> {
    try {
      await matrixRoomService.leaveRoom(roomId)
      rooms.value.delete(roomId)
      messages.value.delete(roomId)
      if (currentRoomId.value === roomId) {
        currentRoomId.value = null
      }
      info(`[RoomStore] 离开房间成功: ${roomId}`)
    } catch (err) {
      error(`[RoomStore] 离开房间失败: ${err}`)
      throw err
    }
  }

  function setCurrentRoom(roomId: string | null): void {
    currentRoomId.value = roomId
    if (roomId && !messages.value.has(roomId)) {
      loadMessages(roomId)
    }
  }

  async function loadMessages(roomId: string, limit: number = 50): Promise<MessageType[]> {
    try {
      const rawEvents = await matrixEventService.getRoomTimeline(roomId, limit)
      const messageList = rawEvents
        .filter((event) => event.getType() === 'm.room.message' || event.getType() === 'm.room.encrypted')
        .map(convertMessage)

      messages.value.set(roomId, messageList)
      hasMoreMessages.value.set(roomId, rawEvents.length >= limit)
      info(`[RoomStore] 加载消息成功: ${roomId}, ${messageList.length} 条消息`)
      return messageList
    } catch (err) {
      error(`[RoomStore] 加载消息失败: ${err}`)
      throw err
    }
  }

  async function loadMoreMessages(limit: number = 50): Promise<MessageType[]> {
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

  async function sendMessage(roomId: string, content: {
    type: 'text' | 'image' | 'video' | 'audio' | 'file'
    text?: string
    html?: string
    file?: File
  }): Promise<string> {
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

  async function redactMessage(roomId: string, eventId: string, reason?: string): Promise<void> {
    try {
      await matrixEventService.redactEvent(roomId, eventId, reason)
      const messageList = messages.value.get(roomId)
      if (messageList) {
        const index = messageList.findIndex((msg) => msg.message.id === eventId)
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

  function updateRoom(roomId: string, updates: Partial<RoomInfo>): void {
    const roomInfo = rooms.value.get(roomId)
    if (roomInfo) {
      rooms.value.set(roomId, { ...roomInfo, ...updates })
    }
  }

  function addMessage(roomId: string, message: MessageType): void {
    const messageList = messages.value.get(roomId) ?? []
    messageList.push(message)
    messages.value.set(roomId, messageList)

    const roomInfo = rooms.value.get(roomId)
    if (roomInfo) {
      roomInfo.lastMessage = message.message.type === 1 ? (message.message.body as any)?.content : '[消息]'
      roomInfo.lastMessageTime = message.sendTime
    }
  }

  function setupEventListeners(): void {
    const client = matrixStore.getClient()
    if (!client) return

    client.on('Room.timeline' as any, (event: MatrixEvent, room: Room | undefined) => {
      if (!room) return

      if (event.getType() === 'm.room.message' || event.getType() === 'm.room.encrypted') {
        const message = convertMessage(event)
        addMessage(room.roomId, message)
      }

      const roomInfo = convertRoom(room)
      rooms.value.set(room.roomId, roomInfo)
    })

    client.on('Room.name' as any, (room: Room) => {
      updateRoom(room.roomId, { name: room.name })
    })

    client.on('Room.avatar' as any, (room: Room) => {
      updateRoom(room.roomId, { avatarUrl: room.getMxcAvatarUrl() ?? null })
    })

    client.on('Room.member' as any, (_event: MatrixEvent, member: RoomMember) => {
      const room = client.getRoom(member.roomId)
      if (room) {
        updateRoom(room.roomId, { members: room.getJoinedMembers() })
      }
    })

    info('[RoomStore] 事件监听器设置完成')
  }

  return {
    rooms,
    roomList,
    currentRoomId,
    currentRoom,
    messages,
    currentMessages,
    directRooms,
    groupRooms,
    isLoading,
    isLoadingMore,
    hasMoreMessages,
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
    setupEventListeners
  }
})
