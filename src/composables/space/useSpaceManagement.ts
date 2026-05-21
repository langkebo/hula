import type { Ref } from 'vue'
import { ref } from 'vue'
import type { SpaceChild, SpaceInfo, SpaceMember, SpaceOptions } from '@/services/matrix/room/MatrixSpaceService'
import { matrixSpaceService } from '@/services/matrix/room/MatrixSpaceService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useSpaceManagement')

export type { SpaceChild, SpaceInfo, SpaceMember, SpaceOptions }

export interface UseSpaceManagementResult {
  spaceInfo: Ref<SpaceInfo | null>
  members: Ref<SpaceMember[]>
  children: Ref<SpaceChild[]>
  loading: Ref<boolean>
  mutating: Ref<boolean>
  error: Ref<string | null>
  loadSpace: () => Promise<void>
  updateSpaceInfo: (data: Partial<SpaceOptions>) => Promise<boolean>
  inviteUser: (userId: string) => Promise<boolean>
  addChildRoom: (roomId: string, order?: string) => Promise<boolean>
  removeChildRoom: (roomId: string) => Promise<boolean>
  leaveSpace: () => Promise<boolean>
  deleteSpace: () => Promise<boolean>
}

export function useSpaceManagement(spaceId: () => string): UseSpaceManagementResult {
  const spaceInfo = ref<SpaceInfo | null>(null)
  const members = ref<SpaceMember[]>([])
  const children = ref<SpaceChild[]>([])
  const loading = ref(false)
  const mutating = ref(false)
  const error = ref<string | null>(null)

  const loadSpace = async () => {
    const id = spaceId()
    if (!id) {
      spaceInfo.value = null
      members.value = []
      children.value = []
      return
    }
    loading.value = true
    error.value = null
    try {
      const [info, memberList, childList] = await Promise.all([
        matrixSpaceService.getSpace(id),
        matrixSpaceService.getSpaceMembers(id),
        matrixSpaceService.getSpaceChildren(id)
      ])
      spaceInfo.value = info
      members.value = memberList
      children.value = childList
    } catch (err) {
      logger.error('loadSpace failed', err)
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  const updateSpaceInfo = async (data: Partial<SpaceOptions>): Promise<boolean> => {
    const id = spaceId()
    if (!id) return false
    mutating.value = true
    error.value = null
    try {
      await matrixSpaceService.updateSpace(id, data)
      await loadSpace()
      return true
    } catch (err) {
      logger.error('updateSpaceInfo failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      mutating.value = false
    }
  }

  const inviteUser = async (userId: string): Promise<boolean> => {
    const id = spaceId()
    if (!id || !userId) return false
    mutating.value = true
    error.value = null
    try {
      await matrixSpaceService.inviteToSpace(id, userId)
      await loadSpace()
      return true
    } catch (err) {
      logger.error('inviteUser failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      mutating.value = false
    }
  }

  const addChildRoom = async (roomId: string, order?: string): Promise<boolean> => {
    const id = spaceId()
    if (!id || !roomId) return false
    mutating.value = true
    error.value = null
    try {
      await matrixSpaceService.addChild(id, roomId, order)
      await loadSpace()
      return true
    } catch (err) {
      logger.error('addChildRoom failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      mutating.value = false
    }
  }

  const removeChildRoom = async (roomId: string): Promise<boolean> => {
    const id = spaceId()
    if (!id || !roomId) return false
    mutating.value = true
    error.value = null
    try {
      await matrixSpaceService.removeChild(id, roomId)
      await loadSpace()
      return true
    } catch (err) {
      logger.error('removeChildRoom failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      mutating.value = false
    }
  }

  const leaveSpace = async (): Promise<boolean> => {
    const id = spaceId()
    if (!id) return false
    mutating.value = true
    error.value = null
    try {
      await matrixSpaceService.leaveSpace(id)
      spaceInfo.value = null
      members.value = []
      children.value = []
      return true
    } catch (err) {
      logger.error('leaveSpace failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      mutating.value = false
    }
  }

  const deleteSpace = async (): Promise<boolean> => {
    const id = spaceId()
    if (!id) return false
    mutating.value = true
    error.value = null
    try {
      await matrixSpaceService.deleteSpace(id)
      spaceInfo.value = null
      members.value = []
      children.value = []
      return true
    } catch (err) {
      logger.error('deleteSpace failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      mutating.value = false
    }
  }

  return {
    spaceInfo,
    members,
    children,
    loading,
    mutating,
    error,
    loadSpace,
    updateSpaceInfo,
    inviteUser,
    addChildRoom,
    removeChildRoom,
    leaveSpace,
    deleteSpace
  }
}
