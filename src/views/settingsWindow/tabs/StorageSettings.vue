<template>
  <div class="storage-settings">
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.storage.title') }}</h3>
      <p class="section-desc">{{ t('setting.storage.desc') }}</p>
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
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatBytes } from '@/utils/Formatting'

const { t } = useI18n()

const usage = ref(0)
const quota = ref(0)

async function loadStats(): Promise<void> {
  // ⚠️ 这里曾展示「SDK store 缓存命中率 / 内存占用」并调用矩阵 worker 的 getStats()。
  // Batch 3.2 取证确认该消息在 worker 侧恒返回 null（worker 从不持有 client）⇒ 六个统计项
  // 永远显示 `-`。已移除该段假数据；浏览器存储用量是真实数据，保留。
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate()
    usage.value = estimate.usage ?? 0
    quota.value = estimate.quota ?? 0
  }
}

onMounted(loadStats)
</script>

<style scoped lang="scss">
.stats-grid {
  display: grid;
  /* 自适应列数：原先固定 3 列是为「SDK 缓存统计」的 6 项设计的；
     该段（Batch 3.2）移除后只剩浏览器用量的 2 项，固定 3 列会留空位。 */
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
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
