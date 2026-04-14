import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createLogger } from '@/utils/Logger'

const _logger = createLogger('SpaceStore')

export interface Space {
  roomId: string
  name: string
  avatarUrl: string | null
  memberCount: number
  isJoined: boolean
  topic?: string
  childCount?: number
  spaceId?: string
}

export const useSpaceStore = defineStore('space', () => {
  const spaces = ref<Space[]>([])
  const activeSpaceId = ref<string | null>(null)
  const isLoading = ref(false)

  const activeSpace = computed(() => spaces.value.find((s) => s.roomId === activeSpaceId.value))

  const setSpaces = (newSpaces: Space[]) => {
    spaces.value = newSpaces
  }

  const addSpace = (space: Space) => {
    const existingIndex = spaces.value.findIndex((s) => s.roomId === space.roomId)
    if (existingIndex >= 0) {
      spaces.value[existingIndex] = space
    } else {
      spaces.value.push(space)
    }
  }

  const removeSpace = (roomId: string) => {
    const index = spaces.value.findIndex((s) => s.roomId === roomId)
    if (index >= 0) {
      spaces.value.splice(index, 1)
    }
    if (activeSpaceId.value === roomId) {
      activeSpaceId.value = null
    }
  }

  const setActiveSpace = (roomId: string | null) => {
    activeSpaceId.value = roomId
  }

  const clearSpaces = () => {
    spaces.value = []
    activeSpaceId.value = null
  }

  return {
    spaces,
    activeSpaceId,
    activeSpace,
    isLoading,
    setSpaces,
    addSpace,
    removeSpace,
    setActiveSpace,
    clearSpaces
  }
})
