import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { StoresEnum } from '@/enums'
import type { RoomInfo } from '@/services/types'
import { createRoomDetailCache } from './detailCache'
import { createRoomLifecycle } from './lifecycle'
import { createRoomSync } from './sync'
import { createRoomTags } from './tags'

/**
 * 房间域 Store（装配层）
 *
 * 模块拆分（原 room.ts 702 行）：
 * - lifecycle.ts   房间列表/创建/加入/离开/当前房间
 * - sync.ts        实时事件监听 + SlidingSync 回调 + 增量更新
 * - detailCache.ts 房间详情 LRU 缓存
 * - tags.ts        房间标签（置顶联动 + 防抖串行刷新）
 *
 * 对外签名与拆分前完全一致，消费方 import 路径不变（chat/room → room/index.ts）。
 */
export const useRoomStore = defineStore(StoresEnum.ROOM, () => {
  const rooms = shallowRef<Map<string, RoomInfo>>(new Map())
  const currentRoomId = ref<string | null>(null)
  const isLoading = ref(false)

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

  const detailCache = createRoomDetailCache({ rooms })
  const lifecycle = createRoomLifecycle({
    rooms,
    currentRoomId,
    isLoading,
    clearRoomDetailCache: detailCache.clearRoomDetailCache
  })
  const tags = createRoomTags({ rooms })
  const sync = createRoomSync({
    rooms,
    updateRoom: lifecycle.updateRoom,
    loadRooms: lifecycle.loadRooms,
    scheduleTagsRefresh: tags.scheduleTagsRefresh,
    batchRefreshTags: tags.batchRefreshTags
  })

  return {
    rooms,
    currentRoomId,
    isLoading,
    roomList,
    currentRoom,
    directRooms,
    groupRooms,
    ...lifecycle,
    ...sync,
    ...detailCache,
    tagsByRoom: tags.tagsByRoom,
    setTagsForRoom: tags.setTagsForRoom,
    getTagsForRoom: tags.getTagsForRoom,
    hasTag: tags.hasTag,
    refreshRoomTags: tags.refreshRoomTags,
    addRoomTag: tags.addRoomTag,
    removeRoomTag: tags.removeRoomTag
  }
})
