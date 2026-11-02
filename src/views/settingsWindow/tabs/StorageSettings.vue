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
    <n-divider />

    <!-- 服务端媒体配额 -->
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.storage.media_quota') }}</h3>
      <p class="section-desc">{{ t('setting.storage.media_quota_desc') }}</p>

      <div v-if="quotaState === 'loading'" data-test="quota-loading" class="quota-hint">
        {{ t('setting.storage.quota_loading') }}
      </div>
      <div v-else-if="quotaState === 'unavailable'" data-test="quota-unavailable" class="quota-hint">
        {{ t('setting.storage.quota_unavailable') }}
      </div>
      <template v-else>
        <div data-test="quota-stats" class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">{{ t('setting.storage.quota_used') }}</span>
            <span class="stat-value">{{ formatBytes(quotaUsed) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">{{ t('setting.storage.quota_limit') }}</span>
            <span class="stat-value">{{ formatBytes(quotaLimit) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">{{ t('setting.storage.quota_remaining') }}</span>
            <span class="stat-value">{{ formatBytes(quotaRemaining) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">{{ t('setting.storage.quota_media_count') }}</span>
            <span class="stat-value">{{ quotaMediaCount }}</span>
          </div>
        </div>

        <div v-if="quotaExceeded" data-test="quota-exceeded" class="quota-warning">
          {{ t('setting.storage.quota_exceeded') }}
        </div>

        <div class="quota-alerts">
          <h4 class="quota-alerts-title">{{ t('setting.storage.quota_alerts') }}</h4>
          <ul v-if="quotaAlerts.length" data-test="quota-alerts" class="quota-alert-list">
            <li v-for="alert in quotaAlerts" :key="alert.alert_id" class="quota-alert-item">
              <span>{{ alert.message }}</span>
              <span class="quota-alert-threshold">
                {{ t('setting.storage.quota_alert_threshold', { threshold: alert.threshold_percent }) }}
              </span>
            </li>
          </ul>
          <p v-else data-test="quota-no-alerts" class="quota-hint">
            {{ t('setting.storage.quota_no_alerts') }}
          </p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import { formatBytes } from '@/utils/Formatting'

const { t } = useI18n()

const usage = ref(0)
const quota = ref(0)

type QuotaState = 'loading' | 'available' | 'unavailable'

const quotaState = ref<QuotaState>('loading')
const quotaUsed = ref(0)
const quotaLimit = ref(0)
const quotaRemaining = ref(0)
const quotaMediaCount = ref(0)
const quotaAlerts = ref<Awaited<ReturnType<typeof matrixMediaService.getQuotaAlerts>>>([])

const quotaExceeded = computed(() => quotaLimit.value > 0 && quotaRemaining.value <= 0)

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

async function loadQuota(): Promise<void> {
  quotaState.value = 'loading'
  // 三个接口各自独立降级：任一失败不阻断其余数据展示。
  const [usageResult, statsResult, alertsResult] = await Promise.allSettled([
    matrixMediaService.checkQuota(),
    matrixMediaService.getQuotaStats(),
    matrixMediaService.getQuotaAlerts()
  ])

  if (usageResult.status === 'rejected' || !usageResult.value) {
    quotaState.value = 'unavailable'
    return
  }

  quotaUsed.value = usageResult.value.used
  quotaLimit.value = usageResult.value.limit
  quotaRemaining.value = usageResult.value.remaining

  if (statsResult.status === 'fulfilled' && statsResult.value) {
    quotaMediaCount.value = statsResult.value.mediaCount
  } else {
    quotaMediaCount.value = 0
  }

  quotaAlerts.value = alertsResult.status === 'fulfilled' ? alertsResult.value : []
  quotaState.value = 'available'
}

onMounted(() => {
  void loadStats()
  void loadQuota()
})
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

.quota-hint {
  margin: 0;
  font-size: var(--tjg-font-size-sm, 13px);
  color: var(--tjg-text-secondary);
}

.quota-warning {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: var(--tjg-radius-sm, 6px);
  background: var(--tjg-color-warning-bg);
  color: var(--tjg-color-warning-600);
  font-size: var(--tjg-font-size-sm, 13px);
}

.quota-alerts {
  margin-top: 16px;
}

.quota-alerts-title {
  margin: 0 0 8px;
  font-size: var(--tjg-font-size-sm, 13px);
  font-weight: var(--tjg-font-weight-medium, 500);
  color: var(--tjg-text-primary);
}

.quota-alert-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: var(--tjg-font-size-sm, 13px);
  color: var(--tjg-text-secondary);
}

.quota-alert-threshold {
  margin-left: 8px;
  color: var(--tjg-text-tertiary);
}

@media (prefers-reduced-motion: reduce) {
  .quota-warning {
    transition: none;
  }
}
</style>
