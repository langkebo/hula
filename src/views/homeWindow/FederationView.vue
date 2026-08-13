<template>
  <div class="federation-page h-full flex flex-col" role="main" :aria-label="t('home.plugins.federation')">
    <!-- 视图头部：标题 + 刷新 -->
    <header class="federation-page__header">
      <h2 class="federation-page__title">{{ t('home.plugins.federation') }}</h2>
      <button
        type="button"
        class="federation-page__refresh"
        :disabled="destinationsLoading"
        :aria-label="t('home.plugins.federation')"
        @click="loadDestinations">
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      </button>
    </header>

    <!-- 加载态 -->
    <div v-if="destinationsLoading" class="federation-page__loading" role="status">
      <span class="federation-page__spinner" aria-hidden="true"></span>
      {{ t('home.plugins.federation_loading') }}
    </div>

    <!-- 空态 -->
    <div v-else-if="destinations.length === 0" class="federation-page__empty">
      {{ t('home.plugins.federation_empty') }}
    </div>

    <!-- 服务器列表 -->
    <ul v-else class="federation-page__list">
      <li
        v-for="dest in destinations"
        :key="dest.destination"
        class="federation-page__item"
        :data-testid="`federation-dest-${dest.destination}`">
        <span class="federation-page__dot" :class="dest.failureTs ? 'is-down' : 'is-up'" aria-hidden="true"></span>
        <span class="federation-page__name">{{ dest.destination }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminFederation } from '@/composables/admin/useAdminFederation'

const { t } = useI18n()
const { destinations, destinationsLoading, loadDestinations } = useAdminFederation()

onMounted(() => {
  loadDestinations()
})
</script>

<style scoped lang="scss">
.federation-page {
  padding: 16px 20px;
  gap: 12px;
}

.federation-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.federation-page__title {
  margin: 0;
  font-size: var(--tjg-font-size-lg, 16px);
  font-weight: var(--tjg-font-weight-medium, 500);
  color: var(--tjg-text-primary);
}

.federation-page__refresh {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--tjg-radius-sm, 6px);
  background: transparent;
  color: var(--tjg-text-secondary);
  cursor: pointer;
  transition: background-color var(--tjg-motion-duration-fast, 150ms) var(--tjg-motion-ease-standard, ease);

  &:hover:not(:disabled) {
    background: var(--tjg-surface-list-hover);
    color: var(--tjg-text-primary);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.federation-page__loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--tjg-text-secondary);
  font-size: var(--tjg-font-size-sm, 13px);
}

.federation-page__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--tjg-border-default);
  border-top-color: var(--tjg-color-primary-400);
  border-radius: 50%;
  animation: federation-spin 0.8s linear infinite;
}

@keyframes federation-spin {
  to {
    transform: rotate(360deg);
  }
}

.federation-page__empty {
  color: var(--tjg-text-muted);
  font-size: var(--tjg-font-size-sm, 13px);
  text-align: center;
  padding: 32px 0;
}

.federation-page__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.federation-page__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--tjg-radius-sm, 6px);
  transition: background-color var(--tjg-motion-duration-fast, 150ms) var(--tjg-motion-ease-standard, ease);

  &:hover {
    background: var(--tjg-surface-list-hover);
  }
}

.federation-page__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;

  &.is-up {
    background: var(--tjg-color-success, #10b981);
  }

  &.is-down {
    background: var(--tjg-color-danger-500, #ff4d4f);
  }
}

.federation-page__name {
  color: var(--tjg-text-primary);
  font-size: var(--tjg-font-size-base, 14px);
  word-break: break-all;
}
</style>
