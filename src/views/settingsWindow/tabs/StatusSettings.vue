<template>
  <div class="status-settings">
    <div class="settings-section">
      <h3 class="section-title">{{ t('desktop_status.current_status') }}</h3>
      <div class="current-status">
        <div class="status-display">
          <div class="status-icon" :class="currentPresence">
            <Icon :icon="presenceIcon" :width="24" />
          </div>
          <div class="status-info">
            <div class="status-text">{{ presenceLabel }}</div>
            <div v-if="statusMessage" class="status-message">{{ statusMessage }}</div>
          </div>
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('desktop_status.set_presence') }}</h3>
      <div class="presence-options">
        <div
          v-for="option in presenceOptions"
          :key="option.value"
          class="presence-option"
          :class="{ active: currentPresence === option.value }"
          @click="handlePresenceChange(option.value)">
          <div class="option-icon" :class="option.value">
            <Icon :icon="option.icon" :width="20" />
          </div>
          <div class="option-info">
            <div class="option-label">{{ option.label }}</div>
            <div class="option-desc">{{ option.desc }}</div>
          </div>
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('desktop_status.custom_status') }}</h3>
      <div class="custom-status-form">
        <n-input
          v-model:value="statusMessage"
          type="textarea"
          :placeholder="t('desktop_status.status_placeholder')"
          :maxlength="100"
          show-count
          :autosize="{ minRows: 2, maxRows: 4 }" />
        <div class="status-actions">
          <n-button type="primary" :loading="saving" @click="handleSaveStatus">
            {{ t('desktop_status.save_status') }}
          </n-button>
          <n-button v-if="statusMessage" @click="handleClearStatus">
            {{ t('desktop_status.clear_status') }}
          </n-button>
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('desktop_status.quick_status') }}</h3>
      <div class="quick-status-list">
        <div
          v-for="quick in quickStatuses"
          :key="quick.emoji"
          class="quick-status-item"
          @click="handleQuickStatus(quick)">
          <span class="quick-emoji">{{ quick.emoji }}</span>
          <span class="quick-text">{{ quick.text }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NDivider, NInput, NButton, useMessage } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { matrixPresenceService, matrixAccountService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('StatusSettings')

const { t } = useI18n()
const message = useMessage()

const currentPresence = ref<'online' | 'unavailable' | 'offline'>('online')
const statusMessage = ref('')
const saving = ref(false)

const presenceOptions = computed(() => [
  {
    value: 'online' as const,
    icon: 'mdi:circle',
    label: t('desktop_status.online'),
    desc: t('desktop_status.online_desc')
  },
  {
    value: 'unavailable' as const,
    icon: 'mdi:circle',
    label: t('desktop_status.unavailable'),
    desc: t('desktop_status.unavailable_desc')
  },
  {
    value: 'offline' as const,
    icon: 'mdi:circle-outline',
    label: t('desktop_status.offline'),
    desc: t('desktop_status.offline_desc')
  }
])

const presenceIcon = computed(() => {
  const option = presenceOptions.value.find((o) => o.value === currentPresence.value)
  return option?.icon || 'mdi:circle'
})

const presenceLabel = computed(() => {
  const option = presenceOptions.value.find((o) => o.value === currentPresence.value)
  return option?.label || t('desktop_status.online')
})

const quickStatuses = [
  { emoji: '🎉', text: t('desktop_status.quick_celebrating') },
  { emoji: '🏠', text: t('desktop_status.quick_working_from_home') },
  { emoji: '📅', text: t('desktop_status.quick_in_meeting') },
  { emoji: '🎮', text: t('desktop_status.quick_gaming') },
  { emoji: '☕', text: t('desktop_status.quick_coffee') },
  { emoji: '✈️', text: t('desktop_status.quick_traveling') }
]

onMounted(async () => {
  await loadCurrentStatus()
})

async function loadCurrentStatus() {
  try {
    const userId = matrixAccountService.getCurrentUserId()
    if (!userId) return

    const presence = await matrixPresenceService.getPresence(userId)
    if (presence) {
      currentPresence.value = (presence.presence as 'online' | 'unavailable' | 'offline') || 'online'
      statusMessage.value = presence.statusMsg || ''
    }
  } catch (error) {
    logger.error('Failed to load presence:', error)
  }
}

async function handlePresenceChange(presence: 'online' | 'unavailable' | 'offline') {
  saving.value = true
  try {
    await matrixPresenceService.setPresence(presence, statusMessage.value)
    currentPresence.value = presence
    message.success(t('desktop_status.presence_updated'))
  } catch (error) {
    logger.error('Failed to update presence:', error)
    message.error(t('desktop_status.presence_update_failed'))
  } finally {
    saving.value = false
  }
}

async function handleSaveStatus() {
  saving.value = true
  try {
    await matrixPresenceService.setPresence(currentPresence.value, statusMessage.value)
    message.success(t('desktop_status.status_saved'))
  } catch (error) {
    logger.error('Failed to save status:', error)
    message.error(t('desktop_status.status_save_failed'))
  } finally {
    saving.value = false
  }
}

async function handleClearStatus() {
  statusMessage.value = ''
  saving.value = true
  try {
    await matrixPresenceService.setPresence(currentPresence.value, '')
    message.success(t('desktop_status.status_cleared'))
  } catch (error) {
    logger.error('Failed to clear status:', error)
    message.error(t('desktop_status.status_clear_failed'))
  } finally {
    saving.value = false
  }
}

async function handleQuickStatus(quick: { emoji: string; text: string }) {
  statusMessage.value = `${quick.emoji} ${quick.text}`
  await handleSaveStatus()
}
</script>

<style scoped>
.status-settings {
  padding: 0 8px;
}

.settings-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
}

.current-status {
  padding: 16px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

:deep(.dark) .current-status {
  background-color: rgba(255, 255, 255, 0.05);
}

.status-display {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.status-icon.online {
  color: #52c41a;
  background-color: rgba(82, 196, 26, 0.1);
}

.status-icon.unavailable {
  color: #faad14;
  background-color: rgba(250, 173, 20, 0.1);
}

.status-icon.offline {
  color: #999;
  background-color: rgba(153, 153, 153, 0.1);
}

.status-info {
  display: flex;
  flex-direction: column;
}

.status-text {
  font-size: 16px;
  font-weight: 500;
}

.status-message {
  font-size: 14px;
  color: #666;
  margin-top: 4px;
}

.presence-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.presence-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.presence-option:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

:deep(.dark) .presence-option:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

.presence-option.active {
  background-color: rgba(24, 144, 255, 0.1);
  border: 1px solid #1890ff;
}

.option-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.option-icon.online {
  color: #52c41a;
  background-color: rgba(82, 196, 26, 0.1);
}

.option-icon.unavailable {
  color: #faad14;
  background-color: rgba(250, 173, 20, 0.1);
}

.option-icon.offline {
  color: #999;
  background-color: rgba(153, 153, 153, 0.1);
}

.option-info {
  display: flex;
  flex-direction: column;
}

.option-label {
  font-size: 14px;
  font-weight: 500;
}

.option-desc {
  font-size: 12px;
  color: #999;
}

.custom-status-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-actions {
  display: flex;
  gap: 8px;
}

.quick-status-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quick-status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 16px;
  cursor: pointer;
  transition: background-color 0.2s;
}

:deep(.dark) .quick-status-item {
  background-color: rgba(255, 255, 255, 0.05);
}

.quick-status-item:hover {
  background-color: rgba(0, 0, 0, 0.06);
}

:deep(.dark) .quick-status-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.quick-emoji {
  font-size: 16px;
}

.quick-text {
  font-size: 13px;
}
</style>
