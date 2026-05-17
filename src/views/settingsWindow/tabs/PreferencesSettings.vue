<template>
  <div class="preferences-settings">
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.preferences.language_section') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.preferences.interface_language_label') }}</span>
          <span class="setting-desc">{{ t('setting.preferences.interface_language_desc') }}</span>
        </div>
        <n-select
          v-model:value="language"
          :options="languageOptions"
          style="width: 150px"
          @update:value="handleLanguageChange" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.preferences.startup_storage_section') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.preferences.auto_login_label') }}</span>
          <span class="setting-desc">{{ t('setting.preferences.auto_login_desc') }}</span>
        </div>
        <n-switch v-model:value="autoLogin" @update:value="handleAutoLoginChange" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.preferences.auto_startup_label') }}</span>
          <span class="setting-desc">{{ t('setting.preferences.auto_startup_desc') }}</span>
        </div>
        <n-switch
          v-model:value="autoStartup"
          :loading="autoStartupLoading"
          :disabled="!desktopRuntimeAvailable"
          @update:value="handleAutoStartupChange" />
      </div>
      <div class="storage-panel">
        <div class="storage-panel-header">
          <div class="setting-info">
            <span class="setting-label">{{ t('setting.preferences.storage_directory_label') }}</span>
            <span class="setting-desc">{{ t('setting.preferences.storage_directory_desc') }}</span>
          </div>
          <n-button size="small" :disabled="scanning || !currentDirectory" @click="startScan">
            {{ scanning ? t('setting.storage.scanning') : t('setting.storage.start_scan') }}
          </n-button>
        </div>
        <div class="storage-path-row">
          <n-radio-group v-model:value="pathType" @update:value="handleStoragePathTypeChange">
            <n-radio value="default">{{ t('setting.storage.path_type_default') }}</n-radio>
            <n-radio value="custom">{{ t('setting.storage.path_type_custom') }}</n-radio>
          </n-radio-group>
          <n-button
            v-if="pathType === 'custom'"
            size="small"
            secondary
            :disabled="scanning"
            @click="selectCustomDirectory">
            {{ t('setting.storage.select_directory') }}
          </n-button>
        </div>
        <div class="storage-directory">{{ currentDirectory || t('setting.storage.fetching_directory') }}</div>
        <div class="storage-stats">
          <span>
            {{ t('setting.storage.processed_files') }}
            {{ t('setting.storage.processed_files_unit', { count: scanProgress.files_processed ?? 0 }) }}
          </span>
          <span>{{ t('setting.storage.total_size') }} {{ formatBytes(scanProgress.total_size) }}</span>
          <span>{{ storageProgressText }}</span>
        </div>
        <n-progress
          type="line"
          :percentage="
            showDiskUsage && diskInfo
              ? Number(diskInfo.disk_usage_percentage.toFixed(0))
              : Number(scanningProgress.toFixed(0))
          "
          :processing="scanning" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.preferences.messaging_section') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.preferences.send_key_label') }}</span>
          <span class="setting-desc">{{ t('setting.preferences.send_key_desc') }}</span>
        </div>
        <n-select
          v-model:value="sendKey"
          :options="sendKeyOptions"
          style="width: 150px"
          @update:value="handleSendKeyChange" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.preferences.message_confirm_label') }}</span>
          <span class="setting-desc">{{ t('setting.preferences.message_confirm_desc') }}</span>
        </div>
        <n-switch v-model:value="messageConfirm" @update:value="handleConfirmChange" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.preferences.recall_time_label') }}</span>
          <span class="setting-desc">{{ t('setting.preferences.recall_time_desc') }}</span>
        </div>
        <n-select v-model:value="recallTime" :options="recallTimeOptions" style="width: 150px" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.preferences.link_preview_section') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.preferences.link_preview_label') }}</span>
          <span class="setting-desc">{{ t('setting.preferences.link_preview_desc') }}</span>
        </div>
        <n-switch v-model:value="linkPreview" @update:value="handleLinkPreviewChange" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.preferences.emoji_section') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.preferences.emoji_convert_label') }}</span>
          <span class="setting-desc">{{ t('setting.preferences.emoji_convert_desc') }}</span>
        </div>
        <n-switch v-model:value="emojiConvert" @update:value="handleEmojiChange" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.preferences.emoji_size_label') }}</span>
          <span class="setting-desc">{{ t('setting.preferences.emoji_size_desc') }}</span>
        </div>
        <n-select
          v-model:value="emojiSize"
          :options="emojiSizeOptions"
          style="width: 120px"
          @update:value="handleEmojiSizeChange" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.preferences.burn_defaults_section') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.preferences.burn_default_enabled_label') }}</span>
          <span class="setting-desc">{{ t('setting.preferences.burn_default_enabled_desc') }}</span>
        </div>
        <n-switch v-model:value="burnDefaultEnabled" @update:value="handleBurnDefaultToggle" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.preferences.burn_default_duration_label') }}</span>
          <span class="setting-desc">{{ t('setting.preferences.burn_default_duration_desc') }}</span>
        </div>
        <n-select
          v-model:value="burnDefaultDuration"
          :options="burnDurationOptions"
          style="width: 130px"
          @update:value="handleBurnDurationChange" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.preferences.burn_show_countdown_label') }}</span>
          <span class="setting-desc">{{ t('setting.preferences.burn_show_countdown_desc') }}</span>
        </div>
        <n-switch v-model:value="burnShowCountdown" @update:value="handleBurnCountdownToggle" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.preferences.thread_section') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.preferences.thread_auto_subscribe_label') }}</span>
          <span class="setting-desc">{{ t('setting.preferences.thread_auto_subscribe_desc') }}</span>
        </div>
        <n-switch v-model:value="threadAutoSubscribe" @update:value="handleThreadAutoSubscribe" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.preferences.thread_show_in_room_label') }}</span>
          <span class="setting-desc">{{ t('setting.preferences.thread_show_in_room_desc') }}</span>
        </div>
        <n-switch v-model:value="threadShowInRoom" @update:value="handleThreadShowInRoom" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.preferences.thread_notification_label') }}</span>
          <span class="setting-desc">{{ t('setting.preferences.thread_notification_desc') }}</span>
        </div>
        <n-select
          v-model:value="threadNotificationLevel"
          :options="threadNotificationOptions"
          style="width: 130px"
          @update:value="handleThreadNotificationChange" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.preferences.space_section') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.preferences.space_auto_join_label') }}</span>
          <span class="setting-desc">{{ t('setting.preferences.space_auto_join_desc') }}</span>
        </div>
        <n-switch v-model:value="spaceAutoJoinRooms" @update:value="handleSpaceAutoJoin" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.preferences.space_show_subspaces_label') }}</span>
          <span class="setting-desc">{{ t('setting.preferences.space_show_subspaces_desc') }}</span>
        </div>
        <n-switch v-model:value="spaceShowSubspaces" @update:value="handleSpaceShowSubspaces" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.preferences.space_notification_label') }}</span>
          <span class="setting-desc">{{ t('setting.preferences.space_notification_desc') }}</span>
        </div>
        <n-select
          v-model:value="spaceDefaultNotification"
          :options="spaceNotificationOptions"
          style="width: 130px"
          @update:value="handleSpaceNotificationChange" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.preferences.privacy_section') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.preferences.read_receipts_label') }}</span>
          <span class="setting-desc">{{ t('setting.preferences.read_receipts_desc') }}</span>
        </div>
        <n-switch v-model:value="sendReadReceipts" @update:value="handleReadReceiptsToggle" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.preferences.typing_notifications_label') }}</span>
          <span class="setting-desc">{{ t('setting.preferences.typing_notifications_desc') }}</span>
        </div>
        <n-switch v-model:value="sendTypingNotifications" @update:value="handleTypingToggle" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart'
import { open } from '@tauri-apps/plugin-dialog'
import { NButton, NDivider, NProgress, NRadio, NRadioGroup, NSelect, NSwitch } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useLanguageOptions } from '@/composables/settings/settingsOptions'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useScannerStore } from '@/stores/domains/widget/scanner'
import { formatBytes } from '@/utils/Formatting.ts'
import { isDesktop } from '@/utils/PlatformConstants'

defineOptions({
  name: 'PreferencesSettings'
})

const { showFeedback } = useActionFeedback()
const { t } = useI18n()
const settingStore = useSettingStore()
const scannerStore = useScannerStore()
const { pathType, currentDirectory, scanning, showDiskUsage, diskInfo, scanProgress, scanningProgress } =
  storeToRefs(scannerStore)
const desktopRuntimeAvailable = isDesktop()

settingStore.migrateLegacyPreferenceSettings()

const language = ref(settingStore.languagePreference)
const languageOptions = useLanguageOptions()

const sendKey = ref(settingStore.sendMessageShortcut)
const autoLogin = ref(settingStore.autoLoginEnabled)
const autoStartup = ref(settingStore.autoStartupEnabled)
const autoStartupLoading = ref(false)
const sendKeyOptions = computed(() => [
  { label: 'Enter', value: 'Enter' },
  { label: t('setting.preferences.send_key_ctrl_enter'), value: 'Ctrl+Enter' },
  { label: t('setting.preferences.send_key_shift_enter'), value: 'Shift+Enter' }
])

const recallTimeOptions = computed(() => [
  { label: t('setting.preferences.recall_2_minutes'), value: 120 },
  { label: t('setting.preferences.recall_5_minutes'), value: 300 },
  { label: t('setting.preferences.recall_10_minutes'), value: 600 }
])

const emojiSizeOptions = computed(() => [
  { label: t('setting.preferences.emoji_small'), value: 'small' },
  { label: t('setting.preferences.emoji_medium'), value: 'medium' },
  { label: t('setting.preferences.emoji_large'), value: 'large' }
])

const messageConfirm = ref(settingStore.messageConfirmEnabled)
const recallTime = ref(120)
const linkPreview = ref(settingStore.linkPreviewEnabled)
const emojiConvert = ref(settingStore.emojiConvertEnabled)
const emojiSize = ref(settingStore.emojiSize)

const burnDefaultEnabled = ref(settingStore.burnDefaultEnabled)
const burnDefaultDuration = ref(settingStore.burnDefaultDuration)
const burnShowCountdown = ref(settingStore.burnShowCountdownEnabled)

const threadAutoSubscribe = ref(settingStore.threadAutoSubscribeEnabled)
const threadShowInRoom = ref(settingStore.threadShowInRoomEnabled)
const threadNotificationLevel = ref(settingStore.threadNotificationLevel)

const spaceAutoJoinRooms = ref(settingStore.spaceAutoJoinRoomsEnabled)
const spaceShowSubspaces = ref(settingStore.spaceShowSubspacesEnabled)
const spaceDefaultNotification = ref(settingStore.spaceDefaultNotification)

const sendReadReceipts = ref(settingStore.sendReadReceiptsEnabled)
const sendTypingNotifications = ref(settingStore.sendTypingNotificationsEnabled)

const burnDurationOptions = computed(() => [
  { label: t('setting.burn_after_read.durations.30_seconds'), value: 30 },
  { label: t('setting.burn_after_read.durations.1_minute'), value: 60 },
  { label: t('setting.burn_after_read.durations.5_minutes'), value: 300 },
  { label: t('setting.burn_after_read.durations.1_hour'), value: 3600 },
  { label: t('setting.burn_after_read.durations.24_hours'), value: 86400 }
])

const threadNotificationOptions = computed(() => [
  { label: t('setting.preferences.notification_all_messages'), value: 'all' },
  { label: t('setting.preferences.notification_participating_only'), value: 'participate' },
  { label: t('setting.preferences.notification_none'), value: 'none' }
])

const spaceNotificationOptions = computed(() => [
  { label: t('setting.preferences.notification_all_messages'), value: 'all_messages' },
  { label: t('setting.preferences.notification_mentions_only'), value: 'mentions_only' },
  { label: t('setting.preferences.notification_none'), value: 'none' }
])

const storageProgressText = computed(() => {
  if (showDiskUsage.value && diskInfo.value) {
    return t('setting.preferences.storage_disk_usage', {
      percentage: diskInfo.value.disk_usage_percentage.toFixed(2)
    })
  }

  return t('setting.preferences.storage_scan_progress', {
    percentage: scanningProgress.value.toFixed(0)
  })
})

function findOptionLabel<T extends string | number>(options: Array<{ label: string; value: T }>, value: T) {
  return options.find((option) => option.value === value)?.label ?? String(value)
}

function showToggleFeedback(label: string, value: boolean) {
  showFeedback(
    t(value ? 'setting.preferences.feedback.enabled' : 'setting.preferences.feedback.disabled', { label }),
    'success'
  )
}

function showOptionSetFeedback(label: string, value: string) {
  showFeedback(t('setting.preferences.feedback.option_set', { label, value }), 'success')
}

onMounted(() => {
  if (desktopRuntimeAvailable) {
    void syncDesktopPreferences()
  }
})

async function syncDesktopPreferences() {
  try {
    autoStartup.value = await isEnabled()
    settingStore.setAutoStartup(autoStartup.value)
  } catch (error) {
    showFeedback(t('setting.preferences.feedback.read_auto_startup_failed'), 'warning')
  }

  try {
    await scannerStore.initializeScanner()
  } catch (error) {
    showFeedback(t('setting.preferences.feedback.initialize_storage_scan_failed'), 'warning')
  }
}

function handleLanguageChange(value: string) {
  settingStore.setLanguage(value)
  showOptionSetFeedback(
    t('setting.preferences.interface_language_label'),
    findOptionLabel(languageOptions.value, value)
  )
}

function handleSendKeyChange(value: string) {
  settingStore.setSendMessageShortcut(value)
  showOptionSetFeedback(t('setting.preferences.send_key_label'), findOptionLabel(sendKeyOptions.value, value))
}

function handleAutoLoginChange(value: boolean) {
  settingStore.setAutoLogin(value)
  showToggleFeedback(t('setting.preferences.auto_login_label'), value)
}

async function handleAutoStartupChange(value: boolean) {
  if (!desktopRuntimeAvailable) {
    autoStartup.value = false
    return
  }

  autoStartupLoading.value = true
  try {
    await (value ? enable() : disable())
    settingStore.setAutoStartup(value)
    showToggleFeedback(t('setting.preferences.auto_startup_label'), value)
  } catch (error) {
    autoStartup.value = !value
    showFeedback(t('setting.preferences.feedback.auto_startup_change_failed'), 'error')
  } finally {
    autoStartupLoading.value = false
  }
}

function handleStoragePathTypeChange(value: 'default' | 'custom') {
  scannerStore.setPathType(value)
}

async function selectCustomDirectory() {
  try {
    const result = await open({
      directory: true,
      title: t('setting.storage.select_directory_title')
    })
    if (result) {
      scannerStore.setCustomDirectory(result)
    }
  } catch (error) {
    showFeedback(t('setting.storage.select_directory_error'), 'error')
  }
}

async function startScan() {
  await scannerStore.startScan()
}

function handleConfirmChange(value: boolean) {
  settingStore.setMessageConfirmEnabled(value)
  showToggleFeedback(t('setting.preferences.message_confirm_label'), value)
}

function handleLinkPreviewChange(value: boolean) {
  settingStore.setLinkPreviewEnabled(value)
  showToggleFeedback(t('setting.preferences.link_preview_label'), value)
}

function handleEmojiChange(value: boolean) {
  settingStore.setEmojiConvertEnabled(value)
  showToggleFeedback(t('setting.preferences.emoji_convert_label'), value)
}

function handleEmojiSizeChange(value: string) {
  settingStore.setEmojiSize(value)
  showOptionSetFeedback(t('setting.preferences.emoji_size_label'), findOptionLabel(emojiSizeOptions.value, value))
}

function handleBurnDefaultToggle(value: boolean) {
  settingStore.setBurnDefaultEnabled(value)
  showToggleFeedback(t('setting.preferences.burn_default_enabled_label'), value)
}

function handleBurnDurationChange(value: number) {
  settingStore.setBurnDefaultDuration(value)
  showOptionSetFeedback(
    t('setting.preferences.burn_default_duration_label'),
    findOptionLabel(burnDurationOptions.value, value)
  )
}

function handleBurnCountdownToggle(value: boolean) {
  settingStore.setBurnShowCountdownEnabled(value)
  showToggleFeedback(t('setting.preferences.burn_show_countdown_label'), value)
}

function handleThreadAutoSubscribe(value: boolean) {
  settingStore.setThreadAutoSubscribeEnabled(value)
  showToggleFeedback(t('setting.preferences.thread_auto_subscribe_label'), value)
}

function handleThreadShowInRoom(value: boolean) {
  settingStore.setThreadShowInRoomEnabled(value)
  showToggleFeedback(t('setting.preferences.thread_show_in_room_label'), value)
}

function handleThreadNotificationChange(value: string) {
  settingStore.setThreadNotificationLevel(value)
  showOptionSetFeedback(
    t('setting.preferences.thread_notification_label'),
    findOptionLabel(threadNotificationOptions.value, value)
  )
}

function handleSpaceAutoJoin(value: boolean) {
  settingStore.setSpaceAutoJoinRoomsEnabled(value)
  showToggleFeedback(t('setting.preferences.space_auto_join_label'), value)
}

function handleSpaceShowSubspaces(value: boolean) {
  settingStore.setSpaceShowSubspacesEnabled(value)
  showToggleFeedback(t('setting.preferences.space_show_subspaces_label'), value)
}

function handleSpaceNotificationChange(value: string) {
  settingStore.setSpaceDefaultNotification(value)
  showOptionSetFeedback(
    t('setting.preferences.space_notification_label'),
    findOptionLabel(spaceNotificationOptions.value, value)
  )
}

function handleReadReceiptsToggle(value: boolean) {
  settingStore.setSendReadReceiptsEnabled(value)
  showToggleFeedback(t('setting.preferences.read_receipts_label'), value)
}

function handleTypingToggle(value: boolean) {
  settingStore.setSendTypingNotificationsEnabled(value)
  showToggleFeedback(t('setting.preferences.typing_notifications_label'), value)
}
</script>

<style scoped>
.preferences-settings {
  padding: 0 var(--hula-space-2);
}

.settings-section {
  margin-bottom: var(--hula-space-4);
}

.section-title {
  font-size: var(--hula-font-size-lg);
  font-weight: var(--hula-font-weight-medium);
  margin-bottom: var(--hula-space-4);
  color: var(--hula-text-primary);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--hula-space-3) 0;
  border-bottom: 1px solid var(--hula-settings-divider);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: var(--hula-font-size-base);
  color: var(--hula-text-primary);
}

.setting-desc {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
  margin-top: var(--hula-space-1);
}

.storage-panel {
  display: flex;
  flex-direction: column;
  gap: var(--hula-space-3);
  margin-top: var(--hula-space-3);
  padding: var(--hula-space-4);
  border: 1px solid var(--hula-settings-divider);
  border-radius: var(--hula-radius-md);
  background: var(--hula-settings-card-bg);
}

.storage-panel-header,
.storage-path-row,
.storage-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hula-space-3);
}

.storage-stats {
  flex-wrap: wrap;
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
}

.storage-directory {
  padding: 10px var(--hula-space-3);
  border-radius: var(--hula-radius-sm);
  background: var(--hula-settings-card-bg-hover);
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-secondary);
  word-break: break-all;
}
</style>
