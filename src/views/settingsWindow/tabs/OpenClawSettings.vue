<template>
  <div class="openclaw-settings">
    <div class="settings-section">
      <h3 class="section-title">{{ t('desktop_openclaw.title') }}</h3>
      <p class="section-desc">{{ t('desktop_openclaw.description') }}</p>
    </div>

    <n-divider />

    <div class="settings-section">
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('desktop_openclaw.gateway_url') }}</span>
          <span class="setting-desc">{{ t('desktop_openclaw.gateway_hint') }}</span>
        </div>
        <n-input
          v-model:value="config.gatewayUrl"
          :placeholder="t('desktop_openclaw.gateway_placeholder')"
          style="width: 300px" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('desktop_openclaw.token') }}</span>
          <span class="setting-desc">{{ t('desktop_openclaw.token_hint') }}</span>
        </div>
        <n-input
          v-model:value="config.token"
          type="password"
          :placeholder="t('desktop_openclaw.token_placeholder')"
          show-password-on="click"
          style="width: 300px" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('desktop_openclaw.connection_status') }}</h3>

      <div class="connection-status-display">
        <div class="status-indicator" :class="connectionStatusClass"></div>
        <span class="status-text">{{ connectionStatusText }}</span>
        <n-button size="small" :loading="testing" @click="handleTestConnection">
          {{ t('desktop_openclaw.test_connection') }}
        </n-button>
      </div>

      <div v-if="lastConnectedAt" class="last-connected">
        {{ t('desktop_openclaw.last_connected') }}: {{ lastConnectedAt }}
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">功能设置</h3>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('desktop_openclaw.auto_connect') }}</span>
          <span class="setting-desc">{{ t('desktop_openclaw.auto_connect_desc') }}</span>
        </div>
        <n-switch v-model:value="config.autoConnect" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('desktop_openclaw.enable_viking') }}</span>
          <span class="setting-desc">{{ t('desktop_openclaw.enable_viking_desc') }}</span>
        </div>
        <n-switch v-model:value="config.enableVikingRouter" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('desktop_openclaw.enable_tools') }}</span>
          <span class="setting-desc">{{ t('desktop_openclaw.enable_tools_desc') }}</span>
        </div>
        <n-switch v-model:value="config.enableFunctionCalling" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">高级设置</h3>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">自动重连</span>
          <span class="setting-desc">连接断开时自动尝试重连</span>
        </div>
        <n-switch v-model:value="config.reconnect" />
      </div>

      <div v-if="config.reconnect" class="setting-item">
        <div class="setting-info">
          <span class="setting-label">重连间隔</span>
          <span class="setting-desc">重连尝试的间隔时间</span>
        </div>
        <n-input-number
          v-model:value="config.reconnectInterval"
          :min="1000"
          :max="60000"
          :step="1000"
          style="width: 150px">
          <template #suffix>ms</template>
        </n-input-number>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">心跳间隔</span>
          <span class="setting-desc">心跳检测的间隔时间</span>
        </div>
        <n-input-number
          v-model:value="config.heartbeatInterval"
          :min="10000"
          :max="120000"
          :step="10000"
          style="width: 150px">
          <template #suffix>ms</template>
        </n-input-number>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <div class="action-buttons">
        <n-button type="primary" :loading="saving" @click="handleSave">
          {{ t('desktop_openclaw.save') }}
        </n-button>
        <n-button @click="handleReset">
          {{ t('desktop_openclaw.reset') }}
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { NInput, NButton, NDivider, NSwitch, NInputNumber, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { openClawClient, ConnectionState, type OpenClawExtendedConfig } from '@/services/openclaw'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('OpenClawSettings')

const { t } = useI18n()
const message = useMessage()

const testing = ref(false)
const saving = ref(false)
const connectionOk = ref<boolean | null>(null)

const config = reactive<OpenClawExtendedConfig>({
  gatewayUrl: 'http://127.0.0.1:18789',
  token: '',
  autoConnect: false,
  reconnect: true,
  reconnectInterval: 3000,
  maxReconnectAttempts: 5,
  heartbeatInterval: 30000,
  enableVikingRouter: true,
  enableFunctionCalling: true
})

const connectionStatusClass = computed(() => {
  if (connectionOk.value === true) return 'status-connected'
  if (connectionOk.value === false) return 'status-error'
  return 'status-unknown'
})

const connectionStatusText = computed(() => {
  if (connectionOk.value === true) return t('desktop_openclaw.connection_success')
  if (connectionOk.value === false) return t('desktop_openclaw.connection_failed')
  return t('desktop_openclaw.test_connection')
})

const lastConnectedAt = computed(() => {
  const state = openClawClient.getConnectionState()
  if (!state.lastConnectedAt) return null
  return new Date(state.lastConnectedAt).toLocaleString()
})

async function handleTestConnection() {
  testing.value = true
  connectionOk.value = null

  try {
    const response = await fetch(`${config.gatewayUrl}/`, { method: 'GET' })
    connectionOk.value = response.ok
    if (response.ok) {
      message.success(t('desktop_openclaw.connection_success'))
    } else {
      message.error(t('desktop_openclaw.connection_failed'))
    }
  } catch {
    connectionOk.value = false
    message.error(t('desktop_openclaw.connection_failed'))
  } finally {
    testing.value = false
  }
}

async function handleSave() {
  saving.value = true

  try {
    openClawClient.configure(config)
    localStorage.setItem('openclaw-config', JSON.stringify(config))
    message.success(t('desktop_openclaw.saved'))
  } catch (error) {
    logger.error('保存配置失败:', error)
    message.error(t('desktop_openclaw.save_failed'))
  } finally {
    saving.value = false
  }
}

function handleReset() {
  config.gatewayUrl = 'http://127.0.0.1:18789'
  config.token = ''
  config.autoConnect = false
  config.reconnect = true
  config.reconnectInterval = 3000
  config.maxReconnectAttempts = 5
  config.heartbeatInterval = 30000
  config.enableVikingRouter = true
  config.enableFunctionCalling = true
  connectionOk.value = null
  message.info(t('desktop_openclaw.reset_success'))
}

onMounted(() => {
  const saved = localStorage.getItem('openclaw-config')
  if (saved) {
    try {
      const savedConfig = JSON.parse(saved)
      Object.assign(config, savedConfig)
    } catch {
      // ignore
    }
  }

  const clientConfig = openClawClient.getConfig()
  Object.assign(config, clientConfig)
})
</script>

<style scoped>
.openclaw-settings {
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

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

:deep(.dark) .setting-item {
  border-bottom-color: rgba(255, 255, 255, 0.05);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: 14px;
}

.setting-desc {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.connection-status-display {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

:deep(.dark) .connection-status-display {
  background-color: rgba(255, 255, 255, 0.05);
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.status-connected {
  background-color: #52c41a;
}

.status-error {
  background-color: #f56c6c;
}

.status-unknown {
  background-color: #999;
}

.status-text {
  font-size: 14px;
  flex: 1;
}

.last-connected {
  font-size: 12px;
  color: #999;
  margin-top: 8px;
}

.action-buttons {
  display: flex;
  gap: 12px;
}
</style>
