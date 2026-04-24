import { ref, onMounted, onUnmounted } from 'vue'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import type { ConnectionState } from '@/components/common/ConnectionStatusBanner.vue'

export function useConnectionStatus() {
  const state = ref<ConnectionState>('online')
  const retryCount = ref(0)

  let onlineHandler: (() => void) | null = null
  let offlineHandler: (() => void) | null = null

  const handleOnline = () => {
    state.value = 'online'
    retryCount.value = 0
  }

  const handleOffline = () => {
    state.value = 'offline'
  }

  const retry = () => {
    state.value = 'reconnecting'
    retryCount.value++
    const client = matrixClientService.getClient()
    if (client) {
      try {
        ;(client as unknown as { retryImmediately?: () => void }).retryImmediately?.()
      } catch {
        state.value = 'error'
      }
    } else {
      state.value = 'error'
    }
  }

  onMounted(() => {
    onlineHandler = handleOnline
    offlineHandler = handleOffline
    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)

    if (!navigator.onLine) {
      state.value = 'offline'
    }
  })

  onUnmounted(() => {
    if (onlineHandler) window.removeEventListener('online', onlineHandler)
    if (offlineHandler) window.removeEventListener('offline', offlineHandler)
  })

  return {
    state,
    retryCount,
    retry
  }
}
