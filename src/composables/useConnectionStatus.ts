import { computed, ref } from 'vue'
import { useMatrixStore } from '@/stores/domains/chat/matrix'

export type ConnectionState = 'online' | 'offline' | 'connecting' | 'reconnecting' | 'syncing' | 'error' | 'idle'

export function useConnectionStatus() {
  const matrixStore = useMatrixStore()
  const retryCount = ref(0)

  const state = computed<ConnectionState>(() => {
    const cs = matrixStore.connectionState
    switch (cs) {
      case 'CONNECTED':
        return 'online'
      case 'CONNECTING':
        // 未初始化时为首次登录，不应显示"正在重新连接"横幅
        if (!matrixStore.isInitialized) {
          return 'idle'
        }
        return 'connecting'
      case 'RECONNECTING':
        return 'reconnecting'
      case 'CATCHUP':
        // CATCHUP 是 SDK 从断开恢复后同步历史消息的瞬态
        // UI 显示"正在同步历史消息"提示（非阻塞，带 spinner）
        return 'syncing'
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
