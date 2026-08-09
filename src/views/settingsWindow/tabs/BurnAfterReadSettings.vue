<template>
  <div class="burn-after-read-settings">
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.burn_after_read.global.title') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.burn_after_read.global.enabled_label') }}</span>
          <span class="setting-desc">{{ t('setting.burn_after_read.global.enabled_desc') }}</span>
        </div>
        <n-switch v-model:value="globalBurnEnabled" @update:value="handleGlobalBurnToggle" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.burn_after_read.global.duration_label') }}</span>
          <span class="setting-desc">{{ t('setting.burn_after_read.global.duration_desc') }}</span>
        </div>
        <n-select
          v-model:value="globalBurnDuration"
          :options="burnDurationOptions"
          style="width: 130px"
          @update:value="handleBurnDurationChange" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.burn_after_read.global.auto_read_label') }}</span>
          <span class="setting-desc">{{ t('setting.burn_after_read.global.auto_read_desc') }}</span>
        </div>
        <n-switch v-model:value="autoBurnRead" @update:value="handleToggle('autoBurnRead')" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.burn_after_read.global.notification_label') }}</span>
          <span class="setting-desc">{{ t('setting.burn_after_read.global.notification_desc') }}</span>
        </div>
        <n-switch v-model:value="burnNotification" @update:value="handleToggle('burnNotification')" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.burn_after_read.global.countdown_label') }}</span>
          <span class="setting-desc">{{ t('setting.burn_after_read.global.countdown_desc') }}</span>
        </div>
        <n-switch v-model:value="showBurnCountdown" @update:value="handleToggle('showBurnCountdown')" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.burn_after_read.global.sound_label') }}</span>
          <span class="setting-desc">{{ t('setting.burn_after_read.global.sound_desc') }}</span>
        </div>
        <n-switch v-model:value="burnSound" @update:value="handleToggle('burnSound')" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.burn_after_read.rooms.title') }}</h3>
      <n-spin :show="loadingRooms">
        <div v-if="burnRooms.length === 0" class="empty-list">
          <span class="empty-text">{{ t('setting.burn_after_read.rooms.empty') }}</span>
        </div>
        <div v-else class="room-list">
          <div v-for="room in burnRooms" :key="room.roomId" class="room-item">
            <div class="room-info">
              <span class="room-name">{{ room.name || room.roomId }}</span>
              <div class="room-burn-status">
                <n-tag v-if="room.burnEnabled" type="success" size="small">
                  {{ t('setting.burn_after_read.rooms.enabled') }}
                </n-tag>
                <n-tag v-else type="default" size="small">{{ t('setting.burn_after_read.rooms.disabled') }}</n-tag>
                <span v-if="room.burnEnabled" class="room-duration">
                  {{
                    t('setting.burn_after_read.rooms.duration_value', {
                      duration: formatDuration(room.burnDuration || globalBurnDuration)
                    })
                  }}
                </span>
              </div>
            </div>
            <div class="room-actions">
              <n-button v-if="room.burnEnabled" size="small" @click="handleEditRoomBurn(room)">
                {{ t('setting.burn_after_read.rooms.edit') }}
              </n-button>
              <n-button v-if="room.burnEnabled" size="small" type="warning" @click="handleDisableRoomBurn(room)">
                {{ t('setting.burn_after_read.rooms.disable') }}
              </n-button>
              <n-button v-if="!room.burnEnabled" size="small" type="primary" @click="handleEnableRoomBurn(room)">
                {{ t('setting.burn_after_read.rooms.enable') }}
              </n-button>
            </div>
          </div>
        </div>
      </n-spin>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.burn_after_read.stats.title') }}</h3>
      <n-spin :show="loadingStats">
        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-value">{{ burnStats.totalBurned }}</span>
            <span class="stat-label">{{ t('setting.burn_after_read.stats.total_burned') }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ burnStats.totalPending }}</span>
            <span class="stat-label">{{ t('setting.burn_after_read.stats.total_pending') }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ burnStats.roomsWithBurnEnabled }}</span>
            <span class="stat-label">{{ t('setting.burn_after_read.stats.rooms_enabled') }}</span>
          </div>
        </div>
      </n-spin>
    </div>

    <n-divider />

    <div class="settings-section">
      <n-alert type="warning" :show-icon="true">
        {{ t('setting.burn_after_read.warning') }}
      </n-alert>
    </div>

    <n-modal
      v-model:show="showEditRoom"
      preset="dialog"
      :title="t('setting.burn_after_read.rooms.edit_title')"
      :positive-text="t('setting.common.save')"
      :negative-text="t('setting.common.cancel')"
      @positive-click="handleSaveRoomBurn">
      <n-form>
        <n-form-item :label="t('setting.burn_after_read.rooms.duration_label')">
          <n-select v-model:value="editRoomDuration" :options="burnDurationOptions" style="width: 100%" />
        </n-form-item>
      </n-form>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { NAlert, NButton, NDivider, NForm, NFormItem, NModal, NSelect, NSpin, NSwitch, NTag, useDialog } from 'naive-ui'
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useBurnAfterRead } from '@/composables/useBurnAfterRead'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('BurnAfterReadSettings')

defineOptions({
  name: 'BurnAfterReadSettings'
})

const { showFeedback } = useActionFeedback()
const dialog = useDialog()
const { t } = useI18n()
const { getBurnStats, enableBurn, disableBurn } = useBurnAfterRead()
const settingStore = useSettingStore()

// 三个全局字段读写 settingStore，与移动端状态源一致
const globalBurnEnabled = ref(settingStore.burnDefaultEnabled)
// 显式标注 number；settingStore getter 返回联合类型 30|60|300|3600|86400，避免 ref 收窄后无法赋 number
const globalBurnDuration = ref<number>(settingStore.burnDefaultDuration)
const showBurnCountdown = ref(settingStore.burnShowCountdownEnabled)
// 三个纯 UI 偏好继续用 localStorage（无后端对应）
const autoBurnRead = ref(true)
const burnNotification = ref(true)
const burnSound = ref(false)

const loadingRooms = ref(false)
const loadingStats = ref(false)

interface BurnRoom {
  roomId: string
  name: string
  burnEnabled: boolean
  burnDuration: number
}

const burnRooms = ref<BurnRoom[]>([])

const burnStats = reactive({
  totalBurned: 0,
  totalPending: 0,
  roomsWithBurnEnabled: 0
})

const showEditRoom = ref(false)
const editRoomId = ref('')
const editRoomDuration = ref(60)

const burnDurationOptions = computed(() => [
  { label: t('setting.burn_after_read.durations.30_seconds'), value: 30 },
  { label: t('setting.burn_after_read.durations.1_minute'), value: 60 },
  { label: t('setting.burn_after_read.durations.5_minutes'), value: 300 },
  { label: t('setting.burn_after_read.durations.1_hour'), value: 3600 },
  { label: t('setting.burn_after_read.durations.24_hours'), value: 86400 }
])

const STORAGE_KEY = 'tjg-burn-after-read-settings'

onMounted(() => {
  loadSettings()
  loadBurnStats()
})

function loadSettings() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      const data = JSON.parse(saved)
      // 仅读取三个纯 UI 偏好；全局三字段已由 settingStore 提供
      if (data.autoBurnRead !== undefined) autoBurnRead.value = data.autoBurnRead
      if (data.burnNotification !== undefined) burnNotification.value = data.burnNotification
      if (data.burnSound !== undefined) burnSound.value = data.burnSound
      if (data.burnRooms) burnRooms.value = data.burnRooms
    } catch {
      // ignore
    }
  }
}

function saveSettings() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      autoBurnRead: autoBurnRead.value,
      burnNotification: burnNotification.value,
      burnSound: burnSound.value,
      burnRooms: burnRooms.value
    })
  )
}

async function loadBurnStats() {
  loadingStats.value = true
  try {
    const stats = await getBurnStats()
    if (stats) {
      burnStats.totalBurned = stats.totalBurned || 0
      burnStats.totalPending = stats.totalPending ?? 0
      burnStats.roomsWithBurnEnabled = stats.roomsWithBurnEnabled ?? 0
    }
  } catch {
    logger.error('Failed to load burn stats')
  } finally {
    loadingStats.value = false
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return t('setting.burn_after_read.formats.seconds', { count: String(seconds) })
  if (seconds < 3600) return t('setting.burn_after_read.formats.minutes', { count: String(Math.floor(seconds / 60)) })
  if (seconds < 86400) return t('setting.burn_after_read.formats.hours', { count: String(Math.floor(seconds / 3600)) })
  return t('setting.burn_after_read.formats.days', { count: String(Math.floor(seconds / 86400)) })
}

async function handleGlobalBurnToggle(value: boolean) {
  if (value) {
    dialog.warning({
      title: t('setting.burn_after_read.dialogs.enable_title'),
      content: t('setting.burn_after_read.dialogs.enable_content'),
      positiveText: t('setting.burn_after_read.dialogs.enable_confirm'),
      negativeText: t('setting.common.cancel'),
      onPositiveClick: () => {
        globalBurnEnabled.value = true
        settingStore.setBurnDefaultEnabled(true)
        saveSettings()
        showFeedback(t('setting.burn_after_read.feedback.global_enabled'), 'success')
      },
      onNegativeClick: () => {
        globalBurnEnabled.value = false
      }
    })
  } else {
    globalBurnEnabled.value = false
    settingStore.setBurnDefaultEnabled(false)
    saveSettings()
    showFeedback(t('setting.burn_after_read.feedback.global_disabled'), 'info')
  }
}

function handleBurnDurationChange(value: number) {
  globalBurnDuration.value = value
  settingStore.setBurnDefaultDuration(value)
  saveSettings()
  showFeedback(t('setting.burn_after_read.feedback.duration_changed', { duration: formatDuration(value) }), 'success')
}

function handleToggle(key: string) {
  // showBurnCountdown 已迁移至 settingStore，与全局三字段统一
  if (key === 'showBurnCountdown') {
    settingStore.setBurnShowCountdownEnabled(showBurnCountdown.value)
  }
  saveSettings()
  showFeedback(t('setting.burn_after_read.feedback.settings_updated'), 'success')
}

function handleEditRoomBurn(room: BurnRoom) {
  editRoomId.value = room.roomId
  editRoomDuration.value = room.burnDuration || globalBurnDuration.value
  showEditRoom.value = true
}

async function handleSaveRoomBurn() {
  try {
    await enableBurn(editRoomId.value, editRoomDuration.value * 1000)
    const room = burnRooms.value.find((r) => r.roomId === editRoomId.value)
    if (room) {
      room.burnDuration = editRoomDuration.value
    }
    saveSettings()
    showEditRoom.value = false
    showFeedback(t('setting.burn_after_read.feedback.room_duration_updated'), 'success')
    await loadBurnStats()
  } catch {
    showFeedback(t('setting.burn_after_read.feedback.room_duration_failed'), 'error')
  }
}

async function handleEnableRoomBurn(room: BurnRoom) {
  try {
    await enableBurn(room.roomId, globalBurnDuration.value * 1000)
    room.burnEnabled = true
    room.burnDuration = globalBurnDuration.value
    saveSettings()
    showFeedback(t('setting.burn_after_read.feedback.room_enabled'), 'success')
    await loadBurnStats()
  } catch {
    showFeedback(t('setting.burn_after_read.feedback.room_enable_failed'), 'error')
  }
}

async function handleDisableRoomBurn(room: BurnRoom) {
  try {
    await disableBurn(room.roomId)
    room.burnEnabled = false
    saveSettings()
    showFeedback(t('setting.burn_after_read.feedback.room_disabled'), 'success')
    await loadBurnStats()
  } catch {
    showFeedback(t('setting.burn_after_read.feedback.room_disable_failed'), 'error')
  }
}
</script>

<style scoped>
.burn-after-read-settings {
  padding: 0 var(--tjg-space-2);
}

.settings-section {
  margin-bottom: var(--tjg-space-4);
}

.section-title {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  margin-bottom: var(--tjg-space-3);
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

.room-list {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-2);
}

.room-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px var(--tjg-space-3);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-sm);
}

.room-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.room-name {
  font-size: var(--tjg-font-size-base);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
  word-break: break-all;
}

.room-burn-status {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  margin-top: var(--tjg-space-1);
}

.room-duration {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-secondary);
}

.room-actions {
  display: flex;
  gap: var(--tjg-space-1);
  flex-shrink: 0;
  margin-left: var(--tjg-space-3);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--tjg-space-3);
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--tjg-space-4);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-sm);
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--tjg-text-primary);
}

.stat-label {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
  margin-top: var(--tjg-space-1);
}

.empty-list {
  padding: var(--tjg-space-4);
  text-align: center;
}

.empty-text {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
}
</style>
