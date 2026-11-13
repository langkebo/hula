<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_setting.homeserver')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full p-16px">
        <div class="homeserver-config">
          <div class="config-item">
            <div class="config-label">{{ t('mobile_setting.homeserver_url') }}</div>
            <van-field
              v-model="homeserverUrl"
              :placeholder="t('mobile_setting.homeserver_placeholder')"
              clearable
              @keyup.enter="handleSave" />
          </div>
          <div class="config-hint">
            <p>{{ t('mobile_setting.homeserver_hint') }}</p>
            <p class="example">{{ t('mobile_setting.homeserver_example') }}: {{ MATRIX_DEFAULT_HOMESERVER_EXAMPLE }}</p>
          </div>
        </div>

        <div class="mt-16px flex gap-12px">
          <van-button class="flex-1" block :loading="testing" :disabled="saving" @click="handleTest">
            {{ t('mobile_setting.homeserver_test') }}
          </van-button>
          <van-button class="flex-1" type="primary" block :loading="saving" :disabled="testing" @click="handleSave">
            {{ t('mobile_setting.save') }}
          </van-button>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { showToast } from 'vant'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  discoverAndSaveMatrixEndpoints,
  isPotentialHomeserverInput,
  MATRIX_DEFAULT_HOMESERVER_EXAMPLE,
  probeMatrixHomeserver,
  resolveMatrixEndpointConfig,
  saveMatrixIdentityServerUrl
} from '@/services/backend'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('HomeserverSettings')

const { t } = useI18n()

const homeserverUrl = ref('')
const saving = ref(false)
const testing = ref(false)

onMounted(() => {
  homeserverUrl.value = resolveMatrixEndpointConfig().homeserverUrl
})

/** 只探测连通性，不落库：用户可以先验证地址再决定是否保存（T-22） */
async function handleTest() {
  const rawValue = homeserverUrl.value.trim()
  if (!rawValue || !isPotentialHomeserverInput(rawValue)) {
    showToast({
      type: 'fail',
      message: t('mobile_setting.homeserver_invalid')
    })
    return
  }

  testing.value = true

  try {
    const result = await probeMatrixHomeserver(rawValue)
    showToast({
      type: 'success',
      message: t('mobile_setting.homeserver_test_ok', { versions: result.versions.slice(0, 2).join(', ') })
    })
  } catch (error) {
    logger.error('Failed to probe homeserver', error)
    showToast({
      type: 'fail',
      message: t('mobile_setting.homeserver_test_failed')
    })
  } finally {
    testing.value = false
  }
}

async function handleSave() {
  if (!homeserverUrl.value.trim()) {
    showToast({
      type: 'fail',
      message: t('mobile_setting.homeserver_empty')
    })
    return
  }

  const rawValue = homeserverUrl.value.trim()

  if (!isPotentialHomeserverInput(rawValue)) {
    showToast({
      type: 'fail',
      message: t('mobile_setting.homeserver_invalid')
    })
    return
  }

  saving.value = true

  try {
    const discovery = await discoverAndSaveMatrixEndpoints(rawValue, resolveMatrixEndpointConfig())
    homeserverUrl.value = discovery.homeserverUrl
    if (!discovery.identityServerUrl) {
      saveMatrixIdentityServerUrl('')
    }
    showToast({
      type: 'success',
      message: t('mobile_setting.homeserver_saved')
    })
  } catch (error) {
    logger.error('Failed to save homeserver', error)
    showToast({
      type: 'fail',
      message: t('mobile_setting.homeserver_save_failed')
    })
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.homeserver-config {
  padding: 8px 0;
}

.config-item {
  margin-bottom: 16px;
}

.config-label {
  font-size: 14px;
  color: var(--tjg-text-primary);
  margin-bottom: 8px;
}

.config-hint {
  font-size: 12px;
  color: var(--tjg-text-tertiary);
  line-height: 1.6;
}

.config-hint .example {
  margin-top: 4px;
  color: var(--tjg-text-secondary);
}
</style>
