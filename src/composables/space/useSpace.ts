import { ref, type Ref } from 'vue'
import { matrixSpaceService } from '@/services/matrix'
import type { SpaceInfo, SpaceOptions } from '@/services/matrix/room/MatrixSpaceService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useSpace')

export interface UseSpaceResult {
  space: Ref<SpaceInfo | null>
  loading: Ref<boolean>
  mutating: Ref<boolean>
  error: Ref<string | null>
  load: () => Promise<void>
  update: (updates: Partial<SpaceOptions>) => Promise<boolean>
  leave: () => Promise<boolean>
}

/**
 * Single-space detail state. Takes a getter so the view can swap
 * which space it is viewing without re-instantiating the composable.
 */
export function useSpace(spaceId: () => string): UseSpaceResult {
  const space = ref<SpaceInfo | null>(null)
  const loading = ref(false)
  const mutating = ref(false)
  const error = ref<string | null>(null)

  const load = async () => {
    const id = spaceId()
    if (!id) {
      space.value = null
      return
    }
    loading.value = true
    error.value = null
    try {
      space.value = await matrixSpaceService.getSpace(id)
    } catch (err) {
      logger.error('load space failed', err)
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  const update = async (updates: Partial<SpaceOptions>): Promise<boolean> => {
    const id = spaceId()
    if (!id) return false
    mutating.value = true
    error.value = null
    try {
      await matrixSpaceService.updateSpace(id, updates)
      await load()
      return true
    } catch (err) {
      logger.error('update space failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      mutating.value = false
    }
  }

  const leave = async (): Promise<boolean> => {
    const id = spaceId()
    if (!id) return false
    mutating.value = true
    error.value = null
    try {
      await matrixSpaceService.leaveSpace(id)
      space.value = null
      return true
    } catch (err) {
      logger.error('leave space failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      mutating.value = false
    }
  }

  return { space, loading, mutating, error, load, update, leave }
}
