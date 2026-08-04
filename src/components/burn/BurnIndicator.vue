<template>
  <div v-if="show" class="burn-indicator" :class="`burn-indicator--${status}`">
    <div class="burn-indicator__icon">
      <svg v-if="status === 'burning'" class="burn-indicator__flame">
        <use href="#timer"></use>
      </svg>
      <svg v-else-if="status === 'burned'" class="burn-indicator__done">
        <use href="#burned"></use>
      </svg>
      <svg v-else class="burn-indicator__waiting">
        <use href="#hourglass"></use>
      </svg>
    </div>
    <div class="burn-indicator__content">
      <span v-if="status === 'burning'" class="burn-indicator__countdown">
        {{ formattedTime }}
      </span>
      <span v-else-if="status === 'burned'" class="burn-indicator__label">{{ t('chat.burn.destroyed') }}</span>
      <span v-else class="burn-indicator__label">{{ t('chat.burn.waiting_read') }}</span>
    </div>
    <div v-if="status === 'burning'" class="burn-indicator__progress">
      <div class="burn-indicator__progress-bar" :style="{ width: `${progressPercent}%` }"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  remainingSeconds?: number
  totalSeconds?: number
  status: 'waiting' | 'burning' | 'burned'
}>()

const formattedTime = computed(() => {
  if (props.remainingSeconds === undefined || props.remainingSeconds === null) return ''
  const seconds = Math.max(0, props.remainingSeconds)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
})

const progressPercent = computed(() => {
  if (!props.totalSeconds || !props.remainingSeconds) return 100
  return Math.max(0, Math.min(100, (props.remainingSeconds / props.totalSeconds) * 100))
})

const show = computed(() => {
  return props.status !== 'waiting' || props.remainingSeconds !== undefined
})
</script>

<style scoped>
.burn-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  background: var(--tjg-surface-list-hover);
  border: 1px solid var(--tjg-border-default);
  transition: all 0.3s ease;
}

.burn-indicator--burning {
  background: color-mix(in srgb, var(--tjg-color-danger-500) 10%, transparent);
  border-color: color-mix(in srgb, var(--tjg-color-danger-500) 30%, transparent);
  color: var(--tjg-color-danger-500);
}

.burn-indicator--burned {
  background: rgba(108, 108, 108, 0.1);
  border-color: rgba(108, 108, 108, 0.3);
  color: var(--tjg-text-tertiary);
}

.burn-indicator--waiting {
  background: var(--tjg-color-warning-100);
  border-color: color-mix(in srgb, var(--tjg-color-warning-500) 30%, transparent);
  color: var(--tjg-color-warning-500);
}

.burn-indicator__icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.burn-indicator__flame,
.burn-indicator__done,
.burn-indicator__waiting {
  width: 14px;
  height: 14px;
}

.burn-indicator--burning .burn-indicator__flame {
  animation: pulse-flame 1s infinite;
}

@keyframes pulse-flame {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
}

.burn-indicator__content {
  display: flex;
  align-items: center;
}

.burn-indicator__countdown {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.burn-indicator__label {
  white-space: nowrap;
}

.burn-indicator__progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(255, 87, 87, 0.2);
  border-radius: 0 0 12px 12px;
  overflow: hidden;
}

.burn-indicator__progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--tjg-color-danger-500), var(--tjg-color-danger-400));
  transition: width 1s linear;
}
</style>
