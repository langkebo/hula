import { type Ref, ref } from 'vue'
import { adminService } from '@/services/matrix/admin'

export interface RetentionPolicyView {
  roomId: string
  minLifetime?: number
  maxLifetime?: number
}

export interface UseAdminRetentionResult {
  policies: Ref<RetentionPolicyView[]>
  retentionStatus: Ref<Record<string, unknown> | null>
  loading: Ref<boolean>
  taskLoading: Ref<boolean>

  loadPolicies: () => Promise<void>
  loadStatus: () => Promise<void>
  loadAll: () => Promise<void>
  setPolicy: (roomId: string, maxLifetime?: number, minLifetime?: number) => Promise<void>
  /** @deprecated backend has no DELETE route; composable no-op. */
  deletePolicy: (roomId: string) => Promise<void>
  runTask: () => Promise<void>
}

/**
 * Admin retention composable.
 *
 * Owns state + orchestration for the admin retention-policy surface. Backend
 * exposes a single global policy (`GET/POST /retention/policy`) plus per-room
 * overrides (`GET/POST /retention/policy/{roomId}`) — no list or delete.
 * `policies` is the composable's unified view model: at minimum contains the
 * global policy as a single entry; can be expanded later if the backend adds
 * a list endpoint.
 */
export function useAdminRetention(): UseAdminRetentionResult {
  const policies = ref<RetentionPolicyView[]>([])
  const retentionStatus = ref<Record<string, unknown> | null>(null)
  const loading = ref(false)
  const taskLoading = ref(false)

  function toView(p: Record<string, unknown>): RetentionPolicyView {
    return {
      roomId: (p.room_id as string) ?? '',
      minLifetime: p.min_lifetime as number | undefined,
      maxLifetime: p.max_lifetime as number | undefined
    }
  }

  async function loadPolicies() {
    const result = await adminService.getRetentionPolicies()
    policies.value = (result?.policies ?? []).map(toView)
  }

  async function loadStatus() {
    retentionStatus.value = await adminService.getRetentionStatus()
  }

  async function loadAll() {
    loading.value = true
    try {
      await Promise.all([loadPolicies(), loadStatus()])
    } finally {
      loading.value = false
    }
  }

  async function setPolicy(roomId: string, maxLifetime?: number, minLifetime?: number) {
    await adminService.setRetentionPolicy(roomId, maxLifetime, minLifetime)
    await loadPolicies()
  }

  async function deletePolicy(roomId: string) {
    await adminService.deleteRetentionPolicy(roomId)
    await loadPolicies()
  }

  async function runTask() {
    taskLoading.value = true
    try {
      await adminService.runRetentionTask()
    } finally {
      taskLoading.value = false
    }
  }

  return {
    policies,
    retentionStatus,
    loading,
    taskLoading,
    loadPolicies,
    loadStatus,
    loadAll,
    setPolicy,
    deletePolicy,
    runTask
  }
}
