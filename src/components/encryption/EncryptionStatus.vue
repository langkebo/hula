<template>
  <div class="encryption-status" :class="statusClass">
    <svg class="size-16px">
      <use :href="statusIcon"></use>
    </svg>
    <span class="status-text">{{ statusText }}</span>
    <n-tooltip v-if="showTooltip" trigger="hover">
      <template #trigger>
        <svg class="size-14px color-[--hula-text-tertiary] cursor-help">
          <use href="#info"></use>
        </svg>
      </template>
      {{ tooltipText }}
    </n-tooltip>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'

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

const statusIcon = computed(() => {
  switch (props.status) {
    case 'encrypted':
      return '#lock'
    case 'unencrypted':
      return '#unlock'
    case 'error':
      return '#alert-triangle'
    default:
      return '#help-circle'
  }
})

const statusText = computed(() => {
  switch (props.status) {
    case 'encrypted':
      return t('encryption.encrypted')
    case 'unencrypted':
      return t('encryption.unencrypted')
    case 'error':
      return t('encryption.error')
    default:
      return t('encryption.unknown')
  }
})

const tooltipText = computed(() => {
  switch (props.status) {
    case 'encrypted':
      return t('encryption.encrypted_tooltip')
    case 'unencrypted':
      return t('encryption.unencrypted_tooltip')
    case 'error':
      return t('encryption.error_tooltip')
    default:
      return t('encryption.unknown_tooltip')
  }
})
</script>

<style scoped lang="scss">
.encryption-status {
  @apply flex items-center gap-6px;

  &.encrypted {
    color: var(--color-success);
  }

  &.unencrypted {
    color: var(--hula-text-tertiary);
  }

  &.error {
    color: var(--color-danger);
  }

  &.unknown {
    color: var(--color-warning);
  }
}

.status-text {
  @apply text-12px;
}
</style>
