<template>
  <div class="encryption-status" :class="statusClass">
    <!-- encrypted: lock-check -->
    <svg v-if="status === 'encrypted'" class="status-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 0 1 6 0v3zm-3 5a2 2 0 0 1 1 3.74V19a1 1 0 0 1-2 0v-1.26A2 2 0 0 1 12 14z" />
    </svg>
    <!-- unencrypted: lock-open -->
    <svg
      v-else-if="status === 'unencrypted'"
      class="status-icon"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true">
      <path
        d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 0 1 6 0v3z"
        opacity="0.4" />
      <path d="M10 14a2 2 0 0 1 1-1.74V11a1 1 0 0 1 2 0v1.26A2 2 0 0 1 14 16a2 2 0 0 1-4-2z" opacity="0.4" />
    </svg>
    <!-- error: lock-alert -->
    <svg v-else-if="status === 'error'" class="status-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 0 1 6 0v3zm-4 4a1 1 0 0 1 2 0v3a1 1 0 0 1-2 0v-3zm1 6.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
    </svg>
    <!-- unknown: lock-question -->
    <svg v-else class="status-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 0 1 6 0v3zm-3 4.5a1.5 1.5 0 0 1 1 2.6V17a1 1 0 0 1-2 0v-.9a1.5 1.5 0 0 1 1-2.6z" />
    </svg>
    <span class="status-text">{{ statusText }}</span>
    <n-tooltip v-if="showTooltip" trigger="hover">
      <template #trigger>
        <svg class="status-hint" viewBox="0 0 24 24" fill="currentColor" aria-label="encryption info">
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
        </svg>
      </template>
      {{ tooltipText }}
    </n-tooltip>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

type EncryptionStatus = 'encrypted' | 'unencrypted' | 'unknown' | 'error'

const props = withDefaults(
  defineProps<{
    status: EncryptionStatus
    showTooltip?: boolean
  }>(),
  {
    showTooltip: true
  }
)

const { t } = useI18n()

const statusClass = computed(() => props.status)

const statusText = computed(() => {
  switch (props.status) {
    case 'encrypted':
      return t('components.encryptionStatus.encrypted')
    case 'unencrypted':
      return t('components.encryptionStatus.unencrypted')
    case 'error':
      return t('components.encryptionStatus.error')
    default:
      return t('components.encryptionStatus.unknown')
  }
})

const tooltipText = computed(() => {
  switch (props.status) {
    case 'encrypted':
      return t('components.encryptionStatus.encryptedTooltip')
    case 'unencrypted':
      return t('components.encryptionStatus.unencryptedTooltip')
    case 'error':
      return t('components.encryptionStatus.errorTooltip')
    default:
      return t('components.encryptionStatus.unknownTooltip')
  }
})
</script>

<style scoped lang="scss">
.encryption-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;

  &.encrypted {
    color: var(--tjg-color-success-600);
  }

  &.unencrypted {
    color: var(--tjg-text-tertiary);
  }

  &.error {
    color: var(--tjg-color-error-600);
  }

  &.unknown {
    color: var(--tjg-color-warning-600);
  }
}

.status-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.status-text {
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
}

.status-hint {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--tjg-text-tertiary);
  cursor: help;
}
</style>
