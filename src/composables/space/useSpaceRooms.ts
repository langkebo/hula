import { type Ref, ref } from 'vue'
import { matrixSpaceService } from '@/services/matrix/room/MatrixSpaceService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useSpaceRooms')

export interface SpaceChildRoom {
  roomId: string
  name: string
  avatarUrl?: string
}

export interface UseSpaceRoomsResult {
  rooms: Ref<SpaceChildRoom[]>
  loading: Ref<boolean>
  mutating: Ref<boolean>
  error: Ref<string | null>
  load: () => Promise<void>
  addRoom: (roomId: string, options?: { via?: string[]; suggested?: boolean }) => Promise<boolean>
  removeRoom: (roomId: string) => Promise<boolean>
}

export function useSpaceRooms(spaceId: () => string): UseSpaceRoomsResult {
  const rooms = ref<SpaceChildRoom[]>([])
  const loading = ref(false)
  const mutating = ref(false)
  const error = ref<string | null>(null)

  const load = async () => {
    const id = spaceId()
    if (!id) {
      rooms.value = []
      return
    }
    loading.value = true
    error.value = null
    try {
      rooms.value = await matrixSpaceService.getSpaceRooms(id)
    } catch (err) {
      logger.error('load rooms failed', err)
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  const addRoom = async (roomId: string, options?: { via?: string[]; suggested?: boolean }): Promise<boolean> => {
    const id = spaceId()
    if (!id || !roomId) return false
    mutating.value = true
    error.value = null
    try {
      await matrixSpaceService.addChildToSpace(id, roomId, options)
      await load()
      return true
    } catch (err) {
      logger.error('addRoom failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      mutating.value = false
    }
  }

  const removeRoom = async (roomId: string): Promise<boolean> => {
    const id = spaceId()
    if (!id || !roomId) return false
    mutating.value = true
    error.value = null
    try {
      await matrixSpaceService.removeChildFromSpace(id, roomId)
      await load()
      return true
    } catch (err) {
      logger.error('removeRoom failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      mutating.value = false
    }
  }

  return { rooms, loading, mutating, error, load, addRoom, removeRoom }
}
