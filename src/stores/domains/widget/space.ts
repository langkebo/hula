import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { matrixSpaceService, type SpaceInfo } from '@/services/matrix/MatrixSpaceService'

export const useSpaceStore = defineStore('space', () => {
  const spaces = ref<SpaceInfo[]>([])
  const activeSpaceId = ref<string | null>(null)
  const isLoading = ref(false)

  const activeSpace = computed(() => spaces.value.find((s) => s.spaceId === activeSpaceId.value) || null)

  async function loadSpaces() {
    isLoading.value = true
    try {
      spaces.value = await matrixSpaceService.getUserSpaces()
    } finally {
      isLoading.value = false
    }
  }

  function setActiveSpace(spaceId: string | null) {
    activeSpaceId.value = spaceId
  }

  async function createSpace(options: {
    name: string
    topic?: string
    visibility?: 'public' | 'private'
    avatarUrl?: string
  }) {
    const space = await matrixSpaceService.createSpace(options)
    if (space) {
      spaces.value.push(space)
    }
    return space
  }

  async function deleteSpace(spaceId: string) {
    await matrixSpaceService.deleteSpace(spaceId)
    spaces.value = spaces.value.filter((s) => s.spaceId !== spaceId)
    if (activeSpaceId.value === spaceId) {
      activeSpaceId.value = null
    }
  }

  return {
    spaces,
    activeSpaceId,
    activeSpace,
    isLoading,
    loadSpaces,
    setActiveSpace,
    createSpace,
    deleteSpace
  }
})
