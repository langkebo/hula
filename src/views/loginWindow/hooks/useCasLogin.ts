import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { resolveMatrixRuntimeEndpointConfig } from '@/services/backend'
import { MatrixAuthService } from '@/services/matrix/auth/MatrixAuthService'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { isDesktop } from '@/utils/PlatformConstants'

const CAS_LOGIN_TOKEN_EVENT = 'cas-login-token'

const logger = createLogger('useCasLogin')

/**
 * 桌面端 CAS 单点登录编排。
 *
 * 能力探测与入口渲染只发生在桌面端且有 Tauri 运行时的情况下，
 * 移动端/浏览器环境不会渲染 CAS 入口，也不会触发 Tauri 命令。
 */
export function useCasLogin(options: { onToken: (loginToken: string) => Promise<void> }) {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const casAvailable = ref(false)
  let unlisten: UnlistenFn | undefined

  const canUseCasWindow = () => isDesktop() && hasTauriRuntime()

  const detect = async () => {
    if (!canUseCasWindow()) {
      casAvailable.value = false
      return
    }
    try {
      casAvailable.value = await MatrixAuthService.hasCasLoginFlow()
    } catch (error) {
      logger.info('CAS 能力探测失败，隐藏入口:', error)
      casAvailable.value = false
    }
  }

  const registerListener = async () => {
    try {
      unlisten = await listen<string>(CAS_LOGIN_TOKEN_EVENT, (event) => {
        void options.onToken(event.payload)
      })
    } catch (error) {
      logger.warn('注册 CAS 登录 token 监听失败:', error)
    }
  }

  const startCasLogin = async () => {
    if (!casAvailable.value) {
      return
    }
    if (!hasTauriRuntime()) {
      showFeedback(t('login.cas.failed'), 'error')
      return
    }
    try {
      const loginUrl = await MatrixAuthService.getCasLoginUrl('/')
      const homeserverOrigin = resolveMatrixRuntimeEndpointConfig().homeserverUrl
      await invoke('open_cas_login_window', { loginUrl, homeserverOrigin })
    } catch (error) {
      logger.error('打开 CAS 登录窗口失败:', error)
      showFeedback(t('login.cas.failed'), 'error')
    }
  }

  onBeforeUnmount(() => {
    unlisten?.()
    unlisten = undefined
  })

  return { casAvailable, detect, registerListener, startCasLogin }
}
