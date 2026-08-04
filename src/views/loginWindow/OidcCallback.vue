<template>
  <div class="oidc-callback size-full flex-center flex-col gap-24px bg-[--tjg-surface-elevated]">
    <div v-if="status === 'loading'" class="flex-col-center gap-16px">
      <n-spin size="large" />
      <span class="text-14px text-[--tjg-text-secondary]">{{ t('login.oidc.processing') }}</span>
    </div>

    <div v-else-if="status === 'error'" class="flex-col-center gap-16px">
      <n-result status="error" :title="t('login.oidc.error_title')" :description="errorMessage">
        <template #footer>
          <n-space justify="center">
            <n-button @click="goToLogin">{{ t('login.oidc.back_to_login') }}</n-button>
            <n-button type="primary" @click="retry">{{ t('login.oidc.retry') }}</n-button>
          </n-space>
        </template>
      </n-result>
    </div>

    <div v-else-if="status === 'success'" class="flex-col-center gap-16px">
      <n-result status="success" :title="t('login.oidc.success_title')">
        <template #footer>
          <n-space justify="center">
            <n-button type="primary" @click="goToHome">{{ t('login.oidc.go_home') }}</n-button>
          </n-space>
        </template>
      </n-result>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NResult, NSpace, NSpin } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSessionActions } from '@/composables/user/useSessionActions'
import { resolveMatrixEndpointConfig, saveMatrixSessionEndpointConfig } from '@/services/backend/config'
import { matrixOidcService } from '@/services/matrix/auth/MatrixOidcService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('OidcCallback')
const { restoreWithAccessToken, applyDesktopLoginState } = useSessionActions()
const { showFeedback } = useActionFeedback()

const { t } = useI18n()
const router = useRouter()

type CallbackStatus = 'loading' | 'success' | 'error'
const status = ref<CallbackStatus>('loading')
const errorMessage = ref('')

const goToLogin = () => {
  router.push('/login')
}

const goToHome = () => {
  router.push('/home')
}

const retry = () => {
  window.location.reload()
}

const handleOidcCallback = async () => {
  try {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const state = urlParams.get('state')
    const error = urlParams.get('error')
    const errorDescription = urlParams.get('error_description')

    if (error) {
      logger.error('OAuth error:', error, errorDescription)
      status.value = 'error'
      errorMessage.value = errorDescription || error
      return
    }

    if (!code || !state) {
      logger.error('Missing code or state parameter')
      status.value = 'error'
      errorMessage.value = t('login.oidc.missing_params')
      return
    }

    logger.debug('Processing callback...')
    const tokenResponse = await matrixOidcService.handleCallback(code, state)

    if (!tokenResponse) {
      status.value = 'error'
      errorMessage.value = t('login.oidc.token_exchange_failed')
      return
    }

    const matrixTokens = await matrixOidcService.exchangeOidcForMatrixToken(
      tokenResponse.access_token,
      tokenResponse.refresh_token
    )

    if (!matrixTokens) {
      status.value = 'error'
      errorMessage.value = t('login.oidc.matrix_token_failed')
      return
    }

    logger.debug('OIDC login successful, restoring Matrix runtime session...')

    // 将会话绑定到发现的 homeserver
    const homeserverUrl = matrixOidcService.getHomeserverUrl()
    if (homeserverUrl) {
      saveMatrixSessionEndpointConfig({
        homeserverUrl,
        identityServerUrl: resolveMatrixEndpointConfig().identityServerUrl
      })
    }

    await restoreWithAccessToken({
      uid: matrixTokens.user_id,
      accessToken: matrixTokens.access_token,
      refreshToken: matrixTokens.refresh_token,
      persistTokens: true,
      client: 'PC',
      bootstrapAfterRestore: true
    })
    await applyDesktopLoginState()

    status.value = 'success'
    showFeedback(t('login.oidc.login_success'), 'success')

    setTimeout(() => {
      goToHome()
    }, 1500)
  } catch (err) {
    logger.error('Error:', err)
    status.value = 'error'
    errorMessage.value = err instanceof Error ? err.message : t('login.oidc.unknown_error')
  }
}

onMounted(() => {
  handleOidcCallback()
})
</script>

<style scoped>
.oidc-callback {
  min-height: 100vh;
}
</style>
