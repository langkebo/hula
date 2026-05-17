import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { MittEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt'
import router from '@/router'
import { sessionOrchestrator } from '@/services/matrix/auth/SessionOrchestrator'
import { createLogger } from '@/utils/Logger'
import { isDesktop } from '@/utils/PlatformConstants'

const logger = createLogger('useSsoCallback')

export function useSsoCallback(options: {
  loading: Ref<boolean>
  loginText: Ref<string>
  loginDisabled: Ref<boolean>
}) {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const { loading, loginText, loginDisabled } = options

  const handleSsoLoginCallback = async (): Promise<boolean> => {
    const urlParams = new URLSearchParams(window.location.search)
    const loginToken = urlParams.get('loginToken') || urlParams.get('login_token')
    if (!loginToken) {
      return false
    }

    loading.value = true
    loginText.value = t('login.status.logging_in')
    loginDisabled.value = true

    try {
      await sessionOrchestrator.loginWithSsoToken({
        loginToken,
        client: isDesktop() ? 'PC' : 'MOBILE'
      })

      useMitt.emit(MittEnum.MSG_INIT)

      const callbackUrl = new URL(window.location.href)
      callbackUrl.searchParams.delete('loginToken')
      callbackUrl.searchParams.delete('login_token')
      window.history.replaceState({}, '', callbackUrl.toString())

      if (isDesktop()) {
        await sessionOrchestrator.completeDesktopLoginTransition()
      } else {
        await router.push('/mobile/home')
      }
      return true
    } catch (error) {
      logger.error('Failed to complete SSO login callback', error)
      showFeedback(t('login.sso_login_failed'), 'error')
      loading.value = false
      loginDisabled.value = false
      loginText.value = t('login.button.login.default')
      return false
    }
  }

  return {
    handleSsoLoginCallback
  }
}
