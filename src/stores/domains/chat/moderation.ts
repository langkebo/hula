import { error, info } from '@tauri-apps/plugin-log'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, triggerRef } from 'vue'
import { StoresEnum } from '@/enums'
import { matrixModerationService } from '@/services/matrix'
import type {
  ContentFilter,
  Report,
  ReportFilters,
  UserReputation
} from '@/services/matrix/admin/MatrixModerationService'

export const useModerationStore = defineStore(StoresEnum.MODERATION, () => {
  const reports = ref<Report[]>([])
  const userReputations = shallowRef<Map<string, UserReputation>>(new Map())
  const contentFilters = ref<ContentFilter[]>([])
  const loading = ref(false)
  const errorState = ref<string | null>(null)
  const currentFilters = ref<ReportFilters>({})

  const openReports = computed(() => reports.value.filter((r) => r.status === 'open'))
  const resolvedReports = computed(() => reports.value.filter((r) => r.status === 'resolved'))
  const dismissedReports = computed(() => reports.value.filter((r) => r.status === 'dismissed'))
  const openReportCount = computed(() => openReports.value.length)
  const enabledFilters = computed(() => contentFilters.value.filter((f) => f.enabled))

  async function fetchReports(filters?: ReportFilters): Promise<void> {
    loading.value = true
    errorState.value = null
    try {
      currentFilters.value = filters ?? {}
      reports.value = await matrixModerationService.getReports(filters)
      info(`[ModerationStore] 获取举报列表成功: ${reports.value.length} 条`)
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : '获取举报列表失败'
      errorState.value = errorMessage
      error(`[ModerationStore] 获取举报列表失败: ${errorMessage}`)
    } finally {
      loading.value = false
    }
  }

  async function resolveReport(
    reportId: string,
    action: 'dismiss' | 'warn' | 'mute' | 'ban',
    notes?: string
  ): Promise<boolean> {
    loading.value = true
    errorState.value = null
    try {
      await matrixModerationService.resolveReport(reportId, { action, notes })
      const index = reports.value.findIndex((r) => r.id === reportId)
      if (index !== -1) {
        reports.value[index].status = 'resolved'
      }
      info(`[ModerationStore] 处理举报成功: ${reportId} -> ${action}`)
      return true
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : '处理举报失败'
      errorState.value = errorMessage
      error(`[ModerationStore] 处理举报失败: ${errorMessage}`)
      return false
    } finally {
      loading.value = false
    }
  }

  async function fetchUserReputation(userId: string): Promise<UserReputation | null> {
    try {
      const reputation = await matrixModerationService.getUserReputation(userId)
      userReputations.value.set(userId, reputation)
      triggerRef(userReputations)
      info(`[ModerationStore] 获取用户信誉成功: ${userId} -> ${reputation.level}`)
      return reputation
    } catch (e) {
      error(`[ModerationStore] 获取用户信誉失败: ${e}`)
      return null
    }
  }

  async function setUserReputation(userId: string, score: number): Promise<boolean> {
    try {
      await matrixModerationService.setUserReputation(userId, score)
      const reputation = userReputations.value.get(userId)
      if (reputation) {
        reputation.score = score
        triggerRef(userReputations)
      }
      info(`[ModerationStore] 设置用户信誉成功: ${userId} -> ${score}`)
      return true
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : '设置用户信誉失败'
      errorState.value = errorMessage
      error(`[ModerationStore] 设置用户信誉失败: ${errorMessage}`)
      return false
    }
  }

  async function fetchContentFilters(): Promise<void> {
    try {
      contentFilters.value = await matrixModerationService.getContentFilters()
      info(`[ModerationStore] 获取内容过滤器成功: ${contentFilters.value.length} 条`)
    } catch (e) {
      error(`[ModerationStore] 获取内容过滤器失败: ${e}`)
    }
  }

  async function addContentFilter(filter: {
    type: 'keyword' | 'regex' | 'image_hash'
    pattern: string
    action: 'flag' | 'block' | 'quarantine'
  }): Promise<ContentFilter | null> {
    loading.value = true
    errorState.value = null
    try {
      const newFilter = await matrixModerationService.addContentFilter(filter)
      contentFilters.value.push(newFilter)
      info(`[ModerationStore] 添加内容过滤器成功: ${newFilter.id}`)
      return newFilter
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : '添加内容过滤器失败'
      errorState.value = errorMessage
      error(`[ModerationStore] 添加内容过滤器失败: ${errorMessage}`)
      return null
    } finally {
      loading.value = false
    }
  }

  async function removeContentFilter(filterId: string): Promise<boolean> {
    try {
      await matrixModerationService.removeContentFilter(filterId)
      contentFilters.value = contentFilters.value.filter((f) => f.id !== filterId)
      info(`[ModerationStore] 移除内容过滤器成功: ${filterId}`)
      return true
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : '移除内容过滤器失败'
      errorState.value = errorMessage
      error(`[ModerationStore] 移除内容过滤器失败: ${errorMessage}`)
      return false
    }
  }

  function clearError(): void {
    errorState.value = null
  }

  function $reset(): void {
    reports.value = []
    userReputations.value.clear()
    triggerRef(userReputations)
    contentFilters.value = []
    loading.value = false
    errorState.value = null
    currentFilters.value = {}
    info('[ModerationStore] Store 已重置')
  }

  return {
    reports,
    userReputations,
    contentFilters,
    loading,
    error: errorState,
    currentFilters,
    openReports,
    resolvedReports,
    dismissedReports,
    openReportCount,
    enabledFilters,
    fetchReports,
    resolveReport,
    fetchUserReputation,
    setUserReputation,
    fetchContentFilters,
    addContentFilter,
    removeContentFilter,
    clearError,
    $reset
  }
})
