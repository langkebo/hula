import { type Ref, ref } from 'vue'
import { adminService } from '@/services/matrix/admin'
import type { UserInfo } from '@/services/matrix/admin/AdminTypes'

export interface ImpersonationSession {
  userId: string
  accessToken: string
  deviceId: string
}

export interface BatchCreateUserInput {
  username: string
  password: string
  displayname?: string
  admin?: boolean
}

export interface AdminUserGovernanceState {
  detailRefreshing: Ref<boolean>
  adminCheck: Ref<boolean | null>
  adminCheckLoading: Ref<boolean>
  userStatsOverview: Ref<Array<Record<string, unknown>>>
  statsOverviewLoading: Ref<boolean>
  impersonationSession: Ref<ImpersonationSession | null>
  evicting: Ref<boolean>
  loggingOutAll: Ref<boolean>
  samlLoggingOut: Ref<boolean>
  impersonating: Ref<boolean>
  batchCreating: Ref<boolean>

  refreshUserDetail: () => Promise<UserInfo | null>
  loadAdminCheck: () => Promise<void>
  loadUserStatsOverview: () => Promise<void>
  evictUser: (userId: string) => Promise<void>
  logoutUserAll: (userId: string) => Promise<void>
  samlLogout: (userId: string) => Promise<void>
  loginUserAs: (userId: string) => Promise<ImpersonationSession | null>
  clearImpersonation: () => void
  batchCreateUsers: (users: BatchCreateUserInput[]) => Promise<Array<{ userId: string; success: boolean }>>
  resetGovernance: () => void
}

/**
 * 管理后台用户「处置」子域：强制下线、模拟登录、批量创建、详情刷新与服务端补充信息。
 *
 * 与 `useAdminUserAccount` 同构：由 `useAdminUsers` 组合注入选中用户与列表刷新回调，
 * 保持单文件体量可控，同时对外暴露的状态形状不变。
 */
export function useAdminUserGovernance(
  selectedUser: Ref<UserInfo | null>,
  users: Ref<UserInfo[]>,
  onUsersChanged: () => Promise<void>
): AdminUserGovernanceState {
  const detailRefreshing = ref(false)
  const adminCheck = ref<boolean | null>(null)
  const adminCheckLoading = ref(false)
  const userStatsOverview = ref<Array<Record<string, unknown>>>([])
  const statsOverviewLoading = ref(false)
  const impersonationSession = ref<ImpersonationSession | null>(null)
  const evicting = ref(false)
  const loggingOutAll = ref(false)
  const samlLoggingOut = ref(false)
  const impersonating = ref(false)
  const batchCreating = ref(false)

  async function refreshUserDetail(): Promise<UserInfo | null> {
    if (!selectedUser.value) return null
    const userId = selectedUser.value.userId
    detailRefreshing.value = true
    try {
      const fresh = await adminService.getUserById(userId)
      if (!fresh) return null
      selectedUser.value = fresh
      const index = users.value.findIndex((u) => u.userId === userId)
      if (index >= 0) users.value[index] = fresh
      return fresh
    } finally {
      detailRefreshing.value = false
    }
  }

  async function loadAdminCheck() {
    if (!selectedUser.value) return
    adminCheckLoading.value = true
    try {
      adminCheck.value = (await adminService.checkUserAdmin(selectedUser.value.userId)) === true
    } finally {
      adminCheckLoading.value = false
    }
  }

  async function loadUserStatsOverview() {
    statsOverviewLoading.value = true
    try {
      const result = await adminService.getUserStatsList()
      userStatsOverview.value = result?.stats ?? []
    } finally {
      statsOverviewLoading.value = false
    }
  }

  async function evictUser(userId: string) {
    evicting.value = true
    try {
      await adminService.evictUser(userId)
      await onUsersChanged()
    } finally {
      evicting.value = false
    }
  }

  async function logoutUserAll(userId: string) {
    loggingOutAll.value = true
    try {
      await adminService.logoutUserAll(userId)
    } finally {
      loggingOutAll.value = false
    }
  }

  async function samlLogout(userId: string) {
    samlLoggingOut.value = true
    try {
      await adminService.security.samlLogout(userId)
    } finally {
      samlLoggingOut.value = false
    }
  }

  async function loginUserAs(userId: string): Promise<ImpersonationSession | null> {
    impersonating.value = true
    try {
      const result = await adminService.loginUserAs(userId)
      if (!result?.accessToken) return null
      impersonationSession.value = {
        userId,
        accessToken: result.accessToken,
        deviceId: result.deviceId
      }
      return impersonationSession.value
    } finally {
      impersonating.value = false
    }
  }

  function clearImpersonation() {
    impersonationSession.value = null
  }

  async function batchCreateUsers(usersToCreate: BatchCreateUserInput[]) {
    batchCreating.value = true
    try {
      const result = await adminService.batchCreateUsers(usersToCreate)
      await onUsersChanged()
      return result
    } finally {
      batchCreating.value = false
    }
  }

  function resetGovernance() {
    adminCheck.value = null
    userStatsOverview.value = []
    impersonationSession.value = null
  }

  return {
    detailRefreshing,
    adminCheck,
    adminCheckLoading,
    userStatsOverview,
    statsOverviewLoading,
    impersonationSession,
    evicting,
    loggingOutAll,
    samlLoggingOut,
    impersonating,
    batchCreating,
    refreshUserDetail,
    loadAdminCheck,
    loadUserStatsOverview,
    evictUser,
    logoutUserAll,
    samlLogout,
    loginUserAs,
    clearImpersonation,
    batchCreateUsers,
    resetGovernance
  }
}
