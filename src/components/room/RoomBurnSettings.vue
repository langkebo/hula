<template>
  <div class="room-burn-settings" data-testid="room-burn-settings">
    <div class="room-burn-settings__header">
      <svg class="room-burn-settings__icon" aria-hidden="true">
        <use href="#timer"></use>
      </svg>
      <span class="room-burn-settings__title">{{ t('room.burn.title') }}</span>
    </div>

    <div class="room-burn-settings__row">
      <div class="room-burn-settings__info">
        <span class="room-burn-settings__label">{{ t('room.burn.enable_label') }}</span>
        <span class="room-burn-settings__desc">{{ t('room.burn.enable_desc') }}</span>
      </div>
      <n-switch data-testid="room-burn-toggle" :value="enabled" :loading="toggling" @update:value="handleToggle" />
    </div>

    <div class="room-burn-settings__row">
      <div class="room-burn-settings__info">
        <span class="room-burn-settings__label">{{ t('room.burn.duration_label') }}</span>
        <span class="room-burn-settings__desc">{{ t('room.burn.duration_desc') }}</span>
      </div>
      <n-select
        data-testid="room-burn-duration"
        :value="durationSeconds"
        :options="durationOptions"
        style="width: 130px"
        @update:value="handleDurationChange" />
    </div>

    <div class="room-burn-settings__pending">
      <span data-testid="room-burn-pending-count">
        {{ t('room.burn.pending_count', { count: pendingCount }) }}
      </span>
    </div>

    <p v-if="enabled" class="room-burn-settings__tip">{{ t('room.burn.tip') }}</p>
  </div>
</template>

<script setup lang="ts">
import { NSelect, NSwitch } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBurnAfterRead } from '@/composables/useBurnAfterRead'

const props = defineProps<{ roomId: string }>()
const { t } = useI18n()
const burn = useBurnAfterRead()

const enabled = ref(false)
const durationSeconds = ref(60)
const pendingCount = ref(0)
const toggling = ref(false)

const durationOptions = computed(() => [
  { label: t('setting.burn_after_read.durations.30_seconds'), value: 30 },
  { label: t('setting.burn_after_read.durations.1_minute'), value: 60 },
  { label: t('setting.burn_after_read.durations.5_minutes'), value: 300 },
  { label: t('setting.burn_after_read.durations.1_hour'), value: 3600 },
  { label: t('setting.burn_after_read.durations.24_hours'), value: 86400 }
])

async function loadState() {
  await burn.refreshBurnSettings(props.roomId)
  enabled.value = burn.isRoomBurnEnabled(props.roomId)
  durationSeconds.value = Math.max(1, Math.round(burn.getRoomBurnDuration(props.roomId) / 1000)) || 60
  const pending = await burn.getPendingBurns(props.roomId)
  pendingCount.value = pending.length
}

async function handleToggle(val: boolean) {
  toggling.value = true
  try {
    if (val) {
      await burn.enableBurn(props.roomId, durationSeconds.value * 1000)
    } else {
      await burn.disableBurn(props.roomId)
    }
    enabled.value = val
    await loadState()
  } finally {
    toggling.value = false
  }
}

async function handleDurationChange(val: number) {
  durationSeconds.value = val
  if (enabled.value) {
    await burn.enableBurn(props.roomId, val * 1000)
    await loadState()
  }
}

onMounted(loadState)
watch(() => props.roomId, loadState)
</script>

<style scoped>
.room-burn-settings {
  padding: var(--tjg-space-3) var(--tjg-space-4);
  border-top: 1px solid var(--tjg-border-layout-divider);
}

.room-burn-settings__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: var(--tjg-space-3);
}

.room-burn-settings__icon {
  width: 16px;
  height: 16px;
  color: var(--tjg-color-danger-500);
}

.room-burn-settings__title {
  font-size: var(--tjg-font-size-base);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
}

.room-burn-settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--tjg-space-2) 0;
}

.room-burn-settings__info {
  display: flex;
  flex-direction: column;
}

.room-burn-settings__label {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-primary);
}

.room-burn-settings__desc {
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-tertiary);
  margin-top: 2px;
}

.room-burn-settings__pending {
  padding: var(--tjg-space-2) 0;
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-secondary);
}

.room-burn-settings__tip {
  margin-top: var(--tjg-space-2);
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-quaternary);
}
</style>
