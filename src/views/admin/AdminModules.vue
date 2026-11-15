<template>
  <section class="admin-modules" role="region" :aria-label="t('admin.modules.aria_label')">
    <header class="section-header">
      <h4 class="section-title">
        <svg class="section-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path fill="currentColor" d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" />
        </svg>
        {{ t('admin.modules.title') }}
      </h4>
      <n-select
        v-model:value="statusFilter"
        :options="filterOptions"
        data-testid="status-filter"
        class="status-filter"
        size="small" />
    </header>

    <n-alert v-if="error" type="error" data-testid="modules-error">
      <div class="error-row">
        <span>{{ t('admin.load_failed') }}</span>
        <n-button size="small" data-testid="modules-retry" @click="loadModules()">
          {{ t('common.refresh') }}
        </n-button>
      </div>
    </n-alert>

    <n-spin :show="loading">
      <n-list v-if="filteredModules.length" bordered>
        <n-list-item v-for="module in filteredModules" :key="module.id" class="module-item" data-testid="module-item">
          <div class="module-info">
            <div class="module-row">
              <span class="module-name">{{ module.name }}</span>
              <span class="module-version">v{{ module.version }}</span>
              <n-tag :type="statusTagType(module.status)" size="small" round :data-status="module.status">
                <span class="status-dot" :class="`status-dot--${module.status}`" />
                {{ statusLabel(module.status) }}
              </n-tag>
            </div>
            <p v-if="module.description" class="module-description">{{ module.description }}</p>
          </div>
        </n-list-item>
      </n-list>
      <n-empty v-else-if="!error" :description="t('admin.modules.empty')" data-testid="empty-state" />
    </n-spin>
  </section>
</template>

<script setup lang="ts">
import { NAlert, NButton, NEmpty, NList, NListItem, NSelect, NSpin, NTag } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { type AdminModuleStatus, useAdminModules } from '@/composables/admin'

defineOptions({
  name: 'AdminModules'
})

const { t } = useI18n()

const { modules, loading, error, loadModules } = useAdminModules()

const statusFilter = ref<'all' | AdminModuleStatus>('all')

const filterOptions = computed(() => [
  { label: t('admin.modules.filter_all'), value: 'all' },
  { label: t('admin.modules.filter_loaded'), value: 'loaded' },
  { label: t('admin.modules.filter_unloaded'), value: 'unloaded' },
  { label: t('admin.modules.filter_failed'), value: 'failed' }
])

const filteredModules = computed(() => {
  if (statusFilter.value === 'all') return modules.value
  return modules.value.filter((module) => module.status === statusFilter.value)
})

function statusTagType(status: AdminModuleStatus): 'success' | 'warning' | 'error' {
  switch (status) {
    case 'loaded':
      return 'success'
    case 'unloaded':
      return 'warning'
    case 'failed':
      return 'error'
  }
}

function statusLabel(status: AdminModuleStatus): string {
  switch (status) {
    case 'loaded':
      return t('admin.modules.status_loaded')
    case 'unloaded':
      return t('admin.modules.status_unloaded')
    case 'failed':
      return t('admin.modules.status_failed')
  }
}

onMounted(() => {
  void loadModules()
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/responsive.scss' as responsive;

.admin-modules {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-4);
  max-width: 1200px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tjg-space-3);
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  margin: 0;
  font-size: var(--tjg-font-size-lg, 15px);
  font-weight: var(--tjg-font-weight-medium, 600);
  color: var(--tjg-text-primary);
}

.section-icon {
  flex-shrink: 0;
  color: var(--tjg-color-primary-500);
}

.status-filter {
  width: 180px;
  flex-shrink: 0;
}

.error-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tjg-space-3);
}

.module-item {
  transition: background-color var(--tjg-motion-duration-normal) ease;

  &:hover {
    background-color: var(--tjg-bg-secondary);
  }
}

.module-info {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-1, 4px);
  width: 100%;
}

.module-row {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  flex-wrap: wrap;
}

.module-name {
  font-size: var(--tjg-font-size-base, 14px);
  font-weight: var(--tjg-font-weight-medium, 500);
  color: var(--tjg-text-primary);
}

.module-version {
  font-size: var(--tjg-font-size-sm, 12px);
  color: var(--tjg-text-secondary);
  font-family: var(--tjg-font-family-mono, monospace);
}

.module-description {
  margin: 0;
  font-size: var(--tjg-font-size-sm, 12px);
  color: var(--tjg-text-tertiary);
  line-height: 1.5;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;

  &--loaded {
    background-color: var(--tjg-status-online);
  }

  &--unloaded {
    background-color: var(--tjg-status-busy);
  }

  &--failed {
    background-color: var(--tjg-status-offline);
  }
}

@include responsive.down('md') {
  .section-header {
    flex-direction: column;
    align-items: stretch;
  }

  .status-filter {
    width: 100%;
  }
}
</style>
