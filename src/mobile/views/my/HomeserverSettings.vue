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
import { createLogger } from '@/utils/Logger'
import { ref, onMounted } from 'vue'
import { showToast } from 'vant'
import { useI18n } from 'vue-i18n'

const logger = createLogger('HomeserverSettings')

const { t } = useI18n()

const homeserverUrl = ref('')
const saving = ref(false)

onMounted(() => {
  const saved = localStorage.getItem('hula-homeserver-url')
  homeserverUrl.value = saved || import.meta.env.VITE_HOMESERVER_URL || 'http://localhost:8008'
})

async function handleSave() {
  if (!homeserverUrl.value.trim()) {
    showToast({
      type: 'fail',
      message: t('mobile_setting.homeserver_empty')
    })
    return
  }

  let url = homeserverUrl.value.trim()
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'http://' + url
  }

  try {
    new URL(url)
  } catch {
    showToast({
      type: 'fail',
      message: t('mobile_setting.homeserver_invalid')
    })
    return
  }

  saving.value = true

  try {
    localStorage.setItem('hula-homeserver-url', url)
    showToast({
      type: 'success',
      message: t('mobile_setting.homeserver_saved')
    })
  } catch (error) {
    logger.error('保存 homeserver 失败:', error)
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
