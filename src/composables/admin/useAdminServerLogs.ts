import { ref, type Ref } from 'vue'
import { adminService } from '@/services/matrix'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface UseAdminServerLogsResult {
  logs: Ref<Array<Record<string, unknown>>>
  loading: Ref<boolean>
  level: Ref<LogLevel | undefined>
  limit: Ref<number>

  loadLogs: () => Promise<void>
}

/**
 * Admin server-logs composable.
 *
 * Wraps `adminService.getServerLogs`. Backend feature is UX-gated —
 * `AdminServerLogs.vue` currently shows the "not ready" banner.
 */
export function useAdminServerLogs(): UseAdminServerLogsResult {
  const logs = ref<Array<Record<string, unknown>>>([])
  const loading = ref(false)
  const level = ref<LogLevel | undefined>(undefined)
  const limit = ref(100)

  async function loadLogs() {
    loading.value = true
    try {
      logs.value = (await adminService.getServerLogs(level.value, limit.value)) ?? []
    } finally {
      loading.value = false
    }
  }

  return { logs, loading, level, limit, loadLogs }
}
