import { type Ref, ref } from 'vue'
import { adminService } from '@/services/matrix/admin'
import type { AdminAuditLogEntry } from '@/services/matrix/admin/AdminTypes'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminSecurity')

interface UseAdminSecurityResult {
  auditLogs: Ref<AdminAuditLogEntry[]>
  loading: Ref<boolean>
  nextBatch: Ref<string | undefined>

  loadAuditLogs: (limit?: number, from?: string, userId?: string, eventType?: string) => Promise<void>
}

/**
 * Admin security composable.
 *
 * Modified to focus on direct consumption of audit events,
 * avoiding unimplemented legacy security event endpoints.
 */
export function useAdminSecurity(): UseAdminSecurityResult {
  const auditLogs = ref<AdminAuditLogEntry[]>([])
  const loading = ref(false)
  const nextBatch = ref<string | undefined>(undefined)

  async function loadAuditLogs(limit = 50, from?: string, userId?: string, eventType?: string) {
    loading.value = true
    try {
      const result = await adminService.security.getAuditLog(limit, from, userId, eventType)
      if (from) {
        auditLogs.value = [...auditLogs.value, ...(result?.logs ?? [])]
      } else {
        auditLogs.value = result?.logs ?? []
      }
      nextBatch.value = result?.next_batch
    } catch (e) {
      logger.error('加载审计日志失败', e)
    } finally {
      loading.value = false
    }
  }

  return {
    auditLogs,
    loading,
    nextBatch,
    loadAuditLogs
  }
}
