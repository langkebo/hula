<template>
  <Teleport to="body">
    <Transition name="guest-upgrade-fade">
      <div v-if="show" class="guest-upgrade-mask" @click.self="onMaskClick">
        <div class="guest-upgrade-dialog" role="dialog" aria-modal="true" aria-labelledby="guest-upgrade-title">
          <div class="guest-upgrade-dialog__header">
            <h2 id="guest-upgrade-title" class="guest-upgrade-dialog__title">{{ t('guest.upgrade.title') }}</h2>
            <button
              type="button"
              class="guest-upgrade-dialog__close"
              :aria-label="t('common.close')"
              :disabled="submitting"
              @click="close">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <p class="guest-upgrade-dialog__desc">{{ t('guest.upgrade.description') }}</p>
          <form class="guest-upgrade-dialog__form" @submit.prevent="submit">
            <label class="guest-upgrade-field">
              <span class="guest-upgrade-field__label">{{ t('guest.upgrade.username') }}</span>
              <input
                ref="usernameInput"
                v-model.trim="username"
                data-test="guest-upgrade-username"
                class="guest-upgrade-field__input"
                type="text"
                autocomplete="username"
                :placeholder="t('guest.upgrade.username_placeholder')"
                :disabled="submitting" />
            </label>
            <label class="guest-upgrade-field">
              <span class="guest-upgrade-field__label">{{ t('guest.upgrade.password') }}</span>
              <input
                v-model="password"
                data-test="guest-upgrade-password"
                class="guest-upgrade-field__input"
                type="password"
                autocomplete="new-password"
                :placeholder="t('guest.upgrade.password_placeholder')"
                :disabled="submitting" />
            </label>
            <p v-if="errorMessage" data-test="guest-upgrade-error" class="guest-upgrade-dialog__error" role="alert">
              {{ errorMessage }}
            </p>
            <p class="guest-upgrade-dialog__hint">{{ t('guest.upgrade.hint') }}</p>
            <div class="guest-upgrade-dialog__actions">
              <button
                type="button"
                class="guest-upgrade-btn guest-upgrade-btn--ghost"
                :disabled="submitting"
                @click="close">
                {{ t('guest.upgrade.cancel') }}
              </button>
              <button
                type="submit"
                data-test="guest-upgrade-submit"
                class="guest-upgrade-btn guest-upgrade-btn--primary"
                :disabled="submitting">
                {{ submitting ? t('guest.upgrade.submitting') : t('guest.upgrade.submit') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveDisplayMessage, toAppError } from '@/common/errors'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { MatrixAuthService } from '@/services/matrix/auth/MatrixAuthService'
import { sessionOrchestrator } from '@/services/matrix/auth/SessionOrchestrator'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('GuestUpgradeModal')

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const username = ref('')
const password = ref('')
const submitting = ref(false)
const errorMessage = ref('')
const usernameInput = ref<HTMLInputElement | null>(null)

function close() {
  if (submitting.value) return
  emit('update:show', false)
}

function onMaskClick() {
  close()
}

function reset() {
  username.value = ''
  password.value = ''
  errorMessage.value = ''
  submitting.value = false
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      reset()
      void nextTick(() => usernameInput.value?.focus())
    }
  }
)

async function submit() {
  if (submitting.value) return

  const name = username.value.trim()
  if (!name) {
    errorMessage.value = t('guest.upgrade.username_required')
    return
  }
  if (!password.value) {
    errorMessage.value = t('guest.upgrade.password_required')
    return
  }

  submitting.value = true
  errorMessage.value = ''
  try {
    const result = await MatrixAuthService.upgradeGuestAccount(name, password.value)
    // 身份切换后的收尾（换 MXID ⇒ 失效账号维度缓存 + 重取服务端能力）统一在
    // sessionOrchestrator.applyGuestUpgrade 内完成，本组件不再向外抛 `upgraded`：
    // 该事件自 e8eb8977 引入起从未有监听方，属误导性契约（check:component-contracts 已报）。
    await sessionOrchestrator.applyGuestUpgrade(result)
    showFeedback(t('guest.upgrade.success'), 'success')
    emit('update:show', false)
  } catch (err) {
    logger.error('guest account upgrade failed:', err)
    const appError = toAppError(err)
    errorMessage.value = resolveDisplayMessage(appError, (key: string) => t(key))
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.guest-upgrade-mask {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--tjg-overlay-mask-default);
}

.guest-upgrade-dialog {
  width: 100%;
  max-width: 360px;
  padding: 20px;
  border: 1px solid var(--tjg-border-default);
  border-radius: 10px;
  background: var(--tjg-surface-panel);
  box-shadow: 0 8px 24px var(--tjg-overlay-mask-subtle);
  color: var(--tjg-text-primary);
}

.guest-upgrade-dialog__header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.guest-upgrade-dialog__title {
  flex: 1;
  margin: 0;
  font-size: var(--tjg-font-size-lg);
  font-weight: 600;
}

.guest-upgrade-dialog__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--tjg-text-secondary);
  cursor: pointer;
}

.guest-upgrade-dialog__close:hover:not(:disabled) {
  background: var(--tjg-surface-subtle);
}

.guest-upgrade-dialog__close:focus-visible {
  outline: 2px solid var(--tjg-color-primary-500);
  outline-offset: 2px;
}

.guest-upgrade-dialog__desc,
.guest-upgrade-dialog__hint {
  margin: 8px 0 0;
  font-size: var(--tjg-font-size-sm);
  line-height: 1.5;
  color: var(--tjg-text-secondary);
}

.guest-upgrade-dialog__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.guest-upgrade-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.guest-upgrade-field__label {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-secondary);
}

.guest-upgrade-field__input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--tjg-border-default);
  border-radius: 6px;
  background: var(--tjg-surface-input);
  color: var(--tjg-text-primary);
  font-size: var(--tjg-font-size-base);
  transition: border-color var(--tjg-motion-duration-normal) ease;
}

.guest-upgrade-field__input:focus {
  border-color: var(--tjg-color-primary-500);
}

.guest-upgrade-field__input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.guest-upgrade-dialog__error {
  margin: 0;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-color-danger-500);
}

.guest-upgrade-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.guest-upgrade-btn {
  padding: 7px 14px;
  border-radius: 6px;
  font-size: var(--tjg-font-size-sm);
  cursor: pointer;
  transition: background var(--tjg-motion-duration-normal) ease;
}

.guest-upgrade-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.guest-upgrade-btn:focus-visible {
  outline: 2px solid var(--tjg-color-primary-500);
  outline-offset: 2px;
}

.guest-upgrade-btn--ghost {
  border: 1px solid var(--tjg-border-default);
  background: transparent;
  color: var(--tjg-text-secondary);
}

.guest-upgrade-btn--ghost:hover:not(:disabled) {
  background: var(--tjg-surface-subtle);
}

.guest-upgrade-btn--primary {
  border: 1px solid var(--tjg-color-primary-500);
  background: var(--tjg-color-primary-500);
  color: var(--tjg-text-inverse);
}

.guest-upgrade-btn--primary:hover:not(:disabled) {
  background: var(--tjg-color-primary-600);
  border-color: var(--tjg-color-primary-600);
}

.guest-upgrade-fade-enter-active,
.guest-upgrade-fade-leave-active {
  transition: opacity var(--tjg-motion-duration-normal) ease;
}

.guest-upgrade-fade-enter-from,
.guest-upgrade-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .guest-upgrade-fade-enter-active,
  .guest-upgrade-fade-leave-active,
  .guest-upgrade-field__input,
  .guest-upgrade-btn {
    transition: none;
  }
}
</style>
