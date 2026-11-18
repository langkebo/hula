<template>
  <section class="room-voice-stats" data-testid="room-voice-stats">
    <header class="flex items-center justify-between mb-[--tjg-space-1]">
      <h4 class="text-[length:var(--tjg-font-size-sm)] font-[--tjg-font-weight-semibold] color-[--tjg-text-secondary]">
        {{ t('room.detail.voice.title') }}
      </h4>
      <button
        type="button"
        class="room-voice-stats__refresh"
        :aria-label="t('common.refresh')"
        :title="t('common.refresh')"
        :disabled="loading"
        data-testid="room-voice-stats-refresh"
        @click="load">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M20 11a8 8 0 1 0-2.34 5.66" stroke-linecap="round" />
          <path d="M20 4v7h-7" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </header>

    <div
      v-if="loading"
      class="text-[length:var(--tjg-font-size-xs)] color-[--tjg-text-tertiary] py-[--tjg-space-2]"
      data-testid="room-voice-stats-loading">
      {{ t('common.loading') }}
    </div>

    <div
      v-else-if="failed"
      class="flex items-center justify-between gap-[--tjg-space-2] py-[--tjg-space-1]"
      data-testid="room-voice-stats-error">
      <span class="text-[length:var(--tjg-font-size-xs)] color-[--tjg-status-error]">
        {{ t('room.detail.voice.load_failed') }}
      </span>
      <button
        type="button"
        class="room-voice-stats__retry text-[length:var(--tjg-font-size-xs)]"
        data-testid="room-voice-stats-retry"
        @click="load">
        {{ t('common.retry') }}
      </button>
    </div>

    <p
      v-else-if="!stats || stats.totalMessages === 0"
      class="text-[length:var(--tjg-font-size-xs)] color-[--tjg-text-tertiary] py-[--tjg-space-2]"
      data-testid="room-voice-stats-empty">
      {{ t('room.detail.voice.empty') }}
    </p>

    <dl v-else class="room-voice-stats__grid" data-testid="room-voice-stats-data">
      <div class="room-voice-stats__item">
        <dt class="text-[length:var(--tjg-font-size-2xs)] color-[--tjg-text-tertiary]">
          {{ t('room.detail.voice.messages') }}
        </dt>
        <dd class="text-[length:var(--tjg-font-size-sm)] font-[--tjg-font-weight-semibold] color-[--tjg-text-primary]">
          {{ stats.totalMessages }}
        </dd>
      </div>
      <div class="room-voice-stats__item">
        <dt class="text-[length:var(--tjg-font-size-2xs)] color-[--tjg-text-tertiary]">
          {{ t('room.detail.voice.total_duration') }}
        </dt>
        <dd class="text-[length:var(--tjg-font-size-sm)] font-[--tjg-font-weight-semibold] color-[--tjg-text-primary]">
          {{ formatDuration(stats.totalDuration) }}
        </dd>
      </div>
      <div class="room-voice-stats__item">
        <dt class="text-[length:var(--tjg-font-size-2xs)] color-[--tjg-text-tertiary]">
          {{ t('room.detail.voice.average_duration') }}
        </dt>
        <dd class="text-[length:var(--tjg-font-size-sm)] font-[--tjg-font-weight-semibold] color-[--tjg-text-primary]">
          {{ formatDuration(stats.averageDuration) }}
        </dd>
      </div>
    </dl>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixVoiceService } from '@/services/matrix/media/MatrixVoiceService'
import type { VoiceStats } from '@/services/matrix/media/voiceStatsOps'

const props = defineProps<{
  roomId: string
}>()

const { t } = useI18n()

const stats = ref<VoiceStats | null>(null)
const loading = ref(false)
const failed = ref(false)

/** 秒级时长转 `mm:ss`（超过 1 小时用 `h:mm:ss`），非法值回退 `0:00`。 */
const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00'
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60
  const mm = String(minutes).padStart(hours > 0 ? 2 : 1, '0')
  const ss = String(rest).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

const load = async () => {
  if (!props.roomId) {
    stats.value = null
    failed.value = false
    return
  }
  loading.value = true
  failed.value = false
  try {
    stats.value = await matrixVoiceService.getRoomVoiceStats(props.roomId)
  } catch {
    stats.value = null
    failed.value = true
  } finally {
    loading.value = false
  }
}

watch(() => props.roomId, load, { immediate: true })
</script>

<style scoped>
.room-voice-stats__refresh {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--tjg-text-tertiary);
  cursor: pointer;
}

.room-voice-stats__refresh svg {
  width: 14px;
  height: 14px;
}

.room-voice-stats__refresh:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.room-voice-stats__retry {
  border: none;
  background: transparent;
  color: var(--tjg-color-primary-500);
  cursor: pointer;
  padding: 0;
}

.room-voice-stats__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--tjg-space-2);
  margin: 0;
}

.room-voice-stats__item {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-1);
  padding: var(--tjg-space-2);
  border-radius: var(--tjg-radius-md);
  background: var(--tjg-surface-sunken);
}

.room-voice-stats__item dd {
  margin: 0;
}
</style>
