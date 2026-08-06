<template>
  <n-modal v-model:show="show" preset="card" :title="t('login.server_config.title')" :style="{ width: '400px' }">
    <n-flex vertical :size="12">
      <n-form-item label="Homeserver URL">
        <n-input v-model:value="homeserverUrl" :placeholder="DEFAULT_MATRIX_HOMESERVER_URL" clearable />
      </n-form-item>
      <n-form-item label="Identity Server URL">
        <n-input
          v-model:value="identityServerUrl"
          :placeholder="DEFAULT_MATRIX_IDENTITY_SERVER_URL || t('login.server_config.identity_placeholder')"
          clearable />
      </n-form-item>
      <n-alert type="info" :bordered="false">{{ t('login.server_config.restart_hint') }}</n-alert>
      <n-flex justify="end">
        <n-button @click="resetServerConfig">{{ t('login.server_config.reset') }}</n-button>
        <n-button @click="show = false">{{ t('login.server_config.cancel') }}</n-button>
        <n-button type="primary" @click="saveServerConfig">{{ t('login.server_config.save') }}</n-button>
      </n-flex>
    </n-flex>
  </n-modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import {
  DEFAULT_MATRIX_HOMESERVER_URL,
  DEFAULT_MATRIX_IDENTITY_SERVER_URL,
  discoverAndSaveMatrixEndpoints,
  isPotentialHomeserverInput,
  isValidHttpUrl,
  saveMatrixHomeserverUrl,
  saveMatrixIdentityServerUrl
} from '@/services/backend'
import { createLogger } from '@/utils/Logger'

const { t } = useI18n()
const logger = createLogger('ServerConfigModal')
const { showFeedback } = useActionFeedback()

const show = defineModel<boolean>('show', { required: true })
const homeserverUrl = defineModel<string>('homeserverUrl', { required: true })
const identityServerUrl = defineModel<string>('identityServerUrl', { required: true })

const saveServerConfig = () => {
  const rawHomeserverValue = (homeserverUrl.value || DEFAULT_MATRIX_HOMESERVER_URL).trim()
  const rawIdentityServerUrl = identityServerUrl.value.trim()

  if (!isPotentialHomeserverInput(rawHomeserverValue)) {
    showFeedback(t('login.server_config.homeserver_invalid'), 'warning')
    return
  }

  if (
    rawIdentityServerUrl &&
    !isValidHttpUrl(rawIdentityServerUrl) &&
    !isValidHttpUrl(`http://${rawIdentityServerUrl}`)
  ) {
    showFeedback(t('login.server_config.identity_invalid'), 'warning')
    return
  }

  void (async () => {
    try {
      const discovery = await discoverAndSaveMatrixEndpoints(rawHomeserverValue, {
        homeserverUrl: DEFAULT_MATRIX_HOMESERVER_URL,
        identityServerUrl: rawIdentityServerUrl || DEFAULT_MATRIX_IDENTITY_SERVER_URL
      })
      homeserverUrl.value = discovery.homeserverUrl
      identityServerUrl.value = rawIdentityServerUrl
        ? saveMatrixIdentityServerUrl(rawIdentityServerUrl)
        : discovery.identityServerUrl
      show.value = false
      showFeedback(t('login.server_config.save_success'), 'success')
    } catch (error) {
      logger.error('Failed to save homeserver config', error)
      showFeedback(t('login.server_config.save_failed'), 'error')
    }
  })()
}

const resetServerConfig = () => {
  homeserverUrl.value = saveMatrixHomeserverUrl(DEFAULT_MATRIX_HOMESERVER_URL)
  identityServerUrl.value = saveMatrixIdentityServerUrl(DEFAULT_MATRIX_IDENTITY_SERVER_URL)
  showFeedback(t('login.server_config.reset_success'), 'success')
}
</script>
