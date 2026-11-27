<template>
  <div class="storage-settings">
    <PartialStateBanner
      v-if="partialFailures > 0"
      class="mb-12px"
      :message="t('common.partial_load_failed', { count: partialFailures })"
      :retry-text="t('common.retry')"
      @retry="retryPartialLoads" />

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

      <div class="setting-row">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.storage.local_cache_title') }}</span>
          <span class="setting-desc">{{ t('setting.storage.local_cache_desc') }}</span>
        </div>
        <n-button
          size="small"
          :loading="clearingLocalCache"
          data-test="clear-local-cache"
          @click="handleClearLocalCache">
          {{ t('setting.storage.clear_local_cache') }}
        </n-button>
      </div>

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
            <span class="stat-value">{{ quotaStatsFailed ? '—' : quotaMediaCount }}</span>
          </div>
        </div>

        <div v-if="quotaExceeded" data-test="quota-exceeded" class="quota-warning">
          {{ t('setting.storage.quota_exceeded') }}
        </div>

        <div class="quota-alerts">
          <h4 class="quota-alerts-title">{{ t('setting.storage.quota_alerts') }}</h4>
          <ul v-if="quotaAlerts.length" data-test="quota-alerts" class="quota-alert-list">
            <li v-for="alert in quotaAlerts" :key="alert.alert_id" class="quota-alert-item">
              <div class="quota-alert-main">
                <span>{{ alert.message }}</span>
                <span v-if="!alert.is_read" data-test="quota-alert-unread" class="quota-alert-unread">
                  {{ t('setting.storage.quota_alert_unread') }}
                </span>
              </div>
              <div class="quota-alert-meta">
                <span data-test="quota-alert-type" class="quota-alert-type">
                  {{ alertTypeLabel(alert.alert_type) }}
                </span>
                <span class="quota-alert-threshold">
                  {{ t('setting.storage.quota_alert_threshold', { threshold: alert.threshold_percent }) }}
                </span>
                <span data-test="quota-alert-usage" class="quota-alert-usage">
                  {{
                    t('setting.storage.quota_alert_usage', {
                      used: formatBytes(alert.current_usage_bytes),
                      limit: formatBytes(alert.quota_limit_bytes)
                    })
                  }}
                </span>
                <span class="quota-alert-created">
                  {{ t('setting.storage.quota_alert_created', { time: formatAlertTime(alert.created_ts) }) }}
                </span>
              </div>
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
            {{
              mediaAuthFailed
                ? '-'
                : authenticatedMedia
                  ? t('setting.storage.auth_enabled')
                  : t('setting.storage.auth_disabled')
            }}
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
import { NButton, NDivider, NSelect, NSwitch, useDialog } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import PartialStateBanner from '@/components/common/PartialStateBanner.vue'
import { useStorageSettings } from './storage/useStorageSettings'

const { t } = useI18n()
const dialog = useDialog()

const {
  usage,
  quota,
  quotaState,
  quotaUsed,
  quotaLimit,
  quotaRemaining,
  quotaMediaCount,
  quotaAlerts,
  quotaExceeded,
  alertTypeLabel,
  formatAlertTime,
  mediaConfigState,
  maxUploadSize,
  authenticatedMedia,
  quotaStatsFailed,
  mediaAuthFailed,
  partialFailures,
  uploadCompressEnabled,
  uploadCompressQuality,
  uploadChunkEnabled,
  qualityOptions,
  updateCompressEnabled,
  updateCompressQuality,
  updateChunkEnabled,
  retryPartialLoads,
  clearingLocalCache,
  clearLocalCache,
  formatBytes
} = useStorageSettings()

function handleClearLocalCache(): void {
  dialog.warning({
    title: t('setting.storage.clear_local_cache_confirm_title'),
    content: t('setting.storage.clear_local_cache_confirm_message'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      const cleared = await clearLocalCache()
      if (cleared) {
        dialog.success({ title: t('setting.storage.clear_local_cache_success') })
      } else {
        dialog.error({ title: t('setting.storage.clear_local_cache_failed') })
      }
    }
  })
}
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

.quota-alert-main {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--tjg-text-primary);
}

.quota-alert-unread {
  padding: 0 6px;
  border-radius: var(--tjg-radius-sm, 6px);
  background: var(--tjg-color-primary-50);
  color: var(--tjg-color-primary-600);
  font-size: var(--tjg-font-size-xs, 12px);
}

.quota-alert-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-top: 2px;
  font-size: var(--tjg-font-size-xs, 12px);
  color: var(--tjg-text-tertiary);
}

.quota-alert-threshold {
  color: var(--tjg-text-tertiary);
}

@media (prefers-reduced-motion: reduce) {
  .quota-warning {
    transition: none;
  }
}
</style>
