import { computed, type Ref, ref } from 'vue'
import { adminService } from '@/services/matrix/admin'
import type { RoomInfo, RoomState } from '@/services/matrix/admin/AdminTypes'

export interface UseAdminRoomsResult {
  rooms: Ref<RoomInfo[]>
  filteredRooms: Ref<RoomInfo[]>
  loading: Ref<boolean>
  searchQuery: Ref<string>

  selectedRoom: Ref<RoomInfo | null>
  roomMembers: Ref<string[]>
  membersLoading: Ref<boolean>
  roomState: Ref<RoomState | null>
  stateLoading: Ref<boolean>

  loadRooms: (limit?: number, searchTerm?: string) => Promise<void>
  selectRoom: (room: RoomInfo | null) => Promise<void>
  loadMembers: () => Promise<void>
  loadState: () => Promise<void>

  deleteRoom: (roomId: string, opts?: { purge?: boolean }) => Promise<void>
  blockRoom: (roomId: string, block: boolean) => Promise<void>
  shutdownRoom: (roomId: string, message?: string) => Promise<{ kickedUsers: string[] }>
  forceJoinRoom: (roomId: string, userId: string) => Promise<void>
  forceLeaveRoom: (roomId: string, userId: string) => Promise<void>
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
    if (!room) return
    await Promise.allSettled([loadMembers(), loadState()])
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
    loadRooms,
    selectRoom,
    loadMembers,
    loadState,
    deleteRoom,
    blockRoom,
    shutdownRoom,
    forceJoinRoom,
    forceLeaveRoom
  }
}
