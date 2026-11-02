<template>
  <div class="decryption-failure-card" data-testid="decryption-failure-card" role="note">
    <div class="decryption-failure-card__head">
      <svg class="decryption-failure-card__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="10" width="16" height="11" rx="2" stroke="var(--tjg-text-tertiary)" stroke-width="1.5" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="var(--tjg-text-tertiary)" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      <span class="decryption-failure-card__title">{{ t('message_container.decrypt_failed.title') }}</span>
    </div>
    <!-- 文案不依赖正文：m.bad.encrypted 事件可能没有 body -->
    <p class="decryption-failure-card__desc">{{ t('message_container.decrypt_failed.desc') }}</p>
    <p v-if="failed" class="decryption-failure-card__error" role="alert" data-testid="decryption-failure-error">
      {{ t('message_container.decrypt_failed.retry_failed') }}
    </p>
    <div class="decryption-failure-card__actions">
      <button
        type="button"
        class="decryption-failure-card__button"
        data-testid="decryption-retry"
        :disabled="retrying"
        @click="handleRetry">
        {{ retrying ? t('message_container.decrypt_failed.retrying') : t('message_container.retry') }}
      </button>
      <button
        type="button"
        class="decryption-failure-card__button decryption-failure-card__button--ghost"
        data-testid="decryption-toggle-raw"
        :disabled="rawLoading"
        @click="handleToggleRaw">
        {{
          rawVisible ? t('message_container.decrypt_failed.hide_raw') : t('message_container.decrypt_failed.view_raw')
        }}
      </button>
    </div>
    <pre v-if="rawVisible" class="decryption-failure-card__raw" data-testid="decryption-failure-raw">{{
      rawContent
    }}</pre>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixMessageService } from '@/services/matrix/messaging/MatrixMessageService'

const props = defineProps<{
  roomId: string
  eventId: string
}>()

const { t } = useI18n()

const retrying = ref(false)
const failed = ref(false)
const rawVisible = ref(false)
const rawLoading = ref(false)
const rawContent = ref('')

/**
 * 重试解密。
 *
 * 单飞：按钮在 retrying 期间 disabled；SDK 内部还会用 `decryptionPromise` 合并同一事件的并发解密。
 * 成功后不在这里写 store —— SDK 会 emit `Event.decrypted`，由 room store 用同一事件 ID
 * 原地替换正文与类型，本卡片随 `isBadEncrypted` 变 false 被卸载。失败则保留卡片。
 */
async function handleRetry(): Promise<void> {
  if (retrying.value) return
  retrying.value = true
  failed.value = false
  try {
    const ok = await matrixMessageService.retryDecryptMessage(props.roomId, props.eventId)
    failed.value = !ok
  } finally {
    retrying.value = false
  }
}

async function handleToggleRaw(): Promise<void> {
  if (rawVisible.value) {
    rawVisible.value = false
    return
  }
  if (!rawContent.value && !rawLoading.value) {
    rawLoading.value = true
    try {
      const json = await matrixMessageService.getRawMessageJson(props.roomId, props.eventId)
      rawContent.value = json ?? t('message_container.decrypt_failed.raw_unavailable')
    } finally {
      rawLoading.value = false
    }
  }
  rawVisible.value = true
}

defineExpose({ handleRetry, handleToggleRaw })
</script>

<style scoped lang="scss">
.decryption-failure-card {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-2);
  max-width: var(--bubble-max-width, 100%);
  padding: var(--tjg-space-3) var(--tjg-space-4);
  border: 1px solid var(--tjg-border-default);
  border-radius: var(--tjg-radius-lg);
  background: var(--tjg-surface-panel-muted);
  color: var(--tjg-text-secondary);
  font-size: var(--tjg-font-size-md);
  line-height: 1.5;
}

.decryption-failure-card__head {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
}

.decryption-failure-card__icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.decryption-failure-card__title {
  color: var(--tjg-text-primary);
  font-weight: 500;
}

.decryption-failure-card__desc,
.decryption-failure-card__error {
  margin: 0;
  color: var(--tjg-text-tertiary);
  font-size: var(--tjg-font-size-sm);
}

.decryption-failure-card__error {
  color: var(--tjg-color-danger-500);
}

.decryption-failure-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tjg-space-2);
}

.decryption-failure-card__button {
  padding: var(--tjg-space-1) var(--tjg-space-3);
  border: 1px solid var(--tjg-color-primary-500);
  border-radius: var(--tjg-radius-sm);
  background: var(--tjg-color-primary-500);
  color: var(--tjg-text-inverse);
  font-size: var(--tjg-font-size-sm);
  line-height: 1.4;
  cursor: pointer;

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }

  &:focus-visible {
    outline: 2px solid var(--tjg-color-primary-500);
    outline-offset: 2px;
  }
}

.decryption-failure-card__button--ghost {
  border-color: var(--tjg-border-default);
  background: var(--tjg-surface-panel);
  color: var(--tjg-text-secondary);
}

.decryption-failure-card__raw {
  max-height: 220px;
  margin: 0;
  padding: var(--tjg-space-2);
  border-radius: var(--tjg-radius-sm);
  overflow: auto;
  background: var(--tjg-surface-panel);
  color: var(--tjg-text-tertiary);
  font-size: var(--tjg-font-size-sm);
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
