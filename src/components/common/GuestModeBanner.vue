<template>
  <div data-test="guest-mode-banner" role="status" aria-live="polite" class="guest-mode-banner">
    <svg
      class="guest-mode-banner__icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
    <span class="guest-mode-banner__text">{{ t('guest.banner.text') }}</span>
    <button type="button" data-test="guest-upgrade-entry" class="guest-mode-banner__action" @click="emit('upgrade')">
      {{ t('guest.banner.upgrade') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const emit = defineEmits<{
  upgrade: []
}>()
</script>

<style scoped>
.guest-mode-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  min-height: 32px;
  padding: 4px 12px;
  background: var(--tjg-color-warning-bg);
  border-bottom: 1px solid var(--tjg-border-muted);
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-primary);
}

.guest-mode-banner__icon {
  flex-shrink: 0;
  color: var(--tjg-color-warning-500);
}

.guest-mode-banner__text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.guest-mode-banner__action {
  flex-shrink: 0;
  padding: 2px 10px;
  border: 1px solid var(--tjg-color-primary-500);
  border-radius: 4px;
  background: transparent;
  color: var(--tjg-color-primary-500);
  font-size: var(--tjg-font-size-2xs);
  cursor: pointer;
  transition: background var(--tjg-motion-duration-normal) ease;
}

.guest-mode-banner__action:hover {
  background: var(--tjg-color-primary-50);
}

.guest-mode-banner__action:focus-visible {
  outline: 2px solid var(--tjg-color-primary-500);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .guest-mode-banner__action {
    transition: none;
  }
}
</style>
