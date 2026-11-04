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
          class="pref-width-130"
          @update:value="handleBurnDurationChange" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.burn_after_read.global.countdown_label') }}</span>
          <span class="setting-desc">{{ t('setting.burn_after_read.global.countdown_desc') }}</span>
        </div>
        <n-switch v-model:value="showBurnCountdown" @update:value="handleCountdownToggle" />
      </div>
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
  </div>
</template>

<script setup lang="ts">
import { NAlert, NDivider, NSelect, NSpin, NSwitch, useDialog } from 'naive-ui'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useBurnAfterReadSettings } from '@/composables/useBurnAfterReadSettings'

defineOptions({
  name: 'BurnAfterReadSettings'
})

const { showFeedback } = useActionFeedback()
const dialog = useDialog()
const { t } = useI18n()

// 全局字段、统计与时长格式化统一由共享 composable 提供，桌面只保留 Naive UI 交互差异
const {
  globalEnabled: globalBurnEnabled,
  defaultDuration: globalBurnDuration,
  showCountdown: showBurnCountdown,
  loadingStats,
  burnStats,
  formatDuration,
  loadBurnStats,
  setGlobalEnabled,
  setDefaultDuration,
  setShowCountdown
} = useBurnAfterReadSettings()

// 桌面用显式时长文案（durations.*），与移动端 formats.* 的派生文案不同
const burnDurationOptions = computed(() => [
  { label: t('setting.burn_after_read.durations.30_seconds'), value: 30 },
  { label: t('setting.burn_after_read.durations.1_minute'), value: 60 },
  { label: t('setting.burn_after_read.durations.5_minutes'), value: 300 },
  { label: t('setting.burn_after_read.durations.1_hour'), value: 3600 },
  { label: t('setting.burn_after_read.durations.24_hours'), value: 86400 }
])

onMounted(() => {
  loadBurnStats()
})

async function handleGlobalBurnToggle(value: boolean) {
  if (value) {
    dialog.warning({
      title: t('setting.burn_after_read.dialogs.enable_title'),
      content: t('setting.burn_after_read.dialogs.enable_content'),
      positiveText: t('setting.burn_after_read.dialogs.enable_confirm'),
      negativeText: t('setting.common.cancel'),
      onPositiveClick: () => {
        setGlobalEnabled(true)
        showFeedback(t('setting.burn_after_read.feedback.global_enabled'), 'success')
      },
      onNegativeClick: () => {
        setGlobalEnabled(false)
      }
    })
  } else {
    setGlobalEnabled(false)
    showFeedback(t('setting.burn_after_read.feedback.global_disabled'), 'info')
  }
}

function handleBurnDurationChange(value: number) {
  setDefaultDuration(value)
  showFeedback(t('setting.burn_after_read.feedback.duration_changed', { duration: formatDuration(value) }), 'success')
}

function handleCountdownToggle() {
  setShowCountdown(showBurnCountdown.value)
  showFeedback(t('setting.burn_after_read.feedback.settings_updated'), 'success')
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

/* 统一选择器宽度 */
.pref-width-130 {
  width: 130px;
}
</style>
