/**
 * 房间标签管理 Composable
 *
 * 提供房间标签的响应式状态和操作方法
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { matrixTagService, type RoomTagInfo, SdkTagEvent } from '@/services/matrix/MatrixTagService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useRoomTags')

export function useRoomTags(roomId: string) {
  const isFavorite = ref(false)
  const isLowPriority = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const tagInfo = computed<RoomTagInfo>(() => ({
    name: roomId,
    isFavorite: isFavorite.value,
    isLowPriority: isLowPriority.value
  }))

  const hasTags = computed(() => isFavorite.value || isLowPriority.value)

  async function loadTags(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const info = await matrixTagService.getRoomTagInfo(roomId)
      isFavorite.value = info.isFavorite
      isLowPriority.value = info.isLowPriority
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载标签失败'
      logger.error('加载标签失败:', e)
    } finally {
      loading.value = false
    }
  }

  async function toggleFavorite(): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      const newState = await matrixTagService.toggleFavorite(roomId)
      isFavorite.value = newState
      return newState
    } catch (e) {
      error.value = e instanceof Error ? e.message : '切换收藏失败'
      logger.error('切换收藏失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function toggleLowPriority(): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      const newState = await matrixTagService.toggleLowPriority(roomId)
      isLowPriority.value = newState
      return newState
    } catch (e) {
      error.value = e instanceof Error ? e.message : '切换低优先级失败'
      logger.error('切换低优先级失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function addToFavorites(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      await matrixTagService.addToFavorites(roomId)
      isFavorite.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : '添加收藏失败'
      logger.error('添加收藏失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function removeFromFavorites(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      await matrixTagService.removeFromFavorites(roomId)
      isFavorite.value = false
    } catch (e) {
      error.value = e instanceof Error ? e.message : '移除收藏失败'
      logger.error('移除收藏失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function addToLowPriority(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      await matrixTagService.addToLowPriority(roomId)
      isLowPriority.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : '添加低优先级失败'
      logger.error('添加低优先级失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function removeFromLowPriority(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      await matrixTagService.removeFromLowPriority(roomId)
      isLowPriority.value = false
    } catch (e) {
      error.value = e instanceof Error ? e.message : '移除低优先级失败'
      logger.error('移除低优先级失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  function handleTagAdded(changedRoomId: string, ...args: unknown[]): void {
    if (changedRoomId !== roomId) return

    const tag = args[0] as string
    if (tag === 'm.favourite') {
      isFavorite.value = true
    } else if (tag === 'm.lowpriority') {
      isLowPriority.value = true
    }
  }

  function handleTagRemoved(changedRoomId: string, ...args: unknown[]): void {
    if (changedRoomId !== roomId) return

    const tag = args[0] as string
    if (tag === 'm.favourite') {
      isFavorite.value = false
    } else if (tag === 'm.lowpriority') {
      isLowPriority.value = false
    }
  }

  onMounted(() => {
    loadTags()
    matrixTagService.on(SdkTagEvent.TagAdded, handleTagAdded)
    matrixTagService.on(SdkTagEvent.TagRemoved, handleTagRemoved)
  })

  onUnmounted(() => {
    matrixTagService.off(SdkTagEvent.TagAdded, handleTagAdded)
    matrixTagService.off(SdkTagEvent.TagRemoved, handleTagRemoved)
  })

  return {
    isFavorite,
    isLowPriority,
    loading,
    error,
    tagInfo,
    hasTags,
    loadTags,
    toggleFavorite,
    toggleLowPriority,
    addToFavorites,
    removeFromFavorites,
    addToLowPriority,
    removeFromLowPriority
  }
}

export function useRoomTagsList() {
  const favoriteRooms = ref<string[]>([])
  const lowPriorityRooms = ref<string[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const stats = computed(() => ({
    favoriteCount: favoriteRooms.value.length,
    lowPriorityCount: lowPriorityRooms.value.length,
    totalTagged: favoriteRooms.value.length + lowPriorityRooms.value.length
  }))

  async function loadAllTags(): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const [favorites, lowPriority] = await Promise.all([
        matrixTagService.getFavoriteRooms(),
        matrixTagService.getLowPriorityRooms()
      ])

      favoriteRooms.value = favorites
      lowPriorityRooms.value = lowPriority
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载标签列表失败'
      logger.error('加载标签列表失败:', e)
    } finally {
      loading.value = false
    }
  }

  function isFavorite(roomId: string): boolean {
    return favoriteRooms.value.includes(roomId)
  }

  function isLowPriority(roomId: string): boolean {
    return lowPriorityRooms.value.includes(roomId)
  }

  onMounted(() => {
    loadAllTags()
  })

  return {
    favoriteRooms,
    lowPriorityRooms,
    loading,
    error,
    stats,
    loadAllTags,
    isFavorite,
    isLowPriority
  }
}
