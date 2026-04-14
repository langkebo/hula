<template>
  <div class="homeserver-settings">
    <div class="settings-section">
      <h3 class="section-title">{{ t('desktop_homeserver.title') }}</h3>
      <p class="section-desc">{{ t('desktop_homeserver.description') }}</p>
    </div>

    <n-divider />

    <div class="settings-section">
      <div class="form-item">
        <div class="form-label">{{ t('desktop_homeserver.server_url') }}</div>
        <n-input
          v-model:value="homeserverUrl"
          :placeholder="t('desktop_homeserver.url_placeholder')"
          clearable
          @keyup.enter="handleSave" />
        <div class="form-hint">
          <p>{{ t('desktop_homeserver.url_hint') }}</p>
          <p class="example">{{ t('desktop_homeserver.url_example') }}: https://matrix.example.com</p>
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('desktop_homeserver.server_info') }}</h3>
      <n-spin :show="loadingInfo">
        <div v-if="serverInfo" class="server-info">
          <div class="info-item">
            <span class="info-label">{{ t('desktop_homeserver.server_name') }}</span>
            <span class="info-value">{{ serverInfo.serverName || '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ t('desktop_homeserver.version') }}</span>
            <span class="info-value">{{ serverInfo.version || '-' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">{{ t('desktop_homeserver.federation') }}</span>
            <n-tag :type="serverInfo.federationEnabled ? 'success' : 'default'">
              {{ serverInfo.federationEnabled ? t('desktop_homeserver.enabled') : t('desktop_homeserver.disabled') }}
            </n-tag>
          </div>
        </div>
        <div v-else-if="!loadingInfo" class="no-info">
          {{ t('desktop_homeserver.no_info') }}
        </div>
      </n-spin>
    </div>

    <n-divider />

    <div class="settings-section">
      <div class="action-buttons">
        <n-button type="primary" :loading="saving" @click="handleSave">
          {{ t('desktop_homeserver.save') }}
        </n-button>
        <n-button @click="handleTestConnection">
          {{ t('desktop_homeserver.test_connection') }}
        </n-button>
        <n-button @click="handleReset">
          {{ t('desktop_homeserver.reset') }}
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NInput, NButton, NDivider, NSpin, NTag, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('HomeserverSettings')

const { t } = useI18n()
const message = useMessage()

const homeserverUrl = ref('')
const saving = ref(false)
const loadingInfo = ref(false)

interface ServerInfo {
  serverName: string
  version: string
  federationEnabled: boolean
}

const serverInfo = ref<ServerInfo | null>(null)

onMounted(async () => {
  loadSavedUrl()
  await fetchServerInfo()
})

function loadSavedUrl() {
  const saved = localStorage.getItem('hula-homeserver-url')
  homeserverUrl.value = saved || import.meta.env.VITE_HOMESERVER_URL || 'http://localhost:8008'
}

async function fetchServerInfo() {
  loadingInfo.value = true
  try {
    const url = homeserverUrl.value.trim()
    if (!url) return

    const response = await fetch(`${url}/_matrix/client/versions`, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    })

    if (response.ok) {
      const data = await response.json()
      serverInfo.value = {
        serverName: new URL(url).hostname,
        version: data.versions?.join(', ') || 'Unknown',
        federationEnabled: true
      }
    }
  } catch (error) {
    logger.error('Failed to fetch server info:', error)
    serverInfo.value = null
  } finally {
    loadingInfo.value = false
  }
}

async function handleSave() {
  if (!homeserverUrl.value.trim()) {
    message.warning(t('desktop_homeserver.url_empty'))
    return
  }

  let url = homeserverUrl.value.trim()
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url
  }

  try {
    new URL(url)
  } catch {
    message.error(t('desktop_homeserver.url_invalid'))
    return
  }

  saving.value = true

  try {
    localStorage.setItem('hula-homeserver-url', url)
    homeserverUrl.value = url
    message.success(t('desktop_homeserver.saved'))
    await fetchServerInfo()
  } catch (error) {
    logger.error('Failed to save homeserver:', error)
    message.error(t('desktop_homeserver.save_failed'))
  } finally {
    saving.value = false
  }
}

async function handleTestConnection() {
  const url = homeserverUrl.value.trim()
  if (!url) {
    message.warning(t('desktop_homeserver.url_empty'))
    return
  }

  try {
    const response = await fetch(`${url}/_matrix/client/versions`, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    })

    if (response.ok) {
      message.success(t('desktop_homeserver.connection_success'))
    } else {
      message.error(t('desktop_homeserver.connection_failed'))
    }
  } catch {
    message.error(t('desktop_homeserver.connection_failed'))
  }
}

function handleReset() {
  homeserverUrl.value = import.meta.env.VITE_HOMESERVER_URL || 'http://localhost:8008'
  localStorage.removeItem('hula-homeserver-url')
  message.info(t('desktop_homeserver.reset_success'))
  fetchServerInfo()
}
</script>

<style scoped>
.homeserver-settings {
  padding: 0 8px;
}

.settings-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
  margin: 0 0 8px 0;
}

.section-desc {
  font-size: 13px;
  color: #999;
  margin: 0;
}

.form-item {
  margin-bottom: 16px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
}

.form-hint {
  font-size: 12px;
  color: #999;
  margin-top: 8px;
  line-height: 1.6;
}

.form-hint .example {
  margin-top: 4px;
  color: #666;
}

.server-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

:deep(.dark) .server-info {
  background-color: rgba(255, 255, 255, 0.05);
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-label {
  font-size: 14px;
  color: #666;
}

:deep(.dark) .info-label {
  color: #aaa;
}

.info-value {
  font-size: 14px;
  font-weight: 500;
}

.no-info {
  text-align: center;
  color: #999;
  padding: 24px;
}

.action-buttons {
  display: flex;
  gap: 12px;
}
</style>
