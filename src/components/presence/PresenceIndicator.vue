<template>
  <div class="presence-indicator" :class="presenceClass" :style="indicatorStyle">
    <n-tooltip v-if="showTooltip" trigger="hover">
      <template #trigger>
        <span class="dot" :style="dotStyle"></span>
      </template>
      {{ tooltipText }}
    </n-tooltip>
    <span v-else class="dot" :style="dotStyle"></span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PresenceStatus } from '@/services/matrix/MatrixPresenceService'

const props = withDefaults(
  defineProps<{
    presence?: PresenceStatus
    size?: number
    showTooltip?: boolean
  }>(),
  {
    presence: 'offline',
    size: 10,
    showTooltip: true
  }
)

const { t } = useI18n()

const presenceClass = computed(() => props.presence)

const dotStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`
}))

const indicatorStyle = computed(() => ({
  '--dot-size': `${props.size}px`
}))

const tooltipText = computed(() => {
  switch (props.presence) {
    case 'online':
      return t('presence.online', '在线')
    case 'unavailable':
      return t('presence.unavailable', '离开')
    case 'busy':
      return t('presence.busy', '忙碌')
    default:
      return t('presence.offline', '离线')
  }
})
</script>

<style scoped lang="scss">
.presence-indicator {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  .dot {
    border-radius: 50%;
    display: block;
    border: 2px solid var(--bg-color, #fff);
  }

  &.online .dot {
    background-color: #52c41a;
  }

  &.unavailable .dot {
    background-color: #faad14;
  }

  &.busy .dot {
    background-color: #f5222d;
  }

  &.offline .dot {
    background-color: #bfbfbf;
  }
}
</style>
