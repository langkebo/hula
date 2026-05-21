import { computed, ref } from 'vue'
import { useMatrixStore } from '@/stores/domains/chat/matrix'

export type ConnectionState = 'online' | 'offline' | 'reconnecting' | 'error'

export function useConnectionStatus() {
  const matrixStore = useMatrixStore()
  const retryCount = ref(0)

  const state = computed<ConnectionState>(() => {
    const cs = matrixStore.connectionState
    switch (cs) {
      case 'CONNECTED':
        return 'online'
      case 'CONNECTING':
        return 'reconnecting'
      case 'ERROR':
        return 'error'
      default:
        return 'offline'
    }
  })

  const retry = async () => {
    retryCount.value++
    try {
      await matrixStore.startClient()
    } catch {
      // retry failed, state will update via computed
    }
  }

  return { state, retryCount, retry }
}
