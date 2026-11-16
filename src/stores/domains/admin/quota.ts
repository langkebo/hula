import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { StoresEnum } from '@/enums'
import type { QuotaAlert, QuotaStats, QuotaStatus, ServerQuota } from '@/services/matrix/admin'
import { adminService } from '@/services/matrix/admin'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('QuotaStore')

export const useQuotaStore = defineStore(StoresEnum.QUOTA, () => {
  const quotaStatus = ref<QuotaStatus | null>(null)
  const quotaStats = ref<QuotaStats | null>(null)
  const alerts = ref<QuotaAlert[]>([])
  // 服务端总配额与管理端列表口径（GET /_synapse/admin/v1/media/quota）
  const serverQuota = ref<ServerQuota | null>(null)
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
      quotaStatus.value = await adminService.checkQuota()
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
      quotaStats.value = await adminService.getQuotaStats()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch quota stats'
    } finally {
      loading.value = false
    }
  }

  async function fetchAlerts() {
    try {
      alerts.value = await adminService.getQuotaAlerts()
    } catch (e) {
      logger.error('获取配额告警失败:', e)
    }
  }

  async function fetchServerQuota() {
    try {
      serverQuota.value = await adminService.getServerQuota()
    } catch (e) {
      // 非 admin 权限或后端未实现该端点时保持空态，不打断用户侧配额展示
      logger.error('获取服务端配额失败:', e)
      serverQuota.value = null
    }
  }

  /** 配额面板一次刷新：四项互不阻塞，单项失败不影响其余展示 */
  async function fetchAllQuota() {
    await Promise.allSettled([fetchQuotaStatus(), fetchQuotaStats(), fetchAlerts(), fetchServerQuota()])
  }

  function clearError() {
    error.value = null
  }

  function $reset() {
    quotaStatus.value = null
    quotaStats.value = null
    alerts.value = []
    serverQuota.value = null
    loading.value = false
    error.value = null
  }

  return {
    quotaStatus,
    quotaStats,
    alerts,
    serverQuota,
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
    fetchServerQuota,
    fetchAllQuota,
    clearError,
    $reset
  }
})
