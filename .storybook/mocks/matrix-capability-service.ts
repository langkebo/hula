import { computed, ref } from 'vue'

const isLoaded = ref(true)
const canUseFriendList = ref(true)

export const resetMatrixCapabilityServiceMock = () => {
  isLoaded.value = true
  canUseFriendList.value = true
}

export const configureMatrixCapabilityServiceMock = (options: {
  isLoaded?: boolean
  canUseFriendList?: boolean
}) => {
  if (typeof options.isLoaded === 'boolean') {
    isLoaded.value = options.isLoaded
  }

  if (typeof options.canUseFriendList === 'boolean') {
    canUseFriendList.value = options.canUseFriendList
  }
}

export function useServerCapability() {
  return {
    isLoaded: computed(() => isLoaded.value),
    canUseFriendList: computed(() => canUseFriendList.value)
  }
}
