import { onMounted, onUnmounted, ref } from 'vue'
import {
  type ConnectionState as MatrixConnectionState,
  matrixClientService
} from '@/services/matrix/MatrixClientService'

export type ConnectionState = 'online' | 'offline' | 'reconnecting' | 'error'

export function useConnectionStatus() {
  const state = ref<ConnectionState>('online')
  const retryCount = ref(0)

  let onlineHandler: (() => void) | null = null
  let offlineHandler: (() => void) | null = null

  const handleOnline = () => {
    // 只有当当前状态是 offline 时，才切换到 online
    // 否则保持 matrixClientService 触发的状态（如 reconnecting）
    if (state.value === 'offline') {
      state.value = 'online'
    }
    retryCount.value = 0
  }

  const handleOffline = () => {
    state.value = 'offline'
  }

  const handleMatrixConnectionChange = (data: unknown) => {
    const { state: matrixState } = data as { state: MatrixConnectionState }
    switch (matrixState) {
      case 'CONNECTED':
        state.value = 'online'
        retryCount.value = 0
        break
      case 'CONNECTING':
      case 'RECONNECTING':
        state.value = 'reconnecting'
        break
      case 'ERROR':
        state.value = 'error'
        break
      case 'DISCONNECTED':
        // 如果浏览器是在线的，但 Matrix 断开了，可能是在初始化或登出
        // 只有在浏览器离线时才显示 offline
        if (!navigator.onLine) {
          state.value = 'offline'
        }
        break
    }
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

    matrixClientService.on('connectionState', handleMatrixConnectionChange)

    // 初始化状态
    if (!navigator.onLine) {
      state.value = 'offline'
    } else {
      handleMatrixConnectionChange({ state: matrixClientService.getConnectionState() })
    }
  })

  onUnmounted(() => {
    if (onlineHandler) window.removeEventListener('online', onlineHandler)
    if (offlineHandler) window.removeEventListener('offline', offlineHandler)
    matrixClientService.off('connectionState', handleMatrixConnectionChange)
  })

  return {
    state,
    retryCount,
    retry
  }
}
