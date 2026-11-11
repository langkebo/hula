<template>
  <div
    v-if="warnings.length"
    data-testid="room-encryption-banner"
    class="flex flex-col gap-2px px-12px py-8px text-12px bg-[--tjg-color-warning-bg] text-[--tjg-color-warning-700]">
    <span v-for="warning in warnings" :key="warning" class="flex items-center gap-6px">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        aria-hidden="true">
        <path d="M12 3 2.5 20h19L12 3Z" />
        <path d="M12 9v5M12 17h.01" />
      </svg>
      <span>{{ $t(WARNING_MESSAGE_KEYS[warning]) }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import type { EncryptionWarningKey } from '@/composables/encryption/useRoomEncryptionStatus'
import type { I18nKeyPaths } from '@/typings/i18n'

defineProps<{ warnings: EncryptionWarningKey[] }>()

/** 静态 key 映射：让 i18n 引用守卫能看到字面量 key，避免运行时拼接。 */
const WARNING_MESSAGE_KEYS = {
  crypto_init_failed: 'chat.encryption_banner.crypto_init_failed',
  backup_disabled: 'chat.encryption_banner.backup_disabled',
  keys_local_only: 'chat.encryption_banner.keys_local_only'
} as const satisfies Record<EncryptionWarningKey, I18nKeyPaths>
</script>
