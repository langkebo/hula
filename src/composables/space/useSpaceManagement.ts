import type { Ref } from 'vue'
import { ref } from 'vue'
import type { SpaceChild, SpaceInfo, SpaceMember, SpaceOptions } from '@/services/matrix/room/MatrixSpaceService'
import { matrixSpaceService } from '@/services/matrix/room/MatrixSpaceService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useSpaceManagement')

export type { SpaceChild, SpaceInfo, SpaceMember, SpaceOptions }

export interface SpaceStateEvent {
  type: string
  stateKey: string
  content: unknown
}

export interface SpaceSummaryChild {
  roomId: string
  name: string
  avatarUrl?: string
  memberCount: number
  joinRule?: string
}

export interface SpaceSummary {
  space: SpaceInfo
  children: SpaceSummaryChild[]
}

export interface SpaceSummaryWithChildren {
  space: SpaceInfo
  children: Array<Record<string, unknown>>
}

export interface UseSpaceManagementResult {
  spaceInfo: Ref<SpaceInfo | null>
  members: Ref<SpaceMember[]>
  children: Ref<SpaceChild[]>
  loading: Ref<boolean>
  mutating: Ref<boolean>
  error: Ref<string | null>
  spaceState: Ref<SpaceStateEvent[]>
  spaceHierarchy: Ref<Array<Record<string, unknown>>>
  spaceSummary: Ref<SpaceSummary | null>
  spaceSummaryWithChildren: Ref<SpaceSummaryWithChildren | null>
  loadSpace: () => Promise<void>
  updateSpaceInfo: (data: Partial<SpaceOptions>) => Promise<boolean>
  inviteUser: (userId: string) => Promise<boolean>
  addChildRoom: (roomId: string, order?: string) => Promise<boolean>
  removeChildRoom: (roomId: string) => Promise<boolean>
  leaveSpace: () => Promise<boolean>
  deleteSpace: () => Promise<boolean>
  loadSpaceState: () => Promise<void>
  loadSpaceHierarchy: () => Promise<void>
  loadSpaceSummary: () => Promise<void>
  loadSpaceSummaryWithChildren: () => Promise<void>
}

export function useSpaceManagement(spaceId: () => string): UseSpaceManagementResult {
  const spaceInfo = ref<SpaceInfo | null>(null)
  const members = ref<SpaceMember[]>([])
  const children = ref<SpaceChild[]>([])
  const loading = ref(false)
  const mutating = ref(false)
  const error = ref<string | null>(null)
  const spaceState = ref<SpaceStateEvent[]>([])
  const spaceHierarchy = ref<Array<Record<string, unknown>>>([])
  const spaceSummary = ref<SpaceSummary | null>(null)
  const spaceSummaryWithChildren = ref<SpaceSummaryWithChildren | null>(null)

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

  const loadSpaceState = async () => {
    const id = spaceId()
    if (!id) {
      spaceState.value = []
      return
    }
    try {
      const events = await matrixSpaceService.getSpaceState(id)
      spaceState.value = events.map((e) => ({
        type: e.type,
        stateKey: e.stateKey,
        content: e.content
      }))
    } catch (err) {
      logger.error('loadSpaceState failed', err)
      spaceState.value = []
    }
  }

  const loadSpaceHierarchy = async () => {
    const id = spaceId()
    if (!id) {
      spaceHierarchy.value = []
      return
    }
    try {
      const result = await matrixSpaceService.getSpaceHierarchyV1(id)
      spaceHierarchy.value = result.rooms ?? []
    } catch (err) {
      logger.error('loadSpaceHierarchy failed', err)
      spaceHierarchy.value = []
    }
  }

  const loadSpaceSummary = async () => {
    const id = spaceId()
    if (!id) {
      spaceSummary.value = null
      return
    }
    try {
      const result = await matrixSpaceService.getSpaceSummary(id)
      spaceSummary.value = result
    } catch (err) {
      logger.error('loadSpaceSummary failed', err)
      spaceSummary.value = null
    }
  }

  const loadSpaceSummaryWithChildren = async () => {
    const id = spaceId()
    if (!id) {
      spaceSummaryWithChildren.value = null
      return
    }
    try {
      const result = await matrixSpaceService.getSpaceSummaryWithChildren(id)
      spaceSummaryWithChildren.value = result
    } catch (err) {
      logger.error('loadSpaceSummaryWithChildren failed', err)
      spaceSummaryWithChildren.value = null
    }
  }

  return {
    spaceInfo,
    members,
    children,
    loading,
    mutating,
    error,
    spaceState,
    spaceHierarchy,
    spaceSummary,
    spaceSummaryWithChildren,
    loadSpace,
    updateSpaceInfo,
    inviteUser,
    addChildRoom,
    removeChildRoom,
    leaveSpace,
    deleteSpace,
    loadSpaceState,
    loadSpaceHierarchy,
    loadSpaceSummary,
    loadSpaceSummaryWithChildren
  }
}
