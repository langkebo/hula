<template>
  <div
    v-if="warnings.length"
    data-test="room-encryption-banner"
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
      <span>{{ $t(`chat.encryption_banner.${warning}`) }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import type { EncryptionWarningKey } from '@/composables/encryption/useRoomEncryptionStatus'

defineProps<{ warnings: EncryptionWarningKey[] }>()
</script>
