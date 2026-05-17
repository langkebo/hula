import { type Ref, ref } from 'vue'
import type { SpaceInfo, SpaceOptions } from '@/services/matrix/room/MatrixSpaceService'
import { matrixSpaceService } from '@/services/matrix/room/MatrixSpaceService'
import { createLogger } from '@/utils/Logger'

export type { SpaceInfo, SpaceOptions } from '@/services/matrix/room/MatrixSpaceService'

const logger = createLogger('useSpaces')

export interface UseSpacesResult {
  spaces: Ref<SpaceInfo[]>
  loading: Ref<boolean>
  mutating: Ref<boolean>
  error: Ref<string | null>
  load: () => Promise<void>
  create: (options: SpaceOptions) => Promise<SpaceInfo | null>
  joinSpace: (spaceId: string, viaServers?: string[]) => Promise<void>
  getSpaceHierarchy: (
    spaceId: string,
    options?: { from?: string; limit?: number; maxDepth?: number; suggestedOnly?: boolean }
  ) => Promise<{ rooms: Array<Record<string, unknown>>; next_batch?: string }>
  addChildToSpace: (spaceId: string, roomId: string, options?: { via?: string[]; suggested?: boolean }) => Promise<void>
}

export function useSpaces(): UseSpacesResult {
  const spaces = ref<SpaceInfo[]>([])
  const loading = ref(false)
  const mutating = ref(false)
  const error = ref<string | null>(null)

  const load = async () => {
    loading.value = true
    error.value = null
    try {
      spaces.value = await matrixSpaceService.getSpaces()
    } catch (err) {
      logger.error('load spaces failed', err)
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  const create = async (options: SpaceOptions): Promise<SpaceInfo | null> => {
    mutating.value = true
    error.value = null
    try {
      const result = await matrixSpaceService.createSpace(options)
      if (result) await load()
      return result
    } catch (err) {
      logger.error('create space failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return null
    } finally {
      mutating.value = false
    }
  }

  const joinSpace = async (spaceId: string, viaServers?: string[]): Promise<void> => {
    await matrixSpaceService.joinSpace(spaceId, viaServers)
  }

  const getSpaceHierarchy = async (
    spaceId: string,
    options?: { from?: string; limit?: number; maxDepth?: number; suggestedOnly?: boolean }
  ): Promise<{ rooms: Array<Record<string, unknown>>; next_batch?: string }> => {
    return await matrixSpaceService.getSpaceHierarchy(spaceId, options)
  }

  const addChildToSpace = async (
    spaceId: string,
    roomId: string,
    options?: { via?: string[]; suggested?: boolean }
  ): Promise<void> => {
    await matrixSpaceService.addChildToSpace(spaceId, roomId, options)
  }

  return { spaces, loading, mutating, error, load, create, joinSpace, getSpaceHierarchy, addChildToSpace }
}
