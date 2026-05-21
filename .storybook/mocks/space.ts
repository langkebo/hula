import { ref } from 'vue'

export const useSpace = () => ({
  space: ref(null),
  load: async () => undefined,
  update: async () => true,
  mutating: ref(false),
  getTreePath: async () => [],
  getHierarchy: async () => ({
    rooms: [],
    next_batch: undefined
  })
})

export const useSpaceMembers = () => ({
  invite: async () => true,
  mutating: ref(false)
})

export const useSpaceRooms = () => ({
  addRoom: async () => true,
  mutating: ref(false)
})
