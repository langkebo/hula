<template>
  <div
    class="workbench-empty-state"
    :class="{
      'workbench-empty-state--loading': state === 'loading',
      'workbench-empty-state--error': state === 'error',
      'workbench-empty-state--empty': state === 'empty'
    }">
    <div v-if="state === 'loading'" class="workbench-empty-state__icon">
      <n-spin :size="24" color="var(--hula-color-primary-500)" />
    </div>
    <div v-else-if="state === 'error'" class="workbench-empty-state__icon">
      <svg class="size-32px color-[--hula-color-danger-500]">
        <use href="#error" />
      </svg>
    </div>
    <div v-else class="workbench-empty-state__icon">
      <svg class="size-32px color-[--hula-text-quaternary]">
        <use href="#empty" />
      </svg>
    </div>

    <div class="workbench-empty-state__content">
      <span class="workbench-empty-state__title">
        {{
          state === 'loading'
            ? t('common.loading')
            : state === 'error'
              ? errorTitle || t('common.load_failed')
              : emptyTitle || t('common.no_data')
        }}
      </span>
      <span v-if="state === 'error' && errorMessage" class="workbench-empty-state__description">
        {{ errorMessage }}
      </span>
      <span v-else-if="state === 'empty' && emptyDescription" class="workbench-empty-state__description">
        {{ emptyDescription }}
      </span>
    </div>

    <div v-if="state === 'error' && showRetry" class="workbench-empty-state__actions">
      <n-button size="small" secondary @click="emit('retry')">
        {{ t('common.retry') }}
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  state: 'loading' | 'error' | 'empty'
  emptyTitle?: string
  emptyDescription?: string
  errorTitle?: string
  errorMessage?: string
  showRetry?: boolean
}>()

const emit = defineEmits<{
  retry: []
}>()

const { t } = useI18n()
</script>

<style scoped lang="scss">
.workbench-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  gap: 12px;
  text-align: center;
}

.workbench-empty-state__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
}

.workbench-empty-state__content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 240px;
}

.workbench-empty-state__title {
  font-size: 13px;
  font-weight: 500;
  color: var(--hula-text-secondary);
  line-height: 1.5;
}

.workbench-empty-state__description {
  font-size: 12px;
  color: var(--hula-text-tertiary);
  line-height: 1.5;
}

.workbench-empty-state__actions {
  margin-top: 4px;
}
</style>
