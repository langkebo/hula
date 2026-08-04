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

    <n-spin :show="loading">
      <n-list v-if="filteredModules.length" bordered>
        <n-list-item
          v-for="module in filteredModules"
          :key="module.name"
          class="module-item"
          data-testid="module-item"
          @click="handleViewDetail(module.name)">
          <div class="module-info">
            <div class="module-row">
              <span class="module-name">{{ module.name }}</span>
              <span class="module-version">v{{ module.version }}</span>
              <n-tag :type="statusTagType(module.status)" size="small" round :data-status="module.status">
                <span class="status-dot" :style="{ backgroundColor: statusColor(module.status) }" />
                {{ statusLabel(module.status) }}
              </n-tag>
            </div>
            <p v-if="module.description" class="module-description">{{ module.description }}</p>
          </div>
        </n-list-item>
      </n-list>
      <n-empty v-else :description="t('admin.modules.empty')" data-testid="empty-state" />
    </n-spin>
  </section>
</template>

<script setup lang="ts">
import { NEmpty, NList, NListItem, NSelect, NSpin, NTag } from 'naive-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineOptions({
  name: 'AdminModules'
})

type ModuleStatus = 'loaded' | 'unloaded' | 'failed'

interface ModuleInfo {
  name: string
  version: string
  status: ModuleStatus
  description?: string
}

const props = defineProps<{
  modules: ModuleInfo[]
  loading: boolean
}>()

const emit = defineEmits<(e: 'view-detail', moduleName: string) => void>()

const { t } = useI18n()

const statusFilter = ref<'all' | ModuleStatus>('all')

const filterOptions = [
  { label: t('admin.modules.filter_all'), value: 'all' },
  { label: t('admin.modules.filter_loaded'), value: 'loaded' },
  { label: t('admin.modules.filter_unloaded'), value: 'unloaded' },
  { label: t('admin.modules.filter_failed'), value: 'failed' }
]

const filteredModules = computed(() => {
  if (statusFilter.value === 'all') return props.modules
  return props.modules.filter((module) => module.status === statusFilter.value)
})

function statusColor(status: ModuleStatus): string {
  switch (status) {
    case 'loaded':
      return 'var(--tjg-status-online)'
    case 'unloaded':
      return 'var(--tjg-status-busy)'
    case 'failed':
      return 'var(--tjg-status-offline)'
  }
}

function statusTagType(status: ModuleStatus): 'success' | 'warning' | 'error' {
  switch (status) {
    case 'loaded':
      return 'success'
    case 'unloaded':
      return 'warning'
    case 'failed':
      return 'error'
  }
}

function statusLabel(status: ModuleStatus): string {
  switch (status) {
    case 'loaded':
      return t('admin.modules.status_loaded')
    case 'unloaded':
      return t('admin.modules.status_unloaded')
    case 'failed':
      return t('admin.modules.status_failed')
  }
}

function handleViewDetail(moduleName: string) {
  emit('view-detail', moduleName)
}
</script>

<style scoped lang="scss">
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

.module-item {
  cursor: pointer;
  transition: background-color 0.2s ease;

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
}

@media (max-width: 768px) {
  .section-header {
    flex-direction: column;
    align-items: stretch;
  }

  .status-filter {
    width: 100%;
  }
}
</style>
