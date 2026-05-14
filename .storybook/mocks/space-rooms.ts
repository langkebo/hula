import { ref } from 'vue'

export type MockSpaceRoom = {
  roomId: string
  name: string
  avatarUrl?: string
}

export const rooms = ref<MockSpaceRoom[]>([])
export const loading = ref(false)
export const mutating = ref(false)
export const error = ref<string | null>(null)

export const resetSpaceRoomsMock = () => {
  rooms.value = []
  loading.value = false
  mutating.value = false
  error.value = null
}

export const configureSpaceRoomsMock = (options: {
  rooms?: MockSpaceRoom[]
  error?: string | null
}) => {
  rooms.value = options.rooms ? options.rooms.map((room) => ({ ...room })) : []
  error.value = options.error ?? null
  loading.value = false
  mutating.value = false
}

export const useSpaceRooms = () => ({
  rooms,
  loading,
  mutating,
  error,
  load: async () => {},
  addRoom: async () => true,
  removeRoom: async () => true
})
