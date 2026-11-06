import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { WEB_SESSION_FALLBACK_STORAGE_KEY } from '@/utils/storageKeys'

const logger = createLogger('MatrixClient')

/**
 * 浏览器（非 Tauri）运行期的 access token 落盘 key。
 *
 * 为什么需要：Rust 侧 `update_token` 只在 Tauri 运行期可用；浏览器 dev / E2E 冷启动
 * 恢复会话时必须有个 at-rest 凭证来源。此前该职责被**pinia 的 persist.pick** 顺手承担，
 * 导致 token 混在应用状态里、且刷新后不更新（副本陈旧）。
 *
 * 现在把它收敛成**唯一的浏览器 at-rest 凭证**，并由 `persistRefreshedToken` /
 * 登录路径主动写入（刷新即更新），不再依赖 pinia 快照。
 */
const WEB_TOKEN_STORAGE_KEY = 'tjg.matrix.accessToken'

/**
 * 「强制启用浏览器 at-rest 凭证」开关。
 *
 * 默认语义不变：真机 Tauri 由 Rust 保管凭证，localStorage 不落 token。
 * 但有两种场景 `hasTauriRuntime()` 为真、Rust 存储却实际不可用：
 *  1. 浏览器里的 Tauri shim（e2e `installBrowserTauriShim` 会伪造 `__TAURI_INTERNALS__`）；
 *  2. 宿主 WebView 注入了 shim 但没带真实 Rust 命令。
 * 这两种场景下刷新页面必掉登录（读 IPC 拿不到 token）。显式打开这个开关后，
 * localStorage 作为**回退凭证源**参与读写 —— 代价是 XSS 可窃取 token，
 * 因此默认关闭，只能由开发/测试显式置 1。
 */
export const WEB_SESSION_FALLBACK_KEY = WEB_SESSION_FALLBACK_STORAGE_KEY

/** 当前是否启用「浏览器 at-rest 凭证」读写 */
export function isWebSessionStoreEnabled(): boolean {
  if (!hasTauriRuntime()) return true
  if (typeof globalThis.localStorage === 'undefined') return false
  try {
    return globalThis.localStorage.getItem(WEB_SESSION_FALLBACK_KEY) === '1'
  } catch {
    return false
  }
}

/** 读取浏览器 at-rest token（Tauri 原生运行期恒为 null，凭证由 Rust 侧保管） */
export function readWebAccessToken(): string | null {
  if (!isWebSessionStoreEnabled()) return null
  if (typeof globalThis.localStorage === 'undefined') return null
  try {
    return globalThis.localStorage.getItem(WEB_TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

/**
 * 写入（或清除）浏览器 at-rest token。Tauri 运行期是 no-op —— 凭证只由 Rust 保管。
 *
 * @param token 传 null 表示登出时清除
 */
export function persistWebAccessToken(token: string | null): void {
  if (!isWebSessionStoreEnabled()) return
  if (typeof globalThis.localStorage === 'undefined') return
  try {
    if (token) {
      globalThis.localStorage.setItem(WEB_TOKEN_STORAGE_KEY, token)
    } else {
      globalThis.localStorage.removeItem(WEB_TOKEN_STORAGE_KEY)
    }
  } catch (error) {
    // 隐私模式/配额满时静默降级，不阻塞登录；但必须留痕，避免又一处「静默失效」
    logger.warn('Failed to persist web access token:', error)
  }
}

export async function persistRefreshedToken(uid: string, token: string, refreshToken: string): Promise<void> {
  // 浏览器无 Rust 侧存储：写到 localStorage，保证刷新后的 token 也是最新值
  if (isWebSessionStoreEnabled()) {
    persistWebAccessToken(token)
    return
  }
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('update_token', {
    req: {
      uid,
      token,
      refreshToken
    }
  })
}

export async function logoutExpiredSession(): Promise<void> {
  const { sessionOrchestrator } = await import('./auth/SessionOrchestrator')
  await sessionOrchestrator.logoutCurrentSession({ resetLocalState: true, preserveTokens: false })
}

/**
 * 注册系统唤醒（system-resumed）监听器。
 *
 * @returns 取消订阅函数。必须在客户端停止 / 实例切换时调用，否则每次
 * `startClient()` 都会叠加一层监听器，一次系统唤醒会触发 N 次重连。
 */
export function setupSystemResumeListener(onResume: () => void): () => void {
  if (!hasTauriRuntime()) {
    return () => {}
  }

  let disposed = false
  let unlisten: (() => void) | null = null

  import('@tauri-apps/api/event')
    .then(({ listen }) =>
      listen('system-resumed', () => {
        if (disposed) {
          return
        }
        logger.info('[LIFECYCLE] System resumed, reconnecting Matrix sync')
        onResume()
      })
    )
    .then((off) => {
      // 取消订阅可能早于 listen() resolve（异步注册），此时立即注销。
      if (disposed) {
        off()
        return
      }
      unlisten = off
    })
    .catch((err) => {
      logger.warn('Failed to listen for system-resumed event:', err)
    })

  return () => {
    disposed = true
    if (unlisten) {
      unlisten()
      unlisten = null
    }
  }
}
