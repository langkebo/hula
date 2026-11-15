import { computed, type Ref, ref } from 'vue'
import {
  adminService,
  type ServerHealth,
  type ServerStats,
  type ServerStatus,
  type ServerVersion
} from '@/services/matrix/admin'

/** 单项面板的获取状态，供页面按卡片渲染失败态。 */
export interface AdminServerPanelErrors {
  status: boolean
  health: boolean
  version: boolean
  stats: boolean
}

interface UseAdminServerLogsResult {
  loading: Ref<boolean>
  status: Ref<ServerStatus | null>
  health: Ref<ServerHealth | null>
  version: Ref<ServerVersion | null>
  stats: Ref<ServerStats | null>
  errors: Ref<AdminServerPanelErrors>
  failedCount: Ref<number>

  loadPanel: () => Promise<void>
}

/**
 * Admin server panel composable.
 *
 * Reuses implemented server status endpoints and avoids the legacy log
 * endpoint that is not available on the backend.
 */
export function useAdminServerLogs(): UseAdminServerLogsResult {
  const loading = ref(false)
  const status = ref<ServerStatus | null>(null)
  const health = ref<ServerHealth | null>(null)
  const version = ref<ServerVersion | null>(null)
  const stats = ref<ServerStats | null>(null)
  const errors = ref<AdminServerPanelErrors>({ status: false, health: false, version: false, stats: false })

  const failedCount = computed(() => Object.values(errors.value).filter(Boolean).length)

  async function loadPanel() {
    loading.value = true
    try {
      const [statusResult, healthResult, versionResult, statsResult] = await Promise.allSettled([
        adminService.getServerStatus(),
        adminService.getServerHealth(),
        adminService.getServerVersion(),
        adminService.getServerStats()
      ])

      status.value = statusResult.status === 'fulfilled' ? statusResult.value : null
      health.value = healthResult.status === 'fulfilled' ? healthResult.value : null
      version.value = versionResult.status === 'fulfilled' ? versionResult.value : null
      stats.value = statsResult.status === 'fulfilled' ? statsResult.value : null
      errors.value = {
        status: statusResult.status === 'rejected',
        health: healthResult.status === 'rejected',
        version: versionResult.status === 'rejected',
        stats: statsResult.status === 'rejected'
      }
    } finally {
      loading.value = false
    }
  }

  return { loading, status, health, version, stats, errors, failedCount, loadPanel }
}
