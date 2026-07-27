import { computed, type Ref, ref } from 'vue'
import { adminService } from '@/services/matrix/admin'
import type { RoomInfo, RoomState } from '@/services/matrix/admin/AdminTypes'

export type { RoomInfo } from '@/services/matrix/admin/AdminTypes'

interface RoomMessage {
  eventId: string
  sender: string
  content: string
  eventType: string
  timestamp: number
}

interface UseAdminRoomsResult {
  rooms: Ref<RoomInfo[]>
  filteredRooms: Ref<RoomInfo[]>
  loading: Ref<boolean>
  searchQuery: Ref<string>

  selectedRoom: Ref<RoomInfo | null>
  roomMembers: Ref<string[]>
  membersLoading: Ref<boolean>
  roomState: Ref<RoomState | null>
  stateLoading: Ref<boolean>

  roomMessages: Ref<RoomMessage[]>
  messagesLoading: Ref<boolean>
  messagesPaginationToken: Ref<string | undefined>
  loadMessages: (limit?: number, from?: string) => Promise<void>

  roomAliases: Ref<string[]>
  aliasesLoading: Ref<boolean>
  loadAliases: () => Promise<void>

  roomStats: Ref<Record<string, unknown> | null>
  statsLoading: Ref<boolean>
  loadRoomStats: () => Promise<void>

  searchResults: Ref<RoomInfo[]>
  searchLoading: Ref<boolean>
  searchRooms: (query: string) => Promise<void>

  makeRoomAdmin: (roomId: string, userId?: string) => Promise<void>
  purgeHistory: (
    roomId: string,
    options?: { purgeUpToEventId?: string; purgeUpToTs?: number; deleteLocalEvents?: boolean }
  ) => Promise<{ purgeId: string }>

  loadRooms: (limit?: number, searchTerm?: string) => Promise<void>
  selectRoom: (room: RoomInfo | null) => Promise<void>
  loadMembers: () => Promise<void>
  loadState: () => Promise<void>

  deleteRoom: (roomId: string, opts?: { purge?: boolean }) => Promise<void>
  blockRoom: (roomId: string, block: boolean) => Promise<void>
  shutdownRoom: (roomId: string, message?: string) => Promise<{ kickedUsers: string[] }>
  forceJoinRoom: (roomId: string, userId: string) => Promise<void>
  forceLeaveRoom: (roomId: string, userId: string) => Promise<void>
  kickUser: (roomId: string, userId: string) => Promise<void>
  banUser: (roomId: string, userId: string) => Promise<void>
}

/**
 * Admin rooms composable.
 *
 * Owns state + orchestration for the admin room-management surface so that
 * desktop (`src/views/admin/AdminRooms.vue`) and mobile
 * (`src/mobile/views/admin/AdminRooms.vue`, pending) render the same business
 * logic.
 */
export function useAdminRooms(): UseAdminRoomsResult {
  const rooms = ref<RoomInfo[]>([])
  const loading = ref(false)
  const searchQuery = ref('')

  const selectedRoom = ref<RoomInfo | null>(null)
  const roomMembers = ref<string[]>([])
  const membersLoading = ref(false)
  const roomState = ref<RoomState | null>(null)
  const stateLoading = ref(false)

  // Messages
  const roomMessages = ref<RoomMessage[]>([])
  const messagesLoading = ref(false)
  const messagesPaginationToken = ref<string | undefined>()

  // Aliases
  const roomAliases = ref<string[]>([])
  const aliasesLoading = ref(false)

  // Stats
  const roomStats = ref<Record<string, unknown> | null>(null)
  const statsLoading = ref(false)

  // Search
  const searchResults = ref<RoomInfo[]>([])
  const searchLoading = ref(false)

  const filteredRooms = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return rooms.value
    return rooms.value.filter((r) => {
      return (
        r.roomId.toLowerCase().includes(q) ||
        (r.name ?? '').toLowerCase().includes(q) ||
        (r.topic ?? '').toLowerCase().includes(q)
      )
    })
  })

  async function loadRooms(limit = 200, searchTerm?: string) {
    loading.value = true
    try {
      const result = await adminService.getRooms(limit, undefined, searchTerm)
      rooms.value = result.rooms
    } finally {
      loading.value = false
    }
  }

  async function selectRoom(room: RoomInfo | null) {
    selectedRoom.value = room
    roomMembers.value = []
    roomState.value = null
    roomMessages.value = []
    messagesPaginationToken.value = undefined
    roomAliases.value = []
    roomStats.value = null
    if (!room) return
    await Promise.allSettled([loadMembers(), loadState(), loadMessages(), loadAliases(), loadRoomStats()])
  }

  async function loadMembers() {
    if (!selectedRoom.value) return
    membersLoading.value = true
    try {
      roomMembers.value = await adminService.getRoomMembers(selectedRoom.value.roomId)
    } finally {
      membersLoading.value = false
    }
  }

  async function loadState() {
    if (!selectedRoom.value) return
    stateLoading.value = true
    try {
      roomState.value = await adminService.getRoomState(selectedRoom.value.roomId)
    } finally {
      stateLoading.value = false
    }
  }

  async function loadMessages(limit = 50, from?: string) {
    if (!selectedRoom.value) return
    messagesLoading.value = true
    try {
      const result = await adminService.getRoomMessages(selectedRoom.value.roomId, limit, from, 'b')
      const mapped = (result.chunk ?? []).map((event) => {
        const content = event.content as Record<string, unknown> | undefined
        const body = (content?.body as string) ?? JSON.stringify(content ?? {})
        return {
          eventId: (event.event_id as string) ?? '',
          sender: (event.sender as string) ?? '',
          content: body,
          eventType: (event.type as string) ?? '',
          timestamp: typeof event.origin_server_ts === 'number' ? event.origin_server_ts : 0
        }
      })
      if (from) {
        roomMessages.value = [...roomMessages.value, ...mapped]
      } else {
        roomMessages.value = mapped
      }
      messagesPaginationToken.value = result.end
    } finally {
      messagesLoading.value = false
    }
  }

  async function loadAliases() {
    if (!selectedRoom.value) return
    aliasesLoading.value = true
    try {
      roomAliases.value = await adminService.getRoomAliases(selectedRoom.value.roomId)
    } finally {
      aliasesLoading.value = false
    }
  }

  async function loadRoomStats() {
    if (!selectedRoom.value) return
    statsLoading.value = true
    try {
      roomStats.value = await adminService.getSingleRoomStats(selectedRoom.value.roomId)
    } finally {
      statsLoading.value = false
    }
  }

  async function searchRooms(query: string) {
    if (!query.trim()) {
      searchResults.value = []
      return
    }
    searchLoading.value = true
    try {
      const result = await adminService.searchRooms(query)
      searchResults.value = (result.rooms ?? []).map((r) => ({
        roomId: (r.room_id as string) ?? '',
        name: r.name as string | undefined,
        joinedMembers: (r.joined_members as number) ?? 0,
        joinedLocalMembers: (r.joined_local_members as number) ?? 0,
        invitedMembers: 0,
        invitedLocalMembers: 0,
        creator: r.creator as string | undefined,
        public: r.public as boolean | undefined
      }))
    } finally {
      searchLoading.value = false
    }
  }

  async function makeRoomAdmin(roomId: string, userId?: string) {
    await adminService.makeRoomAdmin(roomId, userId)
  }

  async function purgeHistory(
    roomId: string,
    options?: { purgeUpToEventId?: string; purgeUpToTs?: number; deleteLocalEvents?: boolean }
  ) {
    return adminService.purgeHistory(roomId, options)
  }

  async function deleteRoom(roomId: string, opts?: { purge?: boolean }) {
    await adminService.deleteRoom(roomId, opts)
    await loadRooms()
    if (selectedRoom.value?.roomId === roomId) await selectRoom(null)
  }

  async function blockRoom(roomId: string, block: boolean) {
    await adminService.blockRoom(roomId, block)
    await loadRooms()
  }

  async function shutdownRoom(roomId: string, message?: string): Promise<{ kickedUsers: string[] }> {
    const result = await adminService.shutdownRoom(roomId, message)
    await loadRooms()
    if (selectedRoom.value?.roomId === roomId) await selectRoom(null)
    return { kickedUsers: result.kickedUsers }
  }

  async function forceJoinRoom(roomId: string, userId: string) {
    await adminService.forceJoinRoom(roomId, userId)
    if (selectedRoom.value?.roomId === roomId) await loadMembers()
  }

  async function forceLeaveRoom(roomId: string, userId: string) {
    await adminService.forceLeaveRoom(roomId, userId)
    if (selectedRoom.value?.roomId === roomId) await loadMembers()
  }

  async function kickUser(roomId: string, userId: string) {
    await adminService.kickUser(roomId, userId)
    if (selectedRoom.value?.roomId === roomId) await loadMembers()
  }

  async function banUser(roomId: string, userId: string) {
    await adminService.banUser(roomId, userId)
    if (selectedRoom.value?.roomId === roomId) await loadMembers()
  }

  return {
    rooms,
    filteredRooms,
    loading,
    searchQuery,
    selectedRoom,
    roomMembers,
    membersLoading,
    roomState,
    stateLoading,
    roomMessages,
    messagesLoading,
    messagesPaginationToken,
    loadMessages,
    roomAliases,
    aliasesLoading,
    loadAliases,
    roomStats,
    statsLoading,
    loadRoomStats,
    searchResults,
    searchLoading,
    searchRooms,
    makeRoomAdmin,
    purgeHistory,
    loadRooms,
    selectRoom,
    loadMembers,
    loadState,
    deleteRoom,
    blockRoom,
    shutdownRoom,
    forceJoinRoom,
    forceLeaveRoom,
    kickUser,
    banUser
  }
}
