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
            <p class="example">{{ t('mobile_setting.homeserver_example') }}: http://localhost:8008</p>
          </div>
        </div>

        <div class="mt-16px">
          <van-button type="primary" block :loading="saving" @click="handleSave">
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
  isValidHttpUrl,
  normalizeHttpUrl,
  resolveMatrixEndpointConfig,
  saveMatrixHomeserverUrl
} from '@/services/backend'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('HomeserverSettings')

const { t } = useI18n()

const homeserverUrl = ref('')
const saving = ref(false)

onMounted(() => {
  homeserverUrl.value = resolveMatrixEndpointConfig().homeserverUrl
})

async function handleSave() {
  if (!homeserverUrl.value.trim()) {
    showToast({
      type: 'fail',
      message: t('mobile_setting.homeserver_empty')
    })
    return
  }

  const url = normalizeHttpUrl(homeserverUrl.value)

  if (!isValidHttpUrl(url)) {
    showToast({
      type: 'fail',
      message: t('mobile_setting.homeserver_invalid')
    })
    return
  }

  saving.value = true

  try {
    homeserverUrl.value = saveMatrixHomeserverUrl(url)
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
  color: #323233;
  margin-bottom: 8px;
}

.config-hint {
  font-size: 12px;
  color: #969799;
  line-height: 1.6;
}

.config-hint .example {
  margin-top: 4px;
  color: #646566;
}
</style>
