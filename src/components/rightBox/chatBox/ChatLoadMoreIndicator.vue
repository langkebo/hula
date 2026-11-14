<template>
  <div v-if="loading && !error" class="load-more-indicator" role="status" aria-live="polite">
    <span class="load-more-spinner" aria-hidden="true"></span>
    <span>{{ t('home.chat_main.loading_more') }}</span>
  </div>
  <div v-else-if="error" class="load-more-indicator load-more-indicator--error" role="alert">
    <span>{{ t('home.chat_main.load_more_failed') }}</span>
    <n-button text type="primary" size="tiny" @click="emit('retry')">{{ t('common.retry') }}</n-button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  loading: boolean
  error: boolean
}>()

const emit = defineEmits<{
  retry: []
}>()

const { t } = useI18n()
</script>

<style scoped lang="scss">
.load-more-indicator {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-tertiary);
}

.load-more-indicator--error {
  color: var(--tjg-color-warning-500);
}

.load-more-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid color-mix(in srgb, var(--tjg-text-tertiary) 35%, transparent);
  border-top-color: var(--tjg-color-primary-500);
  border-radius: 50%;
  animation: load-more-spin 0.8s linear infinite;
}

@keyframes load-more-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .load-more-spinner {
    animation: none;
  }
}
</style>
