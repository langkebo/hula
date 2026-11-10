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
          // 已登录（有持久化会话）却无 client：整页重载/进程重建后恢复失败。
          // 必须显式提示断线，否则用户只看到旧缓存且无任何线索（D12）。
          return matrixStore.isLoggedIn ? 'error' : 'idle'
        }
        return 'offline'
      default:
        return 'idle'
    }
  })

  const retry = async () => {
    retryCount.value++
    try {
      if (!matrixStore.isInitialized) {
        // 冷启动恢复失败时 client 尚未建立，startClient 会直接抛错；
        // 必须走会话恢复（读凭证 + 初始化 client）路径（D12）。
        const { sessionOrchestrator } = await import('@/services/matrix/auth/SessionOrchestrator')
        await sessionOrchestrator.ensureClientReady()
      } else {
        await matrixStore.startClient()
      }
    } catch {
      // retry failed, state will update via computed
    }
  }

  return { state, retryCount, retry }
}
