import { type Ref, ref } from 'vue'
import { adminService } from '@/services/matrix/admin'
import type { RetentionPolicy, RoomRetention } from '@/services/matrix/admin/AdminTypes'

export interface RetentionPolicyView {
  roomId: string
  minLifetime?: number | undefined
  maxLifetime?: number | undefined
}

interface UseAdminRetentionResult {
  policies: Ref<RetentionPolicyView[]>
  retentionStatus: Ref<Record<string, unknown> | null>
  loading: Ref<boolean>
  taskLoading: Ref<boolean>

  /** 服务端默认保留策略 */
  defaultRetention: Ref<RetentionPolicy | null>
  defaultLoading: Ref<boolean>

  /** 房间级保留策略（读取结果即写后回读的唯一来源） */
  roomPolicy: Ref<RoomRetention | null>
  roomPolicyLoading: Ref<boolean>
  roomWriteLoading: Ref<boolean>

  loadPolicies: () => Promise<void>
  loadStatus: () => Promise<void>
  loadAll: () => Promise<void>
  loadDefaultRetention: () => Promise<void>
  loadRoomPolicy: (roomId: string) => Promise<void>
  setPolicy: (roomId: string, maxLifetime?: number, minLifetime?: number) => Promise<void>
  setRoomPolicy: (roomId: string, policy: RetentionPolicy) => Promise<void>
  deleteRoomPolicy: (roomId: string) => Promise<void>
  runTask: () => Promise<void>
}

/**
 * Admin retention composable.
 *
 * Owns state + orchestration for the admin retention-policy surface. Backend
 * exposes a single global policy (`GET/POST /retention/policy`) plus per-room
 * overrides (`GET/POST/DELETE /retention/policy/{roomId}`) and a server default.
 * `policies` is the composable's unified view model: at minimum contains the
 * global policy as a single entry; can be expanded later if the backend adds
 * a list endpoint. Room-level reads always run after writes (ADM-10 口径)。
 */
export function useAdminRetention(): UseAdminRetentionResult {
  const policies = ref<RetentionPolicyView[]>([])
  const retentionStatus = ref<Record<string, unknown> | null>(null)
  const loading = ref(false)
  const taskLoading = ref(false)
  const defaultRetention = ref<RetentionPolicy | null>(null)
  const defaultLoading = ref(false)
  const roomPolicy = ref<RoomRetention | null>(null)
  const roomPolicyLoading = ref(false)
  const roomWriteLoading = ref(false)

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
      await Promise.allSettled([loadPolicies(), loadStatus(), loadDefaultRetention()])
    } finally {
      loading.value = false
    }
  }

  async function loadDefaultRetention() {
    defaultLoading.value = true
    try {
      defaultRetention.value = await adminService.getDefaultRetention()
    } finally {
      defaultLoading.value = false
    }
  }

  async function loadRoomPolicy(roomId: string) {
    const target = roomId.trim()
    if (!target) {
      roomPolicy.value = null
      return
    }
    roomPolicyLoading.value = true
    try {
      roomPolicy.value = await adminService.getRoomRetention(target)
    } finally {
      roomPolicyLoading.value = false
    }
  }

  async function setRoomPolicy(roomId: string, policy: RetentionPolicy) {
    roomWriteLoading.value = true
    try {
      await adminService.setRoomRetention(roomId, policy)
      await loadRoomPolicy(roomId)
    } finally {
      roomWriteLoading.value = false
    }
  }

  async function deleteRoomPolicy(roomId: string) {
    roomWriteLoading.value = true
    try {
      await adminService.deleteRoomRetention(roomId)
      await loadRoomPolicy(roomId)
    } finally {
      roomWriteLoading.value = false
    }
  }

  async function setPolicy(roomId: string, maxLifetime?: number, minLifetime?: number) {
    await adminService.setRetentionPolicy(roomId, maxLifetime, minLifetime)
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
    defaultRetention,
    defaultLoading,
    roomPolicy,
    roomPolicyLoading,
    roomWriteLoading,
    loadPolicies,
    loadStatus,
    loadAll,
    loadDefaultRetention,
    loadRoomPolicy,
    setPolicy,
    setRoomPolicy,
    deleteRoomPolicy,
    runTask
  }
}
