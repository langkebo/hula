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
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSettingStore } from '@/stores/domains/settings/setting'

defineOptions({
  name: 'PrivacySettingsSection'
})

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const settingStore = useSettingStore()

// 隐私设置以 store 的 preferences 为唯一数据源，默认全部开启
const showOnlineStatus = computed({
  get: () => settingStore.showOnlineStatusEnabled,
  set: (value: boolean) => settingStore.setShowOnlineStatusEnabled(value)
})

const showTypingStatus = computed({
  get: () => settingStore.sendTypingNotificationsEnabled,
  set: (value: boolean) => settingStore.setSendTypingNotificationsEnabled(value)
})

const sendReadReceipts = computed({
  get: () => settingStore.sendReadReceiptsEnabled,
  set: (value: boolean) => settingStore.setSendReadReceiptsEnabled(value)
})

onMounted(() => {
  // 遗留的 localStorage key 由 store 迁移逻辑读取一次并 removeItem，组件本身不碰 localStorage
  settingStore.migrateLegacyPreferenceSettings()
})

function handleOnlineStatusChange(value: boolean) {
  settingStore.setShowOnlineStatusEnabled(value)
  showFeedback(
    value ? t('setting.security.online_status_shown') : t('setting.security.online_status_hidden'),
    'success'
  )
}

function handleTypingStatusChange(value: boolean) {
  settingStore.setSendTypingNotificationsEnabled(value)
  showFeedback(
    value ? t('setting.security.typing_status_shown') : t('setting.security.typing_status_hidden'),
    'success'
  )
}

function handleReadReceiptsChange(value: boolean) {
  settingStore.setSendReadReceiptsEnabled(value)
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
