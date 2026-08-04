<template>
  <div
    class="tjg-space-join-cta"
    :class="{
      'is-loading': loading,
      'is-success': successPulse,
      'is-joined': membership === 'join',
      'is-invite-only': membership !== 'join' && joinRule === 'invite'
    }">
    <Transition name="cta-swap" mode="out-in">
      <div :key="viewKey" class="cta-panel">
        <template v-if="membership === 'join'">
          <n-button
            secondary
            block
            class="cta-button cta-button--secondary"
            :class="{ 'is-active': loadingAction === 'leave' }"
            :loading="loading"
            @click="handleLeave">
            <template #icon>
              <span class="cta-icon-wrap">
                <svg class="size-14px cta-icon"><use href="#logout"></use></svg>
              </span>
            </template>
            {{ t('space.leave') }}
          </n-button>
        </template>

        <template v-else-if="membership === 'invite'">
          <n-flex vertical :size="8" class="cta-stack">
            <n-button
              type="primary"
              block
              class="cta-button cta-button--primary"
              :class="{ 'is-active': loadingAction === 'join' }"
              :loading="loadingAction === 'join'"
              @click="handleJoin">
              <template #icon>
                <span class="cta-icon-wrap">
                  <svg class="size-14px cta-icon"><use href="#success"></use></svg>
                </span>
              </template>
              {{ t('room.invitation.accept') }}
            </n-button>
            <n-button
              secondary
              block
              class="cta-button cta-button--secondary"
              :class="{ 'is-active': loadingAction === 'leave' }"
              :loading="loadingAction === 'leave'"
              @click="handleLeave">
              <template #icon>
                <span class="cta-icon-wrap">
                  <svg class="size-14px cta-icon"><use href="#close"></use></svg>
                </span>
              </template>
              {{ t('room.invitation.reject') }}
            </n-button>
          </n-flex>
        </template>

        <template v-else>
          <div v-if="joinRule === 'invite'" class="cta-message">
            <span class="cta-message__icon-shell" aria-hidden="true">
              <svg class="size-16px color-[--tjg-text-tertiary] cta-message__icon"><use href="#lock"></use></svg>
            </span>
            <span>{{ t('space.invite_only_message') }}</span>
          </div>
          <n-button
            v-else
            type="primary"
            block
            class="cta-button cta-button--primary"
            :class="{ 'is-active': loadingAction === 'join' }"
            :loading="loading"
            :disabled="joinRule === 'invite'"
            @click="handleJoin">
            <template #icon>
              <span class="cta-icon-wrap">
                <svg class="size-14px cta-icon"><use href="#plus"></use></svg>
              </span>
            </template>
            {{ joinButtonText }}
          </n-button>
        </template>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSpace } from '@/composables/space'

type CtaAction = 'join' | 'leave'

const props = defineProps<{
  spaceId: string
  joinRule?: string
  membership?: string
}>()

const emit = defineEmits<{
  success: [action: CtaAction]
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { join, leave } = useSpace(() => props.spaceId)
const loading = ref(false)
const loadingAction = ref<'join' | 'leave' | null>(null)
const successPulse = ref(false)
let successTimer: ReturnType<typeof setTimeout> | null = null

const joinButtonText = computed(() => {
  if (props.joinRule === 'public') return t('space.join_public')
  if (props.joinRule === 'knock') return t('space.request_to_join')
  return t('space.join')
})

const viewKey = computed(() => `${props.membership || 'none'}-${props.joinRule || 'default'}`)

const triggerSuccessPulse = () => {
  successPulse.value = true
  if (successTimer) clearTimeout(successTimer)
  successTimer = setTimeout(() => {
    successPulse.value = false
    successTimer = null
  }, 1200)
}

const handleJoin = async () => {
  loading.value = true
  loadingAction.value = 'join'
  try {
    await join()
    triggerSuccessPulse()
    showFeedback(t('space.join_success'), 'success')
    emit('success', 'join')
  } catch (err) {
    showFeedback(t('space.join_failed'), 'error')
  } finally {
    loading.value = false
    loadingAction.value = null
  }
}

const handleLeave = async () => {
  loading.value = true
  loadingAction.value = 'leave'
  try {
    await leave()
    triggerSuccessPulse()
    showFeedback(t('space.leave_success'), 'success')
    emit('success', 'leave')
  } catch (err) {
    showFeedback(t('space.leave_failed'), 'error')
  } finally {
    loading.value = false
    loadingAction.value = null
  }
}

onBeforeUnmount(() => {
  if (successTimer) clearTimeout(successTimer)
})
</script>

<style scoped lang="scss">
.tjg-space-join-cta {
  width: 100%;
  position: relative;
}

.cta-panel {
  position: relative;
}

.cta-stack {
  width: 100%;
}

.cta-button {
  position: relative;
  overflow: hidden;
  transform: translateY(0) scale(1);
  transition:
    transform var(--tjg-motion-duration-fast, 0.2s) var(--tjg-motion-ease-standard, ease),
    box-shadow var(--tjg-motion-duration-fast, 0.2s) var(--tjg-motion-ease-standard, ease),
    filter var(--tjg-motion-duration-fast, 0.2s) var(--tjg-motion-ease-standard, ease);
}

.cta-button:hover {
  transform: translateY(-1px);
}

.cta-button.is-active {
  transform: translateY(-1px) scale(0.992);
}

.cta-button::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  opacity: 0;
  pointer-events: none;
  background: linear-gradient(
    110deg,
    transparent 0%,
    color-mix(in srgb, var(--tjg-color-primary-100) 60%, transparent) 42%,
    transparent 78%
  );
  transform: translateX(-110%);
}

.tjg-space-join-cta.is-loading .cta-button::after {
  opacity: 0.9;
  animation: cta-shimmer 1.15s linear infinite;
}

.tjg-space-join-cta.is-success .cta-button--primary,
.tjg-space-join-cta.is-success .cta-button--secondary,
.tjg-space-join-cta.is-success .cta-message {
  animation: cta-success-pop 0.46s var(--tjg-motion-ease-standard, ease) 1;
}

.cta-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transform-origin: center;
}

.cta-icon {
  transition:
    transform var(--tjg-motion-duration-fast, 0.2s) var(--tjg-motion-ease-standard, ease),
    opacity var(--tjg-motion-duration-fast, 0.2s) var(--tjg-motion-ease-standard, ease);
}

.cta-button:hover .cta-icon,
.cta-button.is-active .cta-icon {
  transform: translateX(1px) scale(1.06);
}

.cta-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: var(--tjg-surface-panel-muted);
  border-radius: 8px;
  font-size: 12px;
  border: 1px solid var(--tjg-border-default);
  transition:
    transform var(--tjg-motion-duration-fast, 0.2s) var(--tjg-motion-ease-standard, ease),
    border-color var(--tjg-motion-duration-fast, 0.2s) var(--tjg-motion-ease-standard, ease),
    background-color var(--tjg-motion-duration-fast, 0.2s) var(--tjg-motion-ease-standard, ease);
}

.tjg-space-join-cta.is-invite-only .cta-message {
  background: color-mix(in srgb, var(--tjg-surface-panel-muted) 88%, var(--tjg-color-primary-100));
}

.cta-message__icon-shell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--tjg-border-default) 72%, transparent);
}

.cta-message__icon {
  animation: cta-float 2.4s ease-in-out infinite;
}

.cta-swap-enter-active,
.cta-swap-leave-active {
  transition:
    opacity var(--tjg-motion-duration-fast, 0.2s) var(--tjg-motion-ease-standard, ease),
    transform var(--tjg-motion-duration-fast, 0.2s) var(--tjg-motion-ease-standard, ease);
}

.cta-swap-enter-from,
.cta-swap-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.985);
}

@keyframes cta-shimmer {
  from {
    transform: translateX(-110%);
  }
  to {
    transform: translateX(110%);
  }
}

@keyframes cta-success-pop {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--tjg-color-primary-300-alpha) 80%, transparent);
  }
  45% {
    transform: scale(1.018);
    box-shadow: 0 0 0 8px color-mix(in srgb, var(--tjg-color-primary-300-alpha) 20%, transparent);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 transparent;
  }
}

@keyframes cta-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-1.5px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cta-button,
  .cta-icon,
  .cta-message,
  .cta-swap-enter-active,
  .cta-swap-leave-active {
    transition: none;
  }

  .cta-message__icon,
  .tjg-space-join-cta.is-loading .cta-button::after,
  .tjg-space-join-cta.is-success .cta-button--primary,
  .tjg-space-join-cta.is-success .cta-button--secondary,
  .tjg-space-join-cta.is-success .cta-message {
    animation: none;
  }
}
</style>
