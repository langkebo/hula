import { type Ref, ref } from 'vue'
import type { SpaceInfo } from '@/services/matrix/room/MatrixSpaceService'
import { matrixSpaceService } from '@/services/matrix/room/MatrixSpaceService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useSpaceDiscovery')

export interface SpaceStatistics {
  totalSpaces: number
  totalMembers: number
  totalRooms: number
  [key: string]: unknown
}

export interface UseSpaceDiscoveryResult {
  loading: Ref<boolean>
  error: Ref<string | null>
  publicSpaces: Ref<SpaceInfo[]>
  searchResults: Ref<SpaceInfo[]>
  statistics: Ref<SpaceStatistics | null>
  userSpaces: Ref<SpaceInfo[]>
  loadPublicSpaces: (limit?: number) => Promise<void>
  searchSpaces: (query: string, limit?: number) => Promise<void>
  loadStatistics: () => Promise<void>
  loadUserSpaces: () => Promise<void>
}

export function useSpaceDiscovery(): UseSpaceDiscoveryResult {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const publicSpaces = ref<SpaceInfo[]>([])
  const searchResults = ref<SpaceInfo[]>([])
  const statistics = ref<SpaceStatistics | null>(null)
  const userSpaces = ref<SpaceInfo[]>([])

  const loadPublicSpaces = async (limit?: number) => {
    loading.value = true
    error.value = null
    try {
      const result = await matrixSpaceService.getPublicSpaces(limit ?? 50)
      publicSpaces.value = result
    } catch (err) {
      logger.error('load public spaces failed', err)
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  const searchSpaces = async (query: string, limit?: number) => {
    if (!query.trim()) {
      searchResults.value = []
      return
    }
    loading.value = true
    error.value = null
    try {
      const result = await matrixSpaceService.searchSpacesViaApi(query, limit ?? 20)
      searchResults.value = result
    } catch (err) {
      logger.error('search spaces failed', err)
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  const loadStatistics = async () => {
    loading.value = true
    error.value = null
    try {
      const result = await matrixSpaceService.getSpaceStatistics()
      statistics.value = {
        totalSpaces: (result.total_spaces as number) ?? (result.totalSpaces as number) ?? 0,
        totalMembers: (result.total_members as number) ?? (result.totalMembers as number) ?? 0,
        totalRooms: (result.total_rooms as number) ?? (result.totalRooms as number) ?? 0,
        ...result
      }
    } catch (err) {
      logger.error('load statistics failed', err)
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  const loadUserSpaces = async () => {
    loading.value = true
    error.value = null
    try {
      const result = await matrixSpaceService.getUserSpacesViaApi()
      userSpaces.value = result
    } catch (err) {
      logger.error('load user spaces failed', err)
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    publicSpaces,
    searchResults,
    statistics,
    userSpaces,
    loadPublicSpaces,
    searchSpaces,
    loadStatistics,
    loadUserSpaces
  }
}
