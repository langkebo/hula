<template>
  <div v-if="show" class="mobile-burn-indicator" :class="`mobile-burn-indicator--${status}`">
    <div class="burn-icon">
      <Icon v-if="status === 'burning'" icon="mdi:timer-sand" :width="14" color="#ff4d4f" />
      <Icon v-else-if="status === 'burned'" icon="mdi:fire" :width="14" color="#999" />
      <Icon v-else icon="mdi:clock-outline" :width="14" color="#fa8c16" />
    </div>
    <div class="burn-content">
      <span v-if="status === 'burning'" class="burn-countdown">{{ formattedTime }}</span>
      <span v-else-if="status === 'burned'" class="burn-label">{{ t('burn.burned', '已销毁') }}</span>
      <span v-else class="burn-label">{{ t('burn.waiting', '等待阅读') }}</span>
    </div>
    <div v-if="status === 'burning'" class="burn-progress">
      <div class="burn-progress-bar" :style="{ width: `${progressPercent}%` }"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  remainingSeconds?: number
  totalSeconds?: number
  status: 'waiting' | 'burning' | 'burned'
}>()

const show = computed(() => {
  return props.status === 'burning' || props.status === 'burned' || props.status === 'waiting'
})

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
  if (!props.totalSeconds || !props.remainingSeconds) return 0
  return Math.max(0, Math.min(100, (props.remainingSeconds / props.totalSeconds) * 100))
})
</script>

<style scoped lang="scss">
.mobile-burn-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  position: relative;

  &--burning {
    background: rgba(255, 77, 79, 0.1);
    color: #ff4d4f;
  }

  &--burned {
    background: rgba(0, 0, 0, 0.04);
    color: #999;
  }

  &--waiting {
    background: rgba(250, 140, 22, 0.1);
    color: #fa8c16;
  }
}

.burn-icon {
  display: flex;
  align-items: center;
}

.burn-content {
  display: flex;
  align-items: center;
}

.burn-countdown {
  font-weight: 500;
}

.burn-label {
  font-size: 11px;
}

.burn-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(255, 77, 79, 0.2);
  border-radius: 0 0 10px 10px;
  overflow: hidden;
}

.burn-progress-bar {
  height: 100%;
  background: #ff4d4f;
  transition: width 1s linear;
}
</style>
