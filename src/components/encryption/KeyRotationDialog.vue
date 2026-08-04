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
          <n-timeline>
            <n-timeline-item
              v-for="(record, index) in rotationHistory"
              :key="index"
              :type="index === 0 ? 'success' : 'default'"
              :title="formatKeyId(record.keyId)">
              <template #footer>
                <span class="history-time">{{ formatDate(record.rotatedAt) }}</span>
              </template>
            </n-timeline-item>
          </n-timeline>
        </div>

        <n-empty
          v-if="showHistory && rotationHistory.length === 0"
          :description="t('encryption.key_rotation.no_history')" />

        <div class="action-item">
          <div class="action-info">
            <Icon icon="mdi:shield-check" :width="24" />
            <div class="action-text">
              <span class="action-label">{{ t('encryption.key_rotation.check_status') }}</span>
              <span class="action-desc">{{ t('encryption.key_rotation.check_desc') }}</span>
            </div>
          </div>
          <n-button :loading="checking" @click="handleCheckStatus">
            {{ checking ? t('encryption.key_rotation.checking') : t('encryption.key_rotation.check_status') }}
          </n-button>
        </div>

        <div v-if="checkResult !== null" class="check-result">
          <n-alert
            :type="checkResult ? 'warning' : 'success'"
            :title="
              checkResult
                ? t('encryption.key_rotation.check_rotation_needed')
                : t('encryption.key_rotation.check_no_rotation')
            ">
            <div v-if="lastRotationTime" class="check-detail">
              <span>{{ t('encryption.key_rotation.check_last_rotation') }}: {{ formatDate(lastRotationTime) }}</span>
            </div>
            <div v-if="rotationInterval" class="check-detail">
              <span>
                {{ t('encryption.key_rotation.check_interval') }}: {{ rotationInterval }} {{ t('common.days') }}
              </span>
            </div>
          </n-alert>
        </div>

        <div v-if="isAdminUser" class="action-item">
          <div class="action-info">
            <Icon icon="mdi:key-remove" :width="24" />
            <div class="action-text">
              <span class="action-label">
                {{ t('encryption.key_rotation.revoke_key') }}
                <n-tag size="small" type="warning" style="margin-left: 6px">
                  {{ t('encryption.key_rotation.admin_only') }}
                </n-tag>
              </span>
              <span class="action-desc">{{ t('encryption.key_rotation.revoke_desc') }}</span>
            </div>
          </div>
          <n-button type="error" @click="showRevokeDialog = true">
            {{ t('encryption.key_rotation.revoke_key') }}
          </n-button>
        </div>
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

  <n-modal
    v-model:show="showRevokeDialog"
    preset="dialog"
    :title="t('encryption.key_rotation.revoke_confirm_title')"
    :positive-text="t('common.confirm')"
    :negative-text="t('common.cancel')"
    :loading="revoking"
    @positive-click="handleRevoke">
    <div class="revoke-form">
      <p>{{ t('encryption.key_rotation.revoke_confirm_content') }}</p>
      <n-input
        v-model:value="revokeKeyId"
        :placeholder="t('encryption.key_rotation.revoke_key_id_placeholder')"
        :label="t('encryption.key_rotation.revoke_key_id_label')"
        style="margin-top: 12px" />
      <n-input
        v-model:value="revokeReason"
        :placeholder="t('encryption.key_rotation.revoke_reason_placeholder')"
        :label="t('encryption.key_rotation.revoke_reason_label')"
        style="margin-top: 8px" />
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import {
  NAlert,
  NButton,
  NDivider,
  NEmpty,
  NFlex,
  NInput,
  NModal,
  NSelect,
  NSpin,
  NSwitch,
  NTag,
  NTimeline,
  NTimelineItem
} from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { type KeyRotationRecord, useEncryption } from '@/composables/encryption'
import { useAdminStore } from '@/stores/domains/admin/admin'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('KeyRotation')

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const encryption = useEncryption()
const adminStore = useAdminStore()
const emit = defineEmits<{
  updated: []
}>()

const visible = defineModel<boolean>('show', { default: false })

const loading = ref(false)
const rotating = ref(false)
const checking = ref(false)
const revoking = ref(false)
const needsRotation = ref(false)
const lastRotationTime = ref<number | null>(null)
const autoRotate = ref(true)
const rotationInterval = ref(7)
const showHistory = ref(false)
const rotationHistory = ref<KeyRotationRecord[]>([])
const checkResult = ref<boolean | null>(null)
const showRevokeDialog = ref(false)
const revokeKeyId = ref('')
const revokeReason = ref('')

const isAdminUser = computed(() => adminStore.isAdmin)

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
  return new Date(timestamp).toLocaleString()
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
    const status = await encryption.getKeyRotationStatus()
    needsRotation.value = status.needsRotation
    lastRotationTime.value = status.lastRotation ?? null
    autoRotate.value = status.enabled
    rotationInterval.value = Math.round(status.intervalMs / (24 * 60 * 60 * 1000)) || 7
  } catch (err) {
    logger.error('Failed to load rotation status:', err)
  } finally {
    loading.value = false
  }
}

const loadRotationHistory = async () => {
  try {
    const deviceId = encryption.getCurrentDeviceId()
    if (deviceId) {
      rotationHistory.value = await encryption.getRotationHistory(deviceId)
    }
  } catch (err) {
    logger.error('Failed to load rotation history:', err)
  }
}

const handleRotate = async () => {
  rotating.value = true
  try {
    const result = await encryption.rotateKeys()
    if (result.success) {
      showFeedback(t('encryption.key_rotation.rotation_success'), 'success')
      await loadRotationStatus()
      await loadRotationHistory()
      emit('updated')
    } else {
      showFeedback(t('encryption.key_rotation.rotation_failed'), 'error')
    }
  } catch (err) {
    logger.error('Key rotation failed:', err)
    showFeedback(t('encryption.key_rotation.rotation_failed'), 'error')
  } finally {
    rotating.value = false
  }
}

const handleConfigChange = async () => {
  try {
    await encryption.configureKeyRotation(autoRotate.value, rotationInterval.value)
    await loadRotationStatus()
    emit('updated')
    showFeedback(t('encryption.key_rotation.config_success'), 'success')
  } catch (err) {
    logger.error('Failed to update key rotation config:', err)
    showFeedback(t('encryption.key_rotation.config_failed'), 'error')
  }
}

const handleCheckStatus = async () => {
  checking.value = true
  try {
    const result = await encryption.checkNeedsRotation()
    checkResult.value = result
    await loadRotationStatus()
  } catch (err) {
    logger.error('Failed to check key status:', err)
    showFeedback(t('encryption.key_rotation.check_failed'), 'error')
  } finally {
    checking.value = false
  }
}

const handleRevoke = async () => {
  if (!revokeKeyId.value.trim()) {
    showFeedback(t('encryption.key_rotation.revoke_key_id_placeholder'), 'warning')
    return false
  }
  revoking.value = true
  try {
    const deviceId = encryption.getCurrentDeviceId()
    if (!deviceId) {
      showFeedback(t('encryption.key_rotation.revoke_failed'), 'error')
      return false
    }
    await encryption.revokeOldKeys(deviceId, [revokeKeyId.value.trim()])
    showFeedback(t('encryption.key_rotation.revoke_success'), 'success')
    showRevokeDialog.value = false
    revokeKeyId.value = ''
    revokeReason.value = ''
    await loadRotationHistory()
    emit('updated')
    return true
  } catch (err) {
    logger.error('Failed to revoke key:', err)
    showFeedback(t('encryption.key_rotation.revoke_failed'), 'error')
    return false
  } finally {
    revoking.value = false
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
    border-top: 1px solid var(--tjg-border-default);
  }
}

.rotation-status {
  padding: 12px;
  background: var(--tjg-surface-panel-muted);
  border-radius: 8px;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-warning {
  color: var(--color-warning);
}

.status-ok {
  color: var(--color-success);
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
  color: var(--tjg-text-secondary);
  margin-top: 2px;
}

.last-rotation {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--tjg-border-default);
  font-size: 12px;

  .label {
    color: var(--tjg-text-secondary);
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
    background: var(--tjg-surface-panel-muted);
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
    color: var(--tjg-text-secondary);
  }
}

.history-list {
  margin-top: 8px;
  max-height: 200px;
  overflow-y: auto;
  padding: 8px 4px;
}

.history-time {
  color: var(--tjg-text-secondary);
  font-size: 12px;
}

.check-result {
  margin-top: 8px;
}

.check-detail {
  font-size: 12px;
  margin-top: 4px;
}

.revoke-form {
  p {
    font-size: 14px;
    margin-bottom: 8px;
  }
}

.rotation-config {
  .config-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px;
    background: var(--tjg-surface-panel-muted);
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
    color: var(--tjg-text-secondary);
    margin-top: 2px;
  }
}
</style>
