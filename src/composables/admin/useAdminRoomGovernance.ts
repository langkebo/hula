import { type Ref, ref } from 'vue'
import { adminService } from '@/services/matrix/admin'
import type { RoomInfo } from '@/services/matrix/admin/AdminTypes'
import type { RoomStatsOverview } from '@/services/matrix/sdk'

export interface AdminRoomGovernanceState {
  /** 服务端全量房间统计（治理概览） */
  serverRoomStats: Ref<RoomStatsOverview | null>
  serverStatsLoading: Ref<boolean>
  loadServerRoomStats: () => Promise<void>

  /** 当前房间封禁状态 */
  roomBlockStatus: Ref<boolean | null>
  blockStatusLoading: Ref<boolean>
  loadRoomBlockStatus: () => Promise<void>
  blockRoom: (roomId: string, block: boolean) => Promise<void>
  unblockRoom: (roomId: string) => Promise<void>

  /** 当前房间公开目录项 */
  roomListings: Ref<Record<string, unknown> | null>
  listingsLoading: Ref<boolean>
  loadRoomListings: () => Promise<void>
  /** 发布/下线公开目录；isPublic 缺省为 true（发布） */
  setRoomPublicListing: (roomId: string, isPublic?: boolean) => Promise<void>

  /** 当前房间 token 同步信息 */
  roomTokenSync: Ref<Record<string, unknown> | null>
  tokenSyncLoading: Ref<boolean>
  loadRoomTokenSync: () => Promise<void>

  /** 级联撤回 */
  cascadeRedactLoading: Ref<boolean>
  cascadeRedactEvent: (eventId: string, options?: { maxDepth?: number; reason?: string }) => Promise<number>

  /** 事件上下文 */
  roomEventContext: Ref<Record<string, unknown> | null>
  eventContextLoading: Ref<boolean>
  loadRoomEventContext: (eventId: string) => Promise<void>

  /** 房间内搜索 */
  roomSearchResults: Ref<Array<Record<string, unknown>>>
  roomSearchLoading: Ref<boolean>
  searchInRoom: (searchTerm: string) => Promise<void>

  /** 前向极值 */
  forwardExtremities: Ref<Array<Record<string, unknown>>>
  forwardExtremitiesLoading: Ref<boolean>
  loadForwardExtremities: () => Promise<void>

  resetGovernance: () => void
}

/**
 * 管理后台房间「治理」子域：封禁、公开目录、事件上下文、房间内搜索与前向极值。
 *
 * 与 `useAdminRooms` 主 composable 同构：由主 composable 注入当前选中房间与列表刷新回调，
 * 保持单文件体量可控，同时对外暴露的状态形状不变。
 */
export function useAdminRoomGovernance(
  selectedRoom: Ref<RoomInfo | null>,
  onRoomsChanged: () => Promise<void>
): AdminRoomGovernanceState {
  const serverRoomStats = ref<RoomStatsOverview | null>(null)
  const serverStatsLoading = ref(false)

  const roomBlockStatus = ref<boolean | null>(null)
  const blockStatusLoading = ref(false)

  const roomListings = ref<Record<string, unknown> | null>(null)
  const listingsLoading = ref(false)

  const roomTokenSync = ref<Record<string, unknown> | null>(null)
  const tokenSyncLoading = ref(false)

  const cascadeRedactLoading = ref(false)

  const roomEventContext = ref<Record<string, unknown> | null>(null)
  const eventContextLoading = ref(false)

  const roomSearchResults = ref<Array<Record<string, unknown>>>([])
  const roomSearchLoading = ref(false)

  const forwardExtremities = ref<Array<Record<string, unknown>>>([])
  const forwardExtremitiesLoading = ref(false)

  async function loadServerRoomStats() {
    serverStatsLoading.value = true
    try {
      serverRoomStats.value = await adminService.getRoomStats()
    } finally {
      serverStatsLoading.value = false
    }
  }

  async function loadRoomBlockStatus() {
    if (!selectedRoom.value) return
    blockStatusLoading.value = true
    try {
      roomBlockStatus.value = await adminService.getRoomBlockStatus(selectedRoom.value.roomId)
    } finally {
      blockStatusLoading.value = false
    }
  }

  async function blockRoom(roomId: string, block: boolean) {
    await adminService.blockRoom(roomId, block)
    await onRoomsChanged()
    if (selectedRoom.value?.roomId === roomId) await loadRoomBlockStatus()
  }

  async function unblockRoom(roomId: string) {
    await adminService.unblockRoom(roomId)
    await onRoomsChanged()
    if (selectedRoom.value?.roomId === roomId) await loadRoomBlockStatus()
  }

  async function loadRoomListings() {
    if (!selectedRoom.value) return
    listingsLoading.value = true
    try {
      roomListings.value = await adminService.getRoomListings(selectedRoom.value.roomId)
    } finally {
      listingsLoading.value = false
    }
  }

  async function setRoomPublicListing(roomId: string, isPublic = true) {
    await adminService.setRoomPublicListing(roomId, isPublic)
    if (selectedRoom.value?.roomId === roomId) await loadRoomListings()
  }

  async function loadRoomTokenSync() {
    if (!selectedRoom.value) return
    tokenSyncLoading.value = true
    try {
      roomTokenSync.value = await adminService.getRoomTokenSync(selectedRoom.value.roomId)
    } finally {
      tokenSyncLoading.value = false
    }
  }

  async function cascadeRedactEvent(eventId: string, options?: { maxDepth?: number; reason?: string }) {
    if (!selectedRoom.value || !eventId.trim()) return 0
    cascadeRedactLoading.value = true
    try {
      return await adminService.cascadeRedactEvent(selectedRoom.value.roomId, eventId.trim(), options)
    } finally {
      cascadeRedactLoading.value = false
    }
  }

  async function loadRoomEventContext(eventId: string) {
    if (!selectedRoom.value || !eventId.trim()) {
      roomEventContext.value = null
      return
    }
    eventContextLoading.value = true
    try {
      roomEventContext.value = await adminService.getRoomEventContext(selectedRoom.value.roomId, eventId.trim())
    } finally {
      eventContextLoading.value = false
    }
  }

  async function searchInRoom(searchTerm: string) {
    if (!selectedRoom.value || !searchTerm.trim()) {
      roomSearchResults.value = []
      return
    }
    roomSearchLoading.value = true
    try {
      const result = await adminService.searchInRoom(selectedRoom.value.roomId, searchTerm.trim())
      roomSearchResults.value = result?.results ?? []
    } finally {
      roomSearchLoading.value = false
    }
  }

  async function loadForwardExtremities() {
    if (!selectedRoom.value) return
    forwardExtremitiesLoading.value = true
    try {
      forwardExtremities.value = await adminService.getRoomForwardExtremities(selectedRoom.value.roomId)
    } finally {
      forwardExtremitiesLoading.value = false
    }
  }

  function resetGovernance() {
    roomBlockStatus.value = null
    roomListings.value = null
    roomTokenSync.value = null
    roomEventContext.value = null
    roomSearchResults.value = []
    forwardExtremities.value = []
  }

  return {
    serverRoomStats,
    serverStatsLoading,
    loadServerRoomStats,
    roomBlockStatus,
    blockStatusLoading,
    loadRoomBlockStatus,
    blockRoom,
    unblockRoom,
    roomListings,
    listingsLoading,
    loadRoomListings,
    setRoomPublicListing,
    roomTokenSync,
    tokenSyncLoading,
    loadRoomTokenSync,
    cascadeRedactLoading,
    cascadeRedactEvent,
    roomEventContext,
    eventContextLoading,
    loadRoomEventContext,
    roomSearchResults,
    roomSearchLoading,
    searchInRoom,
    forwardExtremities,
    forwardExtremitiesLoading,
    loadForwardExtremities,
    resetGovernance
  }
}
