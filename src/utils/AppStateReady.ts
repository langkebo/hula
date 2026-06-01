import { listen } from '@tauri-apps/api/event'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { invokeWithResult } from '@/utils/TauriInvokeHandler'

const logger = createLogger('AppStateReady')

/**
 * 统一管理 后端状态是否可用 的判定，避免在AppData尚未注入时调用 tauri command。
 * 先通过 `is_app_state_ready` 查询一次，如果仍未就绪则监听 `app-state-ready` 事件再继续。
 */
let isReady = false
let pendingPromise: Promise<void> | null = null
const APP_STATE_READY_TIMEOUT_MS = 10_000

/**
 * 等待一次后端广播的 ready 事件。事件触发后即解除监听，并允许后续调用直接读取缓存结果。
 */
const waitForReadyEvent = () =>
  new Promise<void>((resolve) => {
    let cleanup: (() => void) | null = null
    let settled = false
    const timer = setTimeout(() => {
      logger.warn(`等待 app-state-ready 超时 (${APP_STATE_READY_TIMEOUT_MS}ms)，继续执行`)
      finish(false)
    }, APP_STATE_READY_TIMEOUT_MS)

    function finish(ready: boolean) {
      if (settled) return
      settled = true
      if (ready) {
        isReady = true
      }
      clearTimeout(timer)
      if (cleanup) {
        cleanup()
        cleanup = null
      }
      pendingPromise = null
      resolve()
    }

    listen('app-state-ready', () => {
      finish(true)
    })
      .then((unlisten) => {
        if (settled) {
          unlisten()
          return
        }
        cleanup = unlisten
      })
      .catch((error) => {
        logger.warn('Failed to register listener:', error)
        finish(false)
      })
  })

/**
 * 确保在调用任何依赖后台状态的命令前，Rust 端已经完成初始化。
 * 如果前端在等待期间被多次调用，会复用同一个 Promise，避免重复监听。
 */
export const ensureAppStateReady = async () => {
  if (isReady) {
    return
  }

  // Browser-only runs have no native app-state lifecycle to wait for.
  if (typeof window !== 'undefined' && !hasTauriRuntime()) {
    isReady = true
    return
  }

  const result = await invokeWithResult<boolean>('is_app_state_ready')
  if (result.isOk() && result.value) {
    isReady = true
    return
  }

  if (!pendingPromise) {
    pendingPromise = waitForReadyEvent()
  }

  await pendingPromise
}
