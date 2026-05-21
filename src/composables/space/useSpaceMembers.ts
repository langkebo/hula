import { type Ref, ref } from 'vue'
import { matrixSpaceService, type SpaceMember } from '@/services/matrix/room/MatrixSpaceService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useSpaceMembers')

export type { SpaceMember }

export interface UseSpaceMembersResult {
  members: Ref<SpaceMember[]>
  loading: Ref<boolean>
  mutating: Ref<boolean>
  error: Ref<string | null>
  load: () => Promise<void>
  invite: (userId: string) => Promise<boolean>
}

export function useSpaceMembers(spaceId: () => string): UseSpaceMembersResult {
  const members = ref<SpaceMember[]>([])
  const loading = ref(false)
  const mutating = ref(false)
  const error = ref<string | null>(null)

  const load = async () => {
    const id = spaceId()
    if (!id) {
      members.value = []
      return
    }
    loading.value = true
    error.value = null
    try {
      members.value = await matrixSpaceService.getSpaceMembers(id)
    } catch (err) {
      logger.error('load members failed', err)
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  const invite = async (userId: string): Promise<boolean> => {
    const id = spaceId()
    if (!id || !userId) return false
    mutating.value = true
    error.value = null
    try {
      await matrixSpaceService.inviteToSpace(id, userId)
      await load()
      return true
    } catch (err) {
      logger.error('invite failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      mutating.value = false
    }
  }

  return { members, loading, mutating, error, load, invite }
}
