<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('encryption.key_rotation.title')"
    :bordered="false"
    :closable="true"
    :mask-closable="false"
    class="key-rotation-dialog"
    style="width: 480px; max-width: 90vw">
    <n-spin :show="loading">
      <div class="rotation-status">
        <div class="status-header">
          <Icon
            :icon="needsRotation ? 'mdi:alert-circle' : 'mdi:check-circle'"
            :width="32"
            :class="needsRotation ? 'status-warning' : 'status-ok'" />
          <div class="status-info">
            <span class="status-title">
              {{
                needsRotation ? t('encryption.key_rotation.needs_rotation') : t('encryption.key_rotation.up_to_date')
              }}
            </span>
            <span class="status-desc">{{ statusDesc }}</span>
          </div>
        </div>

        <div v-if="lastRotationTime" class="last-rotation">
          <span class="label">{{ t('encryption.key_rotation.last_rotation') }}:</span>
          <span class="value">{{ formatDate(lastRotationTime) }}</span>
        </div>

        <div v-if="devicesPending > 0" class="devices-pending">
          <span class="label">{{ t('encryption.key_rotation.devices_pending') }}:</span>
          <span class="value">{{ devicesPending }}</span>
        </div>
      </div>

      <n-divider />

      <div class="rotation-actions">
        <h4 class="section-title">{{ t('encryption.key_rotation.actions') }}</h4>

        <div class="action-item">
          <div class="action-info">
            <Icon icon="mdi:rotate-3d-variant" :width="24" />
            <div class="action-text">
              <span class="action-label">{{ t('encryption.key_rotation.rotate_now') }}</span>
              <span class="action-desc">{{ t('encryption.key_rotation.rotate_desc') }}</span>
            </div>
          </div>
          <n-button type="primary" :loading="rotating" @click="handleRotate">
            {{ t('encryption.key_rotation.rotate') }}
          </n-button>
        </div>

        <div class="action-item">
          <div class="action-info">
            <Icon icon="mdi:history" :width="24" />
            <div class="action-text">
              <span class="action-label">{{ t('encryption.key_rotation.view_history') }}</span>
              <span class="action-desc">{{ t('encryption.key_rotation.history_desc') }}</span>
            </div>
          </div>
          <n-button @click="showHistory = !showHistory">
            {{ showHistory ? t('common.hide') : t('common.view') }}
          </n-button>
        </div>

        <div v-if="showHistory && rotationHistory.length > 0" class="history-list">
          <div v-for="(record, index) in rotationHistory" :key="index" class="history-item">
            <div class="history-info">
              <span class="history-key">{{ formatKeyId(record.new_version || record.old_version) }}</span>
              <span class="history-time">{{ formatDate(record.rotation_ts) }}</span>
            </div>
            <div v-if="record.reason" class="history-reason">{{ record.reason }}</div>
          </div>
        </div>

        <n-empty
          v-if="showHistory && rotationHistory.length === 0"
          :description="t('encryption.key_rotation.no_history')" />
      </div>

      <n-divider />

      <div class="rotation-config">
        <h4 class="section-title">{{ t('encryption.key_rotation.settings') }}</h4>

        <div class="config-item">
          <div class="config-info">
            <span class="config-label">{{ t('encryption.key_rotation.auto_rotate') }}</span>
            <span class="config-desc">{{ t('encryption.key_rotation.auto_rotate_desc') }}</span>
          </div>
          <n-switch v-model:value="autoRotate" @update:value="handleConfigChange" />
        </div>

        <div v-if="autoRotate" class="config-item">
          <div class="config-info">
            <span class="config-label">{{ t('encryption.key_rotation.rotation_interval') }}</span>
          </div>
          <n-select
            v-model:value="rotationInterval"
            :options="intervalOptions"
            style="width: 120px"
            @update:value="handleConfigChange" />
        </div>
      </div>
    </n-spin>

    <template #footer>
      <n-flex justify="end">
        <n-button @click="handleClose">{{ t('common.close') }}</n-button>
      </n-flex>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NModal, NButton, NSwitch, NSelect, NDivider, NSpin, NEmpty, NFlex, useMessage } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import matrixKeyRotationService, { type KeyRotationHistory } from '@/services/matrix/MatrixKeyRotationService'
import { matrixClientService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'
const logger = createLogger('KeyRotation')

const { t } = useI18n()
const message = useMessage()

const visible = defineModel<boolean>('show', { default: false })

const loading = ref(false)
const rotating = ref(false)
const needsRotation = ref(false)
const lastRotationTime = ref<number | null>(null)
const currentVersion = ref('')
const devicesPending = ref(0)
const autoRotate = ref(true)
const rotationInterval = ref(7)
const showHistory = ref(false)
const rotationHistory = ref<KeyRotationHistory[]>([])

const intervalOptions = [
  { label: '7 ' + t('common.days'), value: 7 },
  { label: '14 ' + t('common.days'), value: 14 },
  { label: '30 ' + t('common.days'), value: 30 },
  { label: '60 ' + t('common.days'), value: 60 }
]

const statusDesc = computed(() => {
  if (needsRotation.value) {
    return t('encryption.key_rotation.status_warning')
  }
  return t('encryption.key_rotation.status_ok')
})

const formatDate = (timestamp: number): string => {
  if (!timestamp) return '-'
  return new Date(timestamp).toLocaleString('zh-CN')
}

const formatKeyId = (keyId: string): string => {
  if (!keyId) return '-'
  if (keyId.length > 20) {
    return keyId.substring(0, 8) + '...' + keyId.substring(keyId.length - 8)
  }
  return keyId
}

const loadRotationStatus = async () => {
  loading.value = true
  try {
    const status = await matrixKeyRotationService.getRotationStatus()
    needsRotation.value = status.needs_rotation
    lastRotationTime.value = status.last_rotation_ts || null
    currentVersion.value = status.current_version
    devicesPending.value = status.devices_pending

    const config = await matrixKeyRotationService.getRotationConfig()
    autoRotate.value = config.auto_rotate
    rotationInterval.value = Math.round(config.rotation_interval_ms / (24 * 60 * 60 * 1000)) || 7
  } catch (err) {
    logger.error('加载状态失败:', err)
  } finally {
    loading.value = false
  }
}

const loadRotationHistory = async () => {
  try {
    const deviceId = matrixEncryptionService.getDeviceId()
    if (deviceId) {
      rotationHistory.value = await matrixKeyRotationService.getRotationHistory(deviceId)
    }
  } catch (err) {
    logger.error('加载历史失败:', err)
  }
}

const handleRotate = async () => {
  rotating.value = true
  try {
    const success = await matrixKeyRotationService.rotateKeys()
    if (success) {
      message.success(t('encryption.key_rotation.rotation_success'))
      needsRotation.value = false
      lastRotationTime.value = Date.now()
      await loadRotationHistory()
    } else {
      message.error(t('encryption.key_rotation.rotation_failed'))
    }
  } catch (err) {
    logger.error('轮换失败:', err)
    message.error(t('encryption.key_rotation.rotation_failed'))
  } finally {
    rotating.value = false
  }
}

const handleConfigChange = async () => {
  try {
    const success = await matrixKeyRotationService.updateRotationConfig({
      auto_rotate: autoRotate.value,
      rotation_interval_ms: rotationInterval.value * 24 * 60 * 60 * 1000
    })
    if (success) {
      message.success(t('encryption.key_rotation.config_success'))
    } else {
      message.error(t('encryption.key_rotation.config_failed'))
    }
  } catch (err) {
    logger.error('配置失败:', err)
    message.error(t('encryption.key_rotation.config_failed'))
  }
}

const handleClose = () => {
  visible.value = false
}

watch(visible, (val) => {
  if (val) {
    loadRotationStatus()
    loadRotationHistory()
  }
})
</script>

<style scoped lang="scss">
.key-rotation-dialog {
  :deep(.n-card-header) {
    padding: 16px 20px;
  }

  :deep(.n-card__content) {
    padding: 16px 20px;
  }

  :deep(.n-card__footer) {
    padding: 12px 20px;
    border-top: 1px solid var(--border-color);
  }
}

.rotation-status {
  padding: 12px;
  background: var(--bg-color-secondary);
  border-radius: 8px;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-warning {
  color: #faad14;
}

.status-ok {
  color: #52c41a;
}

.status-info {
  display: flex;
  flex-direction: column;
}

.status-title {
  font-size: 14px;
  font-weight: 500;
}

.status-desc {
  font-size: 12px;
  color: var(--text-color-secondary);
  margin-top: 2px;
}

.last-rotation,
.devices-pending {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
  font-size: 12px;

  .label {
    color: var(--text-color-secondary);
  }

  .value {
    margin-left: 8px;
  }
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  margin: 0 0 12px 0;
}

.rotation-actions {
  .action-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    background: var(--bg-color-secondary);
    border-radius: 8px;
    margin-bottom: 8px;
  }

  .action-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .action-text {
    display: flex;
    flex-direction: column;
  }

  .action-label {
    font-size: 14px;
  }

  .action-desc {
    font-size: 12px;
    color: var(--text-color-secondary);
  }
}

.history-list {
  margin-top: 8px;
  max-height: 150px;
  overflow-y: auto;
}

.history-item {
  padding: 8px 12px;
  background: var(--bg-color);
  border-radius: 4px;
  margin-bottom: 4px;
}

.history-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.history-key {
  font-family: monospace;
  color: var(--text-color);
}

.history-time {
  color: var(--text-color-secondary);
}

.history-reason {
  font-size: 11px;
  color: var(--text-color-secondary);
  margin-top: 4px;
}

.rotation-config {
  .config-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    background: var(--bg-color-secondary);
    border-radius: 8px;
    margin-bottom: 8px;
  }

  .config-info {
    display: flex;
    flex-direction: column;
  }

  .config-label {
    font-size: 14px;
  }

  .config-desc {
    font-size: 12px;
    color: var(--text-color-secondary);
    margin-top: 2px;
  }
}
</style>
