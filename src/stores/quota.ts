import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { StoresEnum } from '@/enums'
import { matrixQuotaService, type QuotaStatus, type QuotaStats, type QuotaAlert } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('QuotaStore')

export const useQuotaStore = defineStore(StoresEnum.QUOTA, () => {
  const quotaStatus = ref<QuotaStatus | null>(null)
  const quotaStats = ref<QuotaStats | null>(null)
  const alerts = ref<QuotaAlert[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const quotaUsed = computed(() => quotaStatus.value?.used ?? 0)
  const quotaLimit = computed(() => quotaStatus.value?.limit ?? 0)
  const quotaRemaining = computed(() => quotaStatus.value?.remaining ?? 0)
  const quotaPercentage = computed(() => quotaStatus.value?.percentage ?? 0)
  const isExceeded = computed(() => quotaStatus.value?.exceeded ?? false)
  const hasAlerts = computed(() => alerts.value.length > 0)

  async function fetchQuotaStatus() {
    loading.value = true
    error.value = null
    try {
      quotaStatus.value = await matrixQuotaService.checkQuota()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch quota status'
    } finally {
      loading.value = false
    }
  }

  async function fetchQuotaStats() {
    loading.value = true
    error.value = null
    try {
      quotaStats.value = await matrixQuotaService.getQuotaStats()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch quota stats'
    } finally {
      loading.value = false
    }
  }

  async function fetchAlerts() {
    try {
      alerts.value = await matrixQuotaService.getQuotaAlerts()
    } catch (e) {
      logger.error('获取配额告警失败:', e)
    }
  }

  function clearError() {
    error.value = null
  }

  function $reset() {
    quotaStatus.value = null
    quotaStats.value = null
    alerts.value = []
    loading.value = false
    error.value = null
  }

  return {
    quotaStatus,
    quotaStats,
    alerts,
    loading,
    error,
    quotaUsed,
    quotaLimit,
    quotaRemaining,
    quotaPercentage,
    isExceeded,
    hasAlerts,
    fetchQuotaStatus,
    fetchQuotaStats,
    fetchAlerts,
    clearError,
    $reset
  }
})
