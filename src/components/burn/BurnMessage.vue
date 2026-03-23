<template>
  <div class="burn-message" :class="{ 'burn-message--burning': isBurning, 'burn-message--burned': isBurned }">
    <div class="burn-message__content">
      <slot></slot>
    </div>
    <div class="burn-message__footer">
      <BurnIndicator
        v-if="showIndicator"
        :status="indicatorStatus"
        :remaining-seconds="remainingSeconds"
        :total-seconds="burnDuration" />
    </div>
    <Transition name="burn-fade">
      <div v-if="isBurned" class="burn-message__overlay">
        <svg class="burn-message__burned-icon">
          <use href="#burned"></use>
        </svg>
        <span class="burn-message__burned-text">此消息已销毁</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BurnIndicator from './BurnIndicator.vue'

const props = defineProps<{
  msgId: string
  burnAfterRead?: boolean
  burnDuration?: number
  remainingSeconds?: number
  isBurning?: boolean
  isBurned?: boolean
}>()

const showIndicator = computed(() => {
  return props.burnAfterRead && (props.isBurning || props.isBurned)
})

const indicatorStatus = computed(() => {
  if (props.isBurned) return 'burned'
  if (props.isBurning) return 'burning'
  return 'waiting'
})
</script>

<style scoped>
.burn-message {
  position: relative;
  background: var(--bg-popover);
  border-radius: 12px;
  padding: 12px;
  border: 1px solid var(--line-color);
  transition: all 0.3s ease;
}

.burn-message--burning {
  border-color: rgba(255, 87, 87, 0.5);
  box-shadow: 0 0 12px rgba(255, 87, 87, 0.2);
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
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(2px);
  border-radius: 12px;
  z-index: 10;
}

.burn-message__burned-icon {
  width: 32px;
  height: 32px;
  color: #909090;
  margin-bottom: 8px;
}

.burn-message__burned-text {
  font-size: 12px;
  color: #909090;
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
