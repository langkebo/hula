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
        class="w-130px"
        @update:value="handleDurationChange" />
    </div>

    <div class="room-burn-settings__pending">
      <span data-testid="room-burn-pending-count">
        {{ t('room.burn.pending_count', { count: pendingCount }) }}
      </span>
    </div>

    <PendingBurnMessages v-if="enabled && pendingCount > 0" :room-id="props.roomId" />

    <p v-if="enabled" class="room-burn-settings__tip">{{ t('room.burn.tip') }}</p>
  </div>
</template>

<script setup lang="ts">
import { NSelect, NSwitch } from 'naive-ui'
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useBurnDurationOptions } from '@/composables/settings/settingsOptions'
import { useBurnAfterRead } from '@/composables/useBurnAfterRead'
import PendingBurnMessages from './PendingBurnMessages.vue'

const props = defineProps<{ roomId: string }>()
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const burn = useBurnAfterRead()

const enabled = ref(false)
const durationSeconds = ref(60)
const pendingCount = ref(0)
const toggling = ref(false)

const durationOptions = useBurnDurationOptions()
const ALLOWED_DURATION_SECONDS = [60, 300, 1800]

async function loadState() {
  await burn.refreshBurnSettings(props.roomId)
  enabled.value = burn.isRoomBurnEnabled(props.roomId)
  // 旧房间可能存着 SDK 已不再接受的时长（30s / 1h / 24h），回落到 1 分钟档
  const storedSeconds = Math.max(1, Math.round(burn.getRoomBurnDuration(props.roomId) / 1000)) || 60
  durationSeconds.value = ALLOWED_DURATION_SECONDS.includes(storedSeconds) ? storedSeconds : 60
  const pending = await burn.getPendingBurns(props.roomId)
  pendingCount.value = pending.length
}

async function handleToggle(val: boolean) {
  toggling.value = true
  try {
    const ok = val
      ? await burn.enableBurn(props.roomId, durationSeconds.value * 1000)
      : await burn.disableBurn(props.roomId)
    if (!ok) {
      showFeedback(t('room.burn.update_failed'), 'error')
      return
    }
    enabled.value = val
    await loadState()
  } finally {
    toggling.value = false
  }
}

async function handleDurationChange(val: number) {
  const previousSeconds = durationSeconds.value
  durationSeconds.value = val
  if (!enabled.value) return
  const ok = await burn.enableBurn(props.roomId, val * 1000)
  if (!ok) {
    durationSeconds.value = previousSeconds
    showFeedback(t('room.burn.update_failed'), 'error')
    return
  }
  await loadState()
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
