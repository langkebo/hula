<template>
  <n-space vertical size="large">
    <n-alert :bordered="false" type="info">{{ t('admin.accountPolicy.rateLimit.hint') }}</n-alert>

    <n-alert
      v-if="rateLimitError"
      data-testid="account-policy-rate-limit-error"
      type="error"
      closable
      @close="rateLimitError = null">
      {{ rateLimitError }}
    </n-alert>

    <n-space>
      <n-button data-testid="account-policy-rate-limit-refresh" :loading="rateLimitLoading" @click="loadRateLimit">
        {{ t('admin.accountPolicy.rateLimit.refresh') }}
      </n-button>
    </n-space>

    <n-card
      v-if="rateLimit"
      data-testid="account-policy-rate-limit-status"
      :title="t('admin.accountPolicy.rateLimit.statusTitle')">
      <n-descriptions :column="2" bordered size="small" label-placement="left">
        <n-descriptions-item :label="t('admin.accountPolicy.rateLimit.enabled')">
          {{ rateLimit.enabled ? t('admin.accountPolicy.policy.on') : t('admin.accountPolicy.policy.off') }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('admin.accountPolicy.rateLimit.backend')">
          {{ rateLimit.backend }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('admin.accountPolicy.rateLimit.redis')">
          {{
            rateLimit.redis_available
              ? t('admin.accountPolicy.rateLimit.available')
              : t('admin.accountPolicy.rateLimit.unavailable')
          }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('admin.accountPolicy.rateLimit.activeRules')">
          {{ rateLimit.active_rules }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('admin.accountPolicy.rateLimit.exemptPaths')">
          {{ rateLimit.exempt_paths }}
        </n-descriptions-item>
      </n-descriptions>
    </n-card>

    <n-card v-if="rateLimit" :title="t('admin.accountPolicy.rateLimit.metricsTitle')">
      <div class="metrics-grid">
        <div v-for="metric in rateLimitMetrics" :key="metric.key" class="metric-item">
          <span class="metric-label">{{ metric.label }}</span>
          <span class="metric-value">{{ metric.value }}</span>
        </div>
      </div>
    </n-card>
  </n-space>
</template>

<script setup lang="ts">
import { NAlert, NButton, NCard, NDescriptions, NDescriptionsItem, NSpace } from 'naive-ui'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminAccountPolicy } from '@/composables/admin'

defineOptions({ name: 'RateLimitPanel' })

const { t } = useI18n()
const { rateLimit, rateLimitLoading, rateLimitError, loadRateLimit } = useAdminAccountPolicy()

const rateLimitMetrics = computed(() => {
  const metrics = rateLimit.value?.metrics
  if (!metrics) return []
  return [
    { key: 'requests_total', label: t('admin.accountPolicy.rateLimit.requestsTotal'), value: metrics.requests_total },
    { key: 'rejected_total', label: t('admin.accountPolicy.rateLimit.rejectedTotal'), value: metrics.rejected_total },
    { key: 'allowed_total', label: t('admin.accountPolicy.rateLimit.allowedTotal'), value: metrics.allowed_total },
    { key: 'exempt_total', label: t('admin.accountPolicy.rateLimit.exemptTotal'), value: metrics.exempt_total },
    { key: 'fail_open_total', label: t('admin.accountPolicy.rateLimit.failOpenTotal'), value: metrics.fail_open_total },
    {
      key: 'fail_closed_total',
      label: t('admin.accountPolicy.rateLimit.failClosedTotal'),
      value: metrics.fail_closed_total
    },
    {
      key: 'rejected_ratio_percent',
      label: t('admin.accountPolicy.rateLimit.rejectedRatio'),
      value: `${metrics.rejected_ratio_percent}%`
    }
  ]
})

onMounted(() => {
  void loadRateLimit()
})
</script>

<style scoped lang="scss">
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.metric-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--n-color-modal);
}

.metric-label {
  font-size: 13px;
  color: var(--n-text-color-2);
}

.metric-value {
  font-size: 13px;
  color: var(--n-text-color);
}
</style>
