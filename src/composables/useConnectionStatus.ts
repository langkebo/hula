import { computed, ref } from 'vue'
import { useMatrixStore } from '@/stores/domains/chat/matrix'

export type ConnectionState = 'online' | 'offline' | 'connecting' | 'reconnecting' | 'error' | 'idle'

export function useConnectionStatus() {
  const matrixStore = useMatrixStore()
  const retryCount = ref(0)

  const state = computed<ConnectionState>(() => {
    const cs = matrixStore.connectionState
    switch (cs) {
      case 'CONNECTED':
        return 'online'
      case 'CONNECTING':
        return 'connecting'
      case 'RECONNECTING':
        return 'reconnecting'
      case 'ERROR':
        return 'error'
      case 'DISCONNECTED':
        // 未初始化/未登录时，不应显示为"网络已断开"
        if (!matrixStore.isInitialized) {
          return 'idle'
        }
        return 'offline'
      default:
        return 'idle'
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
