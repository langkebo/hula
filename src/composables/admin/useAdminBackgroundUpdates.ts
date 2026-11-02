import { type Ref, ref } from 'vue'
import { adminService } from '@/services/matrix/admin'
import type { BackgroundUpdate, BackgroundUpdateStatusSummary } from '@/services/matrix/admin/BackgroundUpdateService'

/** 自动刷新间隔：进度页轮询需可停，默认关闭，由用户显式开启。 */
export const AUTO_REFRESH_INTERVAL_MS = 15_000

interface UseAdminBackgroundUpdatesResult {
  updates: Ref<BackgroundUpdate[]>
  summary: Ref<BackgroundUpdateStatusSummary | null>
  loading: Ref<boolean>
  actionLoading: Ref<boolean>
  autoRefresh: Ref<boolean>

  loadAll: () => Promise<void>
  startUpdate: (jobName: string) => Promise<void>
  cancelUpdate: (jobName: string) => Promise<void>
  retryFailed: () => Promise<number>
  cleanupLocks: () => Promise<number>
  setAutoRefresh: (enabled: boolean) => void
  stopAutoRefresh: () => void
}

function unwrap<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback
}

/**
 * Admin background-updates composable.
 *
 * 后端把 `/background_updates/*` 恒定注册（不受 profile 门控），因此这里不做
 * 能力探测，只用空列表 + 计数为 0 呈现空态；破坏性操作由视图做二次确认。
 */
export function useAdminBackgroundUpdates(): UseAdminBackgroundUpdatesResult {
  const updates = ref<BackgroundUpdate[]>([])
  const summary = ref<BackgroundUpdateStatusSummary | null>(null)
  const loading = ref(false)
  const actionLoading = ref(false)
  const autoRefresh = ref(false)
  let refreshTimer: ReturnType<typeof setInterval> | null = null

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
    autoRefresh.value = false
  }

  function setAutoRefresh(enabled: boolean) {
    if (!enabled) {
      stopAutoRefresh()
      return
    }
    autoRefresh.value = true
    if (refreshTimer) return
    refreshTimer = setInterval(() => {
      // 操作进行中跳过本轮，避免与操作后的显式刷新竞态
      if (actionLoading.value) return
      void loadAll()
    }, AUTO_REFRESH_INTERVAL_MS)
  }

  async function loadAll() {
    loading.value = true
    try {
      const [listRes, summaryRes] = await Promise.allSettled([
        adminService.backgroundUpdates.listUpdates(),
        adminService.backgroundUpdates.getStatus()
      ])
      updates.value = unwrap(listRes, { updates: [] }).updates
      summary.value = unwrap(summaryRes, null)
    } finally {
      loading.value = false
    }
  }

  async function startUpdate(jobName: string) {
    actionLoading.value = true
    try {
      await adminService.backgroundUpdates.startUpdate(jobName)
      await loadAll()
    } finally {
      actionLoading.value = false
    }
  }

  async function cancelUpdate(jobName: string) {
    actionLoading.value = true
    try {
      await adminService.backgroundUpdates.cancelUpdate(jobName)
      await loadAll()
    } finally {
      actionLoading.value = false
    }
  }

  async function retryFailed(): Promise<number> {
    actionLoading.value = true
    try {
      const result = await adminService.backgroundUpdates.retryFailed()
      await loadAll()
      return result.retried_count
    } finally {
      actionLoading.value = false
    }
  }

  async function cleanupLocks(): Promise<number> {
    actionLoading.value = true
    try {
      const result = await adminService.backgroundUpdates.cleanupLocks()
      await loadAll()
      return result.cleaned_count
    } finally {
      actionLoading.value = false
    }
  }

  return {
    updates,
    summary,
    loading,
    actionLoading,
    autoRefresh,
    loadAll,
    startUpdate,
    cancelUpdate,
    retryFailed,
    cleanupLocks,
    setAutoRefresh,
    stopAutoRefresh
  }
}
