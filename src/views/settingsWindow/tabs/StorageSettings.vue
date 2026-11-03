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

    <n-divider />

    <!-- 媒体服务配置 -->
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.storage.media_server_config') }}</h3>
      <p class="section-desc">{{ t('setting.storage.media_server_config_desc') }}</p>

      <div v-if="mediaConfigState === 'loading'" data-test="media-config-loading" class="quota-hint">
        {{ t('setting.storage.config_loading') }}
      </div>
      <div v-else-if="mediaConfigState === 'unavailable'" data-test="media-config-unavailable" class="quota-hint">
        {{ t('setting.storage.config_unavailable') }}
      </div>
      <div v-else class="stats-grid">
        <div data-test="media-upload-limit" class="stat-item">
          <span class="stat-label">{{ t('setting.storage.max_upload_size') }}</span>
          <span class="stat-value">
            {{ maxUploadSize > 0 ? formatBytes(maxUploadSize) : t('setting.storage.unlimited') }}
          </span>
        </div>
        <div data-test="media-auth-status" class="stat-item">
          <span class="stat-label">{{ t('setting.storage.authenticated_media') }}</span>
          <span class="stat-value">
            {{ authenticatedMedia ? t('setting.storage.auth_enabled') : t('setting.storage.auth_disabled') }}
          </span>
        </div>
      </div>
    </div>

    <n-divider />

    <!-- 上传策略 -->
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.storage.upload_settings') }}</h3>
      <p class="section-desc">{{ t('setting.storage.upload_settings_desc') }}</p>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.storage.compress_enabled') }}</span>
        </div>
        <n-switch
          :value="uploadCompressEnabled"
          data-test="upload-compress-switch"
          @update:value="updateCompressEnabled" />
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.storage.compress_quality') }}</span>
        </div>
        <n-select
          :value="uploadCompressQuality"
          data-test="upload-quality-select"
          class="quality-select"
          :options="qualityOptions"
          :disabled="!uploadCompressEnabled"
          @update:value="updateCompressQuality" />
      </div>

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.storage.chunk_enabled') }}</span>
          <span class="setting-desc">{{ t('setting.storage.chunk_hint') }}</span>
        </div>
        <n-switch :value="uploadChunkEnabled" data-test="upload-chunk-switch" @update:value="updateChunkEnabled" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NDivider, NSelect, NSwitch } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import { applyMediaUploadPreferences } from '@/services/matrix/media/mediaUploadPreferences'
import { useSettingStore } from '@/stores/domains/settings/setting'
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

type MediaConfigState = 'loading' | 'available' | 'unavailable'

const mediaConfigState = ref<MediaConfigState>('loading')
const maxUploadSize = ref(0)
const authenticatedMedia = ref(false)

const settingStore = useSettingStore()
const { uploadCompressEnabled, uploadCompressQuality, uploadChunkEnabled } = storeToRefs(settingStore)

const qualityOptions = computed(() => [
  { label: t('setting.storage.quality_small'), value: 0.6 },
  { label: t('setting.storage.quality_standard'), value: 0.8 },
  { label: t('setting.storage.quality_high'), value: 0.9 }
])

async function loadMediaConfig(): Promise<void> {
  mediaConfigState.value = 'loading'
  // 上传上限与认证媒体开关各自独立降级：认证配置读取失败不影响上传上限展示。
  const [configResult, authResult] = await Promise.allSettled([
    matrixMediaService.getMediaConfig(),
    matrixMediaService.getAuthenticatedMediaConfig()
  ])

  if (configResult.status === 'fulfilled' && configResult.value) {
    maxUploadSize.value = Number(configResult.value['m.upload.size'] ?? 0)
    mediaConfigState.value = 'available'
  } else {
    mediaConfigState.value = 'unavailable'
  }

  authenticatedMedia.value = authResult.status === 'fulfilled' && Boolean(authResult.value?.authenticated_media)
}

function updateCompressEnabled(value: boolean): void {
  settingStore.setUploadCompressEnabled(value)
  applyMediaUploadPreferences()
}

function updateCompressQuality(value: number): void {
  settingStore.setUploadCompressQuality(value === 0.6 || value === 0.9 ? value : 0.8)
  applyMediaUploadPreferences()
}

function updateChunkEnabled(value: boolean): void {
  settingStore.setUploadChunkEnabled(value)
  applyMediaUploadPreferences()
}

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
  void loadMediaConfig()
})
</script>

<style scoped lang="scss">
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--tjg-border-muted);
}

.setting-row:last-child {
  border-bottom: none;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.setting-label {
  font-size: var(--tjg-font-size-base, 14px);
  color: var(--tjg-text-primary);
}

.setting-desc {
  font-size: var(--tjg-font-size-xs, 12px);
  color: var(--tjg-text-secondary);
}

.quality-select {
  width: 160px;
}

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
