<template>
  <div class="diagnostics-panel">
    <n-card :title="t('setting.diagnostics.title')" class="diagnostics-card">
      <n-grid :cols="4" :x-gap="16" :y-gap="16" responsive="screen">
        <n-gi>
          <n-statistic
            data-testid="metric-stat"
            :label="t('setting.diagnostics.api_avg_latency')"
            :value="`${apiAvgLatency} ms`" />
        </n-gi>
        <n-gi>
          <n-statistic
            data-testid="metric-stat"
            :label="t('setting.diagnostics.api_p95_latency')"
            :value="`${apiP95Latency} ms`" />
        </n-gi>
        <n-gi>
          <n-statistic
            data-testid="metric-stat"
            :label="t('setting.diagnostics.api_total_calls')"
            :value="apiTotalCalls" />
        </n-gi>
        <n-gi>
          <n-statistic
            data-testid="metric-stat"
            :label="t('setting.diagnostics.sync_count')"
            :value="snapshot.slidingSync.count" />
        </n-gi>
        <n-gi>
          <n-statistic
            data-testid="metric-stat"
            :label="t('setting.diagnostics.sync_avg_duration')"
            :value="`${Math.round(snapshot.slidingSync.avgDurationMs)} ms`" />
        </n-gi>
        <n-gi>
          <n-statistic
            data-testid="metric-stat"
            :label="t('setting.diagnostics.replay_success_rate')"
            :value="`${replaySuccessRatePercent}%`" />
        </n-gi>
        <n-gi>
          <n-statistic
            data-testid="metric-stat"
            :label="t('setting.diagnostics.retry_rate')"
            :value="`${retryRatePercent}%`" />
        </n-gi>
      </n-grid>

      <n-alert
        v-if="snapshot.isRetryRateAbnormal"
        data-testid="retry-warning"
        type="warning"
        class="diagnostics-alert"
        :title="t('setting.diagnostics.retry_rate_abnormal_title')">
        {{ t('setting.diagnostics.retry_rate_abnormal_desc', { rate: retryRatePercent.toFixed(1) }) }}
      </n-alert>

      <!-- O3: 扩展健康状态 -->
      <n-alert
        v-if="hasDegradedExtension"
        data-testid="extension-degraded-warning"
        type="warning"
        class="diagnostics-alert"
        title="扩展降级">
        <div v-for="id in degradedExtensionIds" :key="id" class="extension-health-item">
          <Icon icon="mdi:alert-circle-outline" :width="16" />
          <span>{{ id }}: 降级（功能回退到 REST API）</span>
        </div>
      </n-alert>
      <n-alert
        v-else-if="extensionHealthChecked"
        data-testid="extension-healthy-info"
        type="success"
        class="diagnostics-alert"
        title="扩展状态正常">
        所有关键扩展已注册
      </n-alert>

      <div class="diagnostics-actions">
        <n-button size="small" data-testid="reset-btn" @click="handleReset">
          {{ t('setting.diagnostics.reset') }}
        </n-button>
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NAlert, NButton, NCard, NGi, NGrid, NStatistic } from 'naive-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useApiMetrics } from '@/composables/useApiMetrics'
import { useCapabilityStore } from '@/stores/domains/chat/capability'

defineOptions({
  name: 'DiagnosticsPanel'
})

const { t } = useI18n()
const { getMetricsSnapshot, reset: resetMetrics } = useApiMetrics()
const capabilityStore = useCapabilityStore()

const snapshot = ref(getMetricsSnapshot())

// O3: 扩展健康状态
const hasDegradedExtension = computed(() => capabilityStore.hasDegradedExtension)
const extensionHealthChecked = computed(() => Object.keys(capabilityStore.extensionHealth).length > 0)
const degradedExtensionIds = computed(() =>
  Object.entries(capabilityStore.extensionHealth)
    .filter(([, status]) => status === 'degraded')
    .map(([id]) => id)
)

const apiAvgLatency = computed(() => {
  const values = Object.values(snapshot.value.apiCalls)
  if (values.length === 0) return 0
  const total = values.reduce((sum, m) => sum + m.avgLatencyMs, 0)
  return Math.round(total / values.length)
})

const apiP95Latency = computed(() => {
  const values = Object.values(snapshot.value.apiCalls)
  if (values.length === 0) return 0
  return Math.round(Math.max(...values.map((m) => m.p95LatencyMs)))
})

const apiTotalCalls = computed(() => {
  const values = Object.values(snapshot.value.apiCalls)
  return values.reduce((sum, m) => sum + m.count, 0)
})

const replaySuccessRatePercent = computed(() => Math.round(snapshot.value.offlineReplay.successRate * 100))

const retryRatePercent = computed(() => Math.round(snapshot.value.retryRate * 100))

function handleReset() {
  resetMetrics()
  snapshot.value = getMetricsSnapshot()
}
</script>

<style scoped>
.diagnostics-panel {
  margin-top: var(--tjg-space-4);
}

.diagnostics-card {
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-sm);
}

.diagnostics-alert {
  margin-top: var(--tjg-space-4);
}

.extension-health-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
}

.diagnostics-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--tjg-space-4);
}
</style>
