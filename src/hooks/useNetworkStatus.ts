/**
 * 网络状态监测钩子
 */
import { computed } from 'vue'
import { createSharedComposable, tryOnScopeDispose, useOnline } from '@vueuse/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { useMatrixStore } from '@/stores/matrix'
import { createLogger } from '@/utils/Logger'
const logger = createLogger('NetworkStatus')

export type ConnectionStatus = 'unknown' | 'connected' | 'connecting' | 'disconnected' | 'error'

const useSharedNetworkStatus = createSharedComposable(() => {
  const browserOnline = useOnline()
  const matrixStore = useMatrixStore()

  const wsStatus = computed<ConnectionStatus>(() => {
    const state = matrixStore.connectionState
    switch (state) {
      case 'CONNECTED':
        return 'connected'
      case 'CONNECTING':
      case 'RECONNECTING':
        return 'connecting'
      case 'DISCONNECTED':
        return 'disconnected'
      case 'ERROR':
        return 'error'
      default:
        return 'unknown'
    }
  })

  const wsOnline = computed<boolean | null>(() => {
    const state = matrixStore.connectionState
    if (state === 'DISCONNECTED' && !matrixStore.isInitialized) return null
    return state === 'CONNECTED'
  })

  const isWsConnecting = computed<boolean>(() => {
    const state = matrixStore.connectionState
    return state === 'CONNECTING' || state === 'RECONNECTING'
  })

  const isOnline = computed<boolean>(() => {
    if (!browserOnline.value) return false
    return wsOnline.value !== false
  })

  const isOffline = computed<boolean>(() => !isOnline.value)

  let unlistenNetwork: UnlistenFn | null = null

  const initListeners = async () => {
    try {
      unlistenNetwork = await listen('network-status-changed', (event) => {
        logger.debug('网络状态变化:', event.payload)
      })
    } catch (error) {
      logger.warn('无法设置网络监听器:', error)
    }
  }

  initListeners()

  tryOnScopeDispose(() => {
    if (unlistenNetwork) {
      unlistenNetwork()
      unlistenNetwork = null
    }
  })

  return {
    browserOnline,
    wsStatus,
    wsOnline,
    isWsConnecting,
    isOnline,
    isOffline
  }
})

export const useNetworkStatus = useSharedNetworkStatus
export default useNetworkStatus
