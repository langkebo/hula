<template>
  <span class="inline-flex items-center gap-4px text-12px text-[--tjg-status-encryption-verified]">
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true">
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
    <span>{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
defineProps<{ label: string }>()
</script>
