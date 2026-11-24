import { computed, ref } from 'vue'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { isLoginWindow } from '@/utils/windowLabels'

export type ConnectionState = 'online' | 'offline' | 'connecting' | 'reconnecting' | 'syncing' | 'error' | 'idle'

export function useConnectionStatus() {
  const matrixStore = useMatrixStore()
  const retryCount = ref(0)

  const state = computed<ConnectionState>(() => {
    // 登录类窗口（login/register/forgetPassword）不拥有 client，用户在里面的目的是
    // 建立会话而不是消费会话。任何连接提示对它们都是误报 —— 横幅会写成"连接失败"，
    // 而真实情况是"这个窗口本来就不连"。
    if (isLoginWindow()) return 'idle'

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
          // D12：整页重载 / 进程重建后，主窗口有持久化会话却没有 client，必须显式提示断线，
          // 否则用户只看到旧缓存且无任何线索。
          //
          // 但"该不该有 client"必须由**窗口自己声明**（`shouldOwnClient`），不能用
          // 持久化的 `isLoggedIn` 反推：登录窗口会恢复上次登录的 userId，
          // 于是 isLoggedIn 为 true 而 client 本来就不该存在，反推会得出
          // "登录页连接失败"这种与事实相反的结论。
          return matrixStore.shouldOwnClient && matrixStore.isLoggedIn ? 'error' : 'idle'
        }
        return 'offline'
      default:
        return 'idle'
    }
  })

  const retry = async () => {
    // 登录窗口里点"重试"会用残留凭证去恢复一个完整会话 —— 用户以为自己在登录页，
    // 背后却建起了已登录的 client。这里直接拒绝。
    if (isLoginWindow()) return

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
