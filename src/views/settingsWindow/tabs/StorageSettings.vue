<template>
  <div class="storage-settings">
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.storage.title') }}</h3>
      <p class="section-desc">{{ t('setting.storage.desc') }}</p>
    </div>

    <n-divider />

    <!-- SDK store 缓存统计（对齐后端 CacheStats） -->
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.storage.sdk_store') }}</h3>
      <n-spin :show="loadingStats">
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">{{ t('setting.storage.hit_rate') }}</span>
            <span class="stat-value">{{ hitRateText }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">{{ t('setting.storage.hits') }}</span>
            <span class="stat-value">{{ stats?.hits ?? '-' }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">{{ t('setting.storage.misses') }}</span>
            <span class="stat-value">{{ stats?.misses ?? '-' }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">{{ t('setting.storage.evictions') }}</span>
            <span class="stat-value">{{ stats?.evictions ?? '-' }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">{{ t('setting.storage.total_entries') }}</span>
            <span class="stat-value">{{ stats?.totalEntries ?? '-' }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">{{ t('setting.storage.memory_usage') }}</span>
            <span class="stat-value">{{ formatBytes(stats?.memoryUsageBytes) }}</span>
          </div>
        </div>
      </n-spin>
    </div>

    <n-divider />

    <!-- 浏览器存储占用 -->
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.storage.browser_storage') }}</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">{{ t('setting.storage.browser_usage') }}</span>
          <span class="stat-value">{{ formatBytes(usage) }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">{{ t('setting.storage.browser_quota') }}</span>
          <span class="stat-value">{{ formatBytes(quota) }}</span>
        </div>
      </div>
    </div>

    <n-divider />

    <!-- 清理 -->
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.storage.cleanup') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.storage.clear_sdk') }}</span>
          <span class="setting-desc">{{ t('setting.storage.clear_sdk_desc') }}</span>
        </div>
        <n-button size="small" type="error" :loading="clearing" @click="handleClear">
          {{ t('setting.storage.clear') }}
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
import type { StoreStats } from '@/services/matrix/sdk'

const { t } = useI18n()

const stats = ref<StoreStats | null>(null)
const loadingStats = ref(false)
const clearing = ref(false)
const usage = ref(0)
const quota = ref(0)

const hitRateText = computed(() => {
  if (!stats.value) return '-'
  return `${(stats.value.hitRate * 100).toFixed(1)}%`
})

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function loadStats(): Promise<void> {
  loadingStats.value = true
  try {
    stats.value = await matrixWorkerHost.getStats()
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate()
      usage.value = estimate.usage ?? 0
      quota.value = estimate.quota ?? 0
    }
  } finally {
    loadingStats.value = false
  }
}

async function handleClear(): Promise<void> {
  clearing.value = true
  try {
    await matrixWorkerHost.clearStores()
  } finally {
    clearing.value = false
    await loadStats()
  }
}

onMounted(loadStats)
</script>

<style scoped lang="scss">
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--tjg-border-default);
  border-radius: var(--tjg-radius-sm, 6px);
  background: var(--tjg-surface-panel);
}

.stat-label {
  font-size: var(--tjg-font-size-xs, 12px);
  color: var(--tjg-text-secondary);
}

.stat-value {
  font-size: var(--tjg-font-size-base, 14px);
  font-weight: var(--tjg-font-weight-medium, 500);
  color: var(--tjg-text-primary);
}
</style>
