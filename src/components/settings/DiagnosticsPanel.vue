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

      <div class="diagnostics-actions">
        <n-button size="small" data-testid="reset-btn" @click="handleReset">
          {{ t('setting.diagnostics.reset') }}
        </n-button>
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { NAlert, NButton, NCard, NGi, NGrid, NStatistic } from 'naive-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useApiMetrics } from '@/composables/useApiMetrics'

defineOptions({
  name: 'DiagnosticsPanel'
})

const { t } = useI18n()
const { getMetricsSnapshot, reset: resetMetrics } = useApiMetrics()

const snapshot = ref(getMetricsSnapshot())

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

.diagnostics-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--tjg-space-4);
}
</style>
