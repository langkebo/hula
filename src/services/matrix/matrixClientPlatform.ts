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

export function setupSystemResumeListener(onResume: () => void): void {
  if (!(typeof window !== 'undefined' && '__TAURI__' in window)) {
    return
  }

  import('@tauri-apps/api/event')
    .then(({ listen }) => {
      listen('system-resumed', () => {
        logger.info('[LIFECYCLE] System resumed, reconnecting Matrix sync')
        onResume()
      }).catch((err) => {
        logger.warn('Failed to listen for system-resumed event:', err)
      })
    })
    .catch((err) => {
      logger.warn('Failed to import Tauri event module:', err)
    })
}
