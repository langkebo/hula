<template>
  <div class="encryption-status" :class="statusClass">
    <span class="status-dot" aria-hidden="true"></span>
    <span class="status-text">{{ statusText }}</span>
    <n-tooltip v-if="showTooltip" trigger="hover">
      <template #trigger>
        <span class="status-hint" aria-label="encryption info">i</span>
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

.status-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 999px;
  background-color: currentColor;
  box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 16%, transparent);
}

.status-text {
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
}

.status-hint {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  color: var(--tjg-text-tertiary);
  background-color: color-mix(in srgb, var(--tjg-text-primary) 8%, transparent);
  cursor: help;
}
</style>
