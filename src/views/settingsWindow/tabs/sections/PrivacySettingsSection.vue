<template>
  <div class="settings-section">
    <h3 class="section-title">{{ t('setting.security.privacy_settings') }}</h3>
    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">{{ t('setting.security.show_online_status') }}</span>
        <span class="setting-desc">{{ t('setting.security.show_online_status_desc') }}</span>
      </div>
      <n-switch v-model:value="showOnlineStatus" @update:value="handleOnlineStatusChange" />
    </div>
    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">{{ t('setting.security.show_typing_status') }}</span>
        <span class="setting-desc">{{ t('setting.security.show_typing_status_desc') }}</span>
      </div>
      <n-switch v-model:value="showTypingStatus" @update:value="handleTypingStatusChange" />
    </div>
    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">{{ t('setting.security.send_read_receipts') }}</span>
        <span class="setting-desc">{{ t('setting.security.send_read_receipts_desc') }}</span>
      </div>
      <n-switch v-model:value="sendReadReceipts" @update:value="handleReadReceiptsChange" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { NSwitch } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'

defineOptions({
  name: 'PrivacySettingsSection'
})

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

// 隐私设置默认全部开启，挂载时从 localStorage 读取持久化值
const showOnlineStatus = ref(true)
const showTypingStatus = ref(true)
const sendReadReceipts = ref(true)

onMounted(() => {
  loadPrivacySettings()
})

// 从 localStorage 加载隐私设置（不依赖 Matrix 客户端，可独立加载）
function loadPrivacySettings() {
  const savedOnline = localStorage.getItem('tjg-show-online')
  if (savedOnline !== null) {
    showOnlineStatus.value = savedOnline === 'true'
  }

  const savedTyping = localStorage.getItem('tjg-show-typing')
  if (savedTyping !== null) {
    showTypingStatus.value = savedTyping === 'true'
  }

  const savedReceipts = localStorage.getItem('tjg-send-receipts')
  if (savedReceipts !== null) {
    sendReadReceipts.value = savedReceipts === 'true'
  }
}

function handleOnlineStatusChange(value: boolean) {
  localStorage.setItem('tjg-show-online', value.toString())
  showFeedback(
    value ? t('setting.security.online_status_shown') : t('setting.security.online_status_hidden'),
    'success'
  )
}

function handleTypingStatusChange(value: boolean) {
  localStorage.setItem('tjg-show-typing', value.toString())
  showFeedback(
    value ? t('setting.security.typing_status_shown') : t('setting.security.typing_status_hidden'),
    'success'
  )
}

function handleReadReceiptsChange(value: boolean) {
  localStorage.setItem('tjg-send-receipts', value.toString())
  showFeedback(
    value ? t('setting.security.read_receipts_enabled') : t('setting.security.read_receipts_disabled'),
    'success'
  )
}
</script>

<style scoped>
.settings-section {
  margin-bottom: var(--tjg-space-4);
}

.section-title {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  margin-bottom: var(--tjg-space-4);
  color: var(--tjg-text-primary);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--tjg-space-3) 0;
  border-bottom: 1px solid var(--tjg-settings-divider);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
}

.setting-desc {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
  margin-top: var(--tjg-space-1);
}
</style>
