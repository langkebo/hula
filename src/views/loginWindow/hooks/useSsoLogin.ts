import { invoke } from '@tauri-apps/api/core'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { openExternalUrl } from '@/composables/common/useLinkSegments'
import { resolveMatrixRuntimeEndpointConfig } from '@/services/backend'
import { MatrixAuthService, type SsoIdentityProvider } from '@/services/matrix/auth/MatrixAuthService'
import { matrixOidcService } from '@/services/matrix/auth/MatrixOidcService'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { isDesktop } from '@/utils/PlatformConstants'

const logger = createLogger('useSsoLogin')

/**
 * 服务端 SSO 入口编排（CAP-03 / AUTH-01）。
 *
 * 入口是否渲染完全由服务端声明驱动：
 * - `m.login.sso` flow 存在 ⇒ 渲染通用 SSO 入口（`/login/sso/redirect`）；
 * - `auth_metadata` 探测成功（MSC2965）⇒ 同样视为服务端具备 SSO 能力。
 *
 * 两者都为否（含 404 / `M_UNRECOGNIZED`）时入口保持隐藏，不渲染死按钮。
 * 登录后的 `loginToken` 回传由 `useSsoCallback` 消费，二者配对使用。
 */
export function useSsoLogin() {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const ssoAvailable = ref(false)
  const ssoProviders = ref<SsoIdentityProvider[]>([])
  const oidcAvailable = ref(false)

  const detect = async () => {
    try {
      const [flow, metadata] = await Promise.all([
        MatrixAuthService.getSsoLoginFlow(),
        matrixOidcService.probeAuthMetadata()
      ])
      ssoProviders.value = flow.providers
      oidcAvailable.value = metadata.supported
      ssoAvailable.value = flow.supported || metadata.supported
    } catch (error) {
      logger.info('SSO 能力探测失败，隐藏入口:', error)
      ssoProviders.value = []
      oidcAvailable.value = false
      ssoAvailable.value = false
    }
  }

  /**
   * 打开 SSO 登录。
   *
   * - 桌面端 Tauri：复用 CAS 登录窗口（同源校验 + 拦截 `loginToken` 回传），
   *   因为该窗口已实现「导航回传 token」的桥接；
   * - 其他环境：用系统浏览器打开，回调由 `useSsoCallback` 消费 URL 上的 token。
   */
  const startSsoLogin = async (idpId?: string) => {
    if (!ssoAvailable.value) {
      return
    }
    try {
      const targetUrl = await MatrixAuthService.buildSsoLoginUrl('/', idpId)
      if (isDesktop() && hasTauriRuntime()) {
        const homeserverOrigin = resolveMatrixRuntimeEndpointConfig().homeserverUrl
        await invoke('open_cas_login_window', { loginUrl: targetUrl, homeserverOrigin })
        return
      }
      await openExternalUrl(targetUrl)
    } catch (error) {
      logger.error('打开 SSO 登录失败:', error)
      showFeedback(t('login.sso.failed'), 'error')
    }
  }

  return { ssoAvailable, ssoProviders, oidcAvailable, detect, startSsoLogin }
}
