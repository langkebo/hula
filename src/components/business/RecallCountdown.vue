<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTimerManager } from '@/utils/TimerManager'

interface Props {
  /** 消息发送时间 */
  sendTime: number
  /** 撤回时限 (毫秒), 默认 2 分钟 */
  expirationTime?: number
}

const props = withDefaults(defineProps<Props>(), {
  expirationTime: () => 2 * 60 * 1000
})

const timerManager = useTimerManager()
const remainingSeconds = ref(0)
let timer: number | null = null

const { t } = useI18n()
const cannotRecallText = computed(() => t('chat.recall.cannot_recall'))

const canRecall = computed(() => remainingSeconds.value > 0)

const formattedTime = computed(() => {
  if (remainingSeconds.value <= 0) {
    return '已过期'
  }
  const minutes = Math.floor(remainingSeconds.value / 60)
  const seconds = remainingSeconds.value % 60
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }
  return `${seconds}s`
})

const updateRemainingTime = () => {
  const elapsed = Date.now() - props.sendTime
  const remaining = Math.max(0, Math.ceil((props.expirationTime - elapsed) / 1000))
  remainingSeconds.value = remaining

  if (remaining <= 0 && timer) {
    timerManager.clearInterval(timer)
    timer = null
  }
}

onMounted(() => {
  updateRemainingTime()
  if (remainingSeconds.value > 0) {
    timer = timerManager.setInterval(updateRemainingTime, 1000)
  }
})

onUnmounted(() => {
  if (timer) {
    timerManager.clearInterval(timer)
    timer = null
  }
  timerManager.clearAll()
})

defineExpose({
  canRecall,
  remainingSeconds
})
</script>

<template>
  <span class="recall-countdown" :class="{ 'can-recall': canRecall, expired: !canRecall }">
    <template v-if="canRecall">
      <span class="icon">⏱️</span>
      <span class="time">{{ formattedTime }}</span>
    </template>
    <template v-else>
      <span class="expired-text">{{ cannotRecallText }}</span>
    </template>
  </span>
</template>

<style scoped lang="scss">
.recall-countdown {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;

  &.can-recall {
    color: var(--hula-color-primary-500);

    .time {
      font-weight: 500;
    }
  }

  &.expired {
    color: var(--hula-text-tertiary);
  }

  .icon {
    font-size: 12px;
  }

  .expired-text {
    opacity: 0.6;
  }
}
</style>
