import { type Ref, ref } from 'vue'
import { adminService } from '@/services/matrix/admin'

export interface AuditEntryView {
  id: string
  type: string
  user_id: string
  target?: string
  timestamp: number
  details?: Record<string, unknown>
}

export interface UseAdminAuditResult {
  logs: Ref<AuditEntryView[]>
  loading: Ref<boolean>
  selected: Ref<AuditEntryView | null>
  loadingDetail: Ref<boolean>

  loadLogs: (filters?: { userId?: string; type?: string; limit?: number; from?: string }) => Promise<void>
  loadDetail: (eventId: string) => Promise<AuditEntryView | null>
  clearSelected: () => void
}

/**
 * Admin audit composable.
 *
 * Owns state + orchestration for the audit log surface. Delegates to
 * `adminService.getAuditLog` / `getAuditEvent` (both SDK-backed after
 * Phase B Batch 5). The view treats backend event shapes as `AuditEntryView`
 * — if backend field names diverge they surface directly on each row.
 */
export function useAdminAudit(): UseAdminAuditResult {
  const logs = ref<AuditEntryView[]>([])
  const loading = ref(false)
  const selected = ref<AuditEntryView | null>(null)
  const loadingDetail = ref(false)

  async function loadLogs(filters?: { userId?: string; type?: string; limit?: number; from?: string }) {
    loading.value = true
    try {
      const result = await adminService.getAuditLog(filters?.limit ?? 50, filters?.from, filters?.userId, filters?.type)
      logs.value = (result?.logs ?? []) as unknown as AuditEntryView[]
    } finally {
      loading.value = false
    }
  }

  async function loadDetail(eventId: string) {
    loadingDetail.value = true
    try {
      const result = await adminService.getAuditEvent(eventId)
      selected.value = (result as unknown as AuditEntryView) ?? null
      return selected.value
    } finally {
      loadingDetail.value = false
    }
  }

  function clearSelected() {
    selected.value = null
  }

  return {
    logs,
    loading,
    selected,
    loadingDetail,
    loadLogs,
    loadDetail,
    clearSelected
  }
}
