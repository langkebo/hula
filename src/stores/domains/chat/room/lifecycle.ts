import { type Ref, type ShallowRef, triggerRef } from 'vue'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'
import { matrixRoomCreationService } from '@/services/matrix/room/CreationService'
import { matrixRoomRealtimeService } from '@/services/matrix/room/RealtimeService'
import type { RoomInfo } from '@/services/types'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useLocationStore } from '@/stores/domains/chat/location'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('RoomStore.Lifecycle')

export type RoomLifecycleContext = {
  rooms: ShallowRef<Map<string, RoomInfo>>
  currentRoomId: Ref<string | null>
  isLoading: Ref<boolean>
  clearRoomDetailCache: (roomId?: string) => void
}

/**
 * 房间生命周期模块：列表加载、创建/加入/离开、当前房间切换与局部更新。
 */
export function createRoomLifecycle(ctx: RoomLifecycleContext) {
  const { rooms, currentRoomId, isLoading, clearRoomDetailCache } = ctx

  async function loadRooms(): Promise<boolean> {
    // 返回 boolean
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
    // 进入房间时恢复该房间的活跃位置信标（会话恢复接线点）。
    if (roomId) {
      void useLocationStore()
        .restoreActiveBeacons(roomId)
        .catch((error) => {
          logger.warn(`[RoomStore] 恢复房间位置信标失败: ${roomId}`, error)
        })
    }
  }

  function updateRoom(roomId: string, updates: Partial<RoomInfo>): void {
    const roomInfo = rooms.value.get(roomId)
    if (roomInfo) {
      rooms.value.set(roomId, { ...roomInfo, ...updates })
      triggerRef(rooms)
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

  return {
    loadRooms,
    createRoom,
    joinRoom,
    leaveRoom,
    setCurrentRoom,
    updateRoom,
    resetState
  }
}
