<template>
  <div
    ref="rootEl"
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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBurnAfterRead } from '@/composables/useBurnAfterRead'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useUserStore } from '@/stores/domains/user/user'
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
  senderId?: string
}>()

const burnAfterReadApi = useBurnAfterRead()
const chatStore = useChatStore()
const userStore = useUserStore()

const internalIsBurning = ref(props.isBurning || false)
const internalIsBurned = ref(props.isBurned || false)
const internalRemainingSeconds = ref(props.remainingSeconds || props.burnDuration || 60)

let countdownTimer: ReturnType<typeof setInterval> | null = null
const hasMarkedRead = ref(false)
let intersectionObserver: IntersectionObserver | null = null

const rootEl = ref<HTMLElement | null>(null)

// Fix 5: 消息进入视口时触发 markBurnRead，而非倒计时结束后。
// 正确流程：用户看到消息 → markBurnRead 通知后端 → 成功后设 isBurning=true → 启动倒计时。
onMounted(() => {
  if (!rootEl.value || typeof IntersectionObserver === 'undefined') return
  intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && !hasMarkedRead.value && !internalIsBurned.value) {
          hasMarkedRead.value = true
          handleMessageVisible()
        }
      }
    },
    { threshold: 0.5 }
  )
  intersectionObserver.observe(rootEl.value)
})

async function handleMessageVisible() {
  if (!props.roomId || !props.eventId) return
  // T6: 发送方不调用 markBurnRead（应由接收方触发）。
  // 发送方的倒计时由 BURN_MESSAGE_READ 事件驱动（接收方阅读后后端通知）。
  const currentUserId = userStore.userInfo?.uid
  if (props.senderId && currentUserId && props.senderId === currentUserId) return
  const success = await burnAfterReadApi.markMessageRead(props.eventId, props.roomId)
  if (success) {
    // Fix 4: 标记成功后设 isBurning=true，触发 watch → startCountdown
    chatStore.updateMsg({ msgId: props.msgId, isBurning: true })
  }
}

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
  // Fix 5: 移除 markMessageRead 调用（已在消息可见时调用）
  // 持久化 burned 状态到 store，防止组件重建后重复触发
  chatStore.updateMsg({
    msgId: props.msgId,
    isBurning: false,
    isBurned: true,
    burnRemainingSeconds: 0
  })
}

function clearCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

onUnmounted(() => {
  clearCountdown()
  intersectionObserver?.disconnect()
})

const showIndicator = computed(() => props.burnAfterRead)

const indicatorStatus = computed(() => {
  if (internalIsBurned.value) return 'burned'
  if (internalIsBurning.value) return 'burning'
  return 'waiting'
})
</script>

<style scoped>
.burn-message {
  position: relative;
  background: var(--tjg-surface-elevated);
  border-radius: 12px;
  padding: 12px;
  border: 1px solid var(--tjg-border-default);
  transition: all 0.3s ease;
}

.burn-message--burning {
  border-color: color-mix(in srgb, var(--tjg-color-danger-500) 50%, transparent);
  box-shadow: 0 0 12px color-mix(in srgb, var(--tjg-color-danger-500) 20%, transparent);
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
  background: color-mix(in srgb, var(--tjg-surface-panel) 90%, transparent);
  backdrop-filter: blur(2px);
  border-radius: 12px;
  z-index: 10;
}

.burn-message__burned-icon {
  width: 32px;
  height: 32px;
  color: var(--tjg-text-tertiary);
  margin-bottom: 8px;
}

.burn-message__burned-text {
  font-size: 12px;
  color: var(--tjg-text-tertiary);
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
