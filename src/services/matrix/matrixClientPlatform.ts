import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MatrixClient')

export async function persistRefreshedToken(uid: string, token: string, refreshToken: string): Promise<void> {
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
