<template>
  <div
    class="burn-message"
    :class="{ 'burn-message--burning': internalIsBurning, 'burn-message--burned': internalIsBurned }">
    <div class="burn-message__content">
      <slot></slot>
    </div>
    <div class="burn-message__footer">
      <BurnIndicator
        v-if="showIndicator"
        :status="indicatorStatus"
        :remaining-seconds="internalRemainingSeconds"
        :total-seconds="burnDuration || 60" />
    </div>
    <Transition name="burn-fade">
      <div v-if="internalIsBurned" class="burn-message__overlay">
        <svg class="burn-message__burned-icon">
          <use href="#burned"></use>
        </svg>
        <span class="burn-message__burned-text">{{ t('chat.burn.message_destroyed') }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBurnAfterRead } from '@/composables/useBurnAfterRead'
import BurnIndicator from './BurnIndicator.vue'

const { t } = useI18n()

const props = defineProps<{
  msgId: string
  burnAfterRead?: boolean
  burnDuration?: number
  remainingSeconds?: number
  isBurning?: boolean
  isBurned?: boolean
  roomId?: string
  eventId?: string
}>()

const burnAfterReadApi = useBurnAfterRead()

const internalIsBurning = ref(props.isBurning || false)
const internalIsBurned = ref(props.isBurned || false)
const internalRemainingSeconds = ref(props.remainingSeconds || props.burnDuration || 60)

let countdownTimer: ReturnType<typeof setInterval> | null = null

watch(
  () => props.isBurning,
  (val) => {
    if (val && !internalIsBurned.value) {
      internalIsBurning.value = true
      startCountdown()
    }
  }
)

watch(
  () => props.isBurned,
  (val) => {
    if (val) {
      internalIsBurned.value = true
      internalIsBurning.value = false
      clearCountdown()
    }
  }
)

watch(
  () => props.remainingSeconds,
  (val) => {
    if (val !== undefined) {
      internalRemainingSeconds.value = val
    }
  }
)

function startCountdown() {
  clearCountdown()
  const duration = props.burnDuration || 60
  const startTime = Date.now()

  countdownTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    const remaining = Math.max(0, duration - elapsed)
    internalRemainingSeconds.value = remaining

    if (remaining <= 0) {
      clearCountdown()
      completeBurn()
    }
  }, 1000)
}

async function completeBurn() {
  internalIsBurning.value = false
  internalIsBurned.value = true
  internalRemainingSeconds.value = 0

  if (props.roomId && props.eventId) {
    try {
      await burnAfterReadApi.markMessageRead(props.roomId, props.eventId)
    } catch {
      // silent
    }
  }
}

function clearCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

onUnmounted(() => {
  clearCountdown()
})

const showIndicator = computed(() => {
  return props.burnAfterRead && (internalIsBurning.value || internalIsBurned.value || props.burnAfterRead)
})

const indicatorStatus = computed(() => {
  if (internalIsBurned.value) return 'burned'
  if (internalIsBurning.value) return 'burning'
  return 'waiting'
})
</script>

<style scoped>
.burn-message {
  position: relative;
  background: var(--hula-surface-elevated);
  border-radius: 12px;
  padding: 12px;
  border: 1px solid var(--hula-border-default);
  transition: all 0.3s ease;
}

.burn-message--burning {
  border-color: color-mix(in srgb, var(--hula-color-danger-500) 50%, transparent);
  box-shadow: 0 0 12px color-mix(in srgb, var(--hula-color-danger-500) 20%, transparent);
}

.burn-message--burned {
  opacity: 0.6;
  filter: grayscale(0.5);
}

.burn-message__content {
  position: relative;
  z-index: 1;
}

.burn-message__footer {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
}

.burn-message__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--hula-surface-panel) 90%, transparent);
  backdrop-filter: blur(2px);
  border-radius: 12px;
  z-index: 10;
}

.burn-message__burned-icon {
  width: 32px;
  height: 32px;
  color: var(--hula-text-tertiary);
  margin-bottom: 8px;
}

.burn-message__burned-text {
  font-size: 12px;
  color: var(--hula-text-tertiary);
}

.burn-fade-enter-active,
.burn-fade-leave-active {
  transition: opacity 0.5s ease;
}

.burn-fade-enter-from,
.burn-fade-leave-to {
  opacity: 0;
}
</style>
