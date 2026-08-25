import { computed, type Ref, ref } from 'vue'
import { adminService } from '@/services/matrix/admin'
import type { RateLimit, ShadowBanStatus, UserDevice, UserInfo } from '@/services/matrix/admin/AdminTypes'

export type { UserDevice, UserInfo } from '@/services/matrix/admin/AdminTypes'

export interface UserSession {
  deviceId: string
  deviceName?: string
  lastSeenIp?: string
  lastSeenTs?: number
}

interface UserStats {
  joined_rooms?: number
  joinedRooms?: number
  messages_sent?: number
  messagesSent?: number
  media_uploaded?: number
  mediaUploaded?: number
  invites_sent?: number
  invitesSent?: number
  [key: string]: unknown
}

interface UseAdminUsersResult {
  // state
  users: Ref<UserInfo[]>
  filteredUsers: Ref<UserInfo[]>
  loading: Ref<boolean>
  searchQuery: Ref<string>
  filterRole: Ref<'all' | 'admin' | 'user'>
  filterStatus: Ref<'all' | 'active' | 'deactivated'>

  // selected user detail state
  selectedUser: Ref<UserInfo | null>
  userDevices: Ref<UserDevice[]>
  devicesLoading: Ref<boolean>
  rateLimit: Ref<RateLimit | null>
  rateLimitLoading: Ref<boolean>
  shadowBanStatus: Ref<ShadowBanStatus | null>
  shadowBanLoading: Ref<boolean>
  userSessions: Ref<UserSession[]>
  sessionsLoading: Ref<boolean>
  userStats: Ref<UserStats | null>
  statsLoading: Ref<boolean>
  accountStatus: Ref<Record<string, unknown> | null>
  accountStatusLoading: Ref<boolean>

  // batch selection state
  selectedUserIds: Ref<Set<string>>

  // actions
  loadUsers: (limit?: number) => Promise<void>
  selectUser: (user: UserInfo | null) => Promise<void>
  loadUserDevices: () => Promise<void>
  loadRateLimit: () => Promise<void>
  loadShadowBanStatus: () => Promise<void>
  loadUserSessions: () => Promise<void>
  loadUserStats: () => Promise<void>
  loadAccountStatus: () => Promise<void>
  invalidateSession: (userId: string) => Promise<void>
  batchDeactivate: (userIds: string[], erase?: boolean) => Promise<Array<{ userId: string; success: boolean }>>
  toggleUserSelection: (userId: string) => void
  selectAllUsers: () => void
  clearSelection: () => void

  createUser: (
    username: string,
    password: string,
    opts?: { admin?: boolean; displayname?: string }
  ) => Promise<UserInfo | null>
  resetPassword: (userId: string, newPassword: string) => Promise<void>
  deactivateUser: (userId: string) => Promise<void>
  activateUser: (userId: string) => Promise<void>
  setAdmin: (userId: string, isAdmin: boolean) => Promise<void>
  deleteUserDevice: (userId: string, deviceId: string) => Promise<void>
  overrideUserRateLimit: (userId: string) => Promise<void>
  deleteRateLimit: (userId: string) => Promise<void>
  shadowBanUser: (userId: string) => Promise<void>
  unshadowBanUser: (userId: string) => Promise<void>
}

/**
 * Admin users composable.
 *
 * Owns state + orchestration for the admin user-management surface so that
 * desktop (`src/views/admin/AdminUsers.vue`) renders business logic.
 *
 * Views should be declarative: bind to the refs, call the actions, render UI.
 * Do not duplicate fetch/mutation logic inside `.vue` files.
 */
export function useAdminUsers(): UseAdminUsersResult {
  const users = ref<UserInfo[]>([])
  const loading = ref(false)
  const searchQuery = ref('')
  const filterRole = ref<'all' | 'admin' | 'user'>('all')
  const filterStatus = ref<'all' | 'active' | 'deactivated'>('all')

  const selectedUser = ref<UserInfo | null>(null)
  const userDevices = ref<UserDevice[]>([])
  const devicesLoading = ref(false)
  const rateLimit = ref<RateLimit | null>(null)
  const rateLimitLoading = ref(false)
  const shadowBanStatus = ref<ShadowBanStatus | null>(null)
  const shadowBanLoading = ref(false)
  const userSessions = ref<UserSession[]>([])
  const sessionsLoading = ref(false)
  const userStats = ref<UserStats | null>(null)
  const statsLoading = ref(false)
  const accountStatus = ref<Record<string, unknown> | null>(null)
  const accountStatusLoading = ref(false)
  const selectedUserIds = ref<Set<string>>(new Set())

  const filteredUsers = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    return users.value.filter((u) => {
      // search filter
      if (q) {
        const matches =
          u.userId.toLowerCase().includes(q) ||
          (u.displayname ?? '').toLowerCase().includes(q) ||
          (u.name ?? '').toLowerCase().includes(q)
        if (!matches) return false
      }
      // role filter
      if (filterRole.value === 'admin' && !u.admin) return false
      if (filterRole.value === 'user' && u.admin) return false
      // status filter
      if (filterStatus.value === 'active' && u.deactivated) return false
      if (filterStatus.value === 'deactivated' && !u.deactivated) return false
      return true
    })
  })

  async function loadUsers(limit = 200) {
    loading.value = true
    try {
      const result = await adminService.getUsers(limit)
      users.value = result.users
    } finally {
      loading.value = false
    }
  }

  async function selectUser(user: UserInfo | null) {
    selectedUser.value = user
    userDevices.value = []
    rateLimit.value = null
    shadowBanStatus.value = null
    userSessions.value = []
    userStats.value = null
    accountStatus.value = null
    if (!user) return
    await Promise.allSettled([
      loadUserDevices(),
      loadRateLimit(),
      loadShadowBanStatus(),
      loadUserSessions(),
      loadUserStats(),
      loadAccountStatus()
    ])
  }

  async function loadUserDevices() {
    if (!selectedUser.value) return
    devicesLoading.value = true
    try {
      userDevices.value = await adminService.getUserDevices(selectedUser.value.userId)
    } finally {
      devicesLoading.value = false
    }
  }

  async function loadRateLimit() {
    if (!selectedUser.value) return
    rateLimitLoading.value = true
    try {
      rateLimit.value = await adminService.getRateLimit(selectedUser.value.userId)
    } finally {
      rateLimitLoading.value = false
    }
  }

  async function loadShadowBanStatus() {
    if (!selectedUser.value) return
    shadowBanLoading.value = true
    try {
      shadowBanStatus.value = await adminService.getShadowBanStatus(selectedUser.value.userId)
    } finally {
      shadowBanLoading.value = false
    }
  }

  async function createUser(
    username: string,
    password: string,
    opts?: { admin?: boolean; displayname?: string }
  ): Promise<UserInfo | null> {
    const result = await adminService.createUser(username, password, opts)
    if (result) await loadUsers()
    return result
  }

  async function resetPassword(userId: string, newPassword: string) {
    await adminService.resetPassword(userId, newPassword)
  }

  async function deactivateUser(userId: string) {
    await adminService.deactivateUser(userId)
    await loadUsers()
  }

  async function activateUser(userId: string) {
    await adminService.activateUser(userId)
    await loadUsers()
  }

  async function setAdmin(userId: string, isAdmin: boolean) {
    await adminService.setAdmin(userId, isAdmin)
    await loadUsers()
  }

  async function deleteUserDevice(userId: string, deviceId: string) {
    await adminService.deleteUserDevice(userId, deviceId)
    if (selectedUser.value?.userId === userId) await loadUserDevices()
  }

  async function overrideUserRateLimit(userId: string) {
    await adminService.overrideUserRateLimit(userId)
    if (selectedUser.value?.userId === userId) await loadRateLimit()
  }

  async function deleteRateLimit(userId: string) {
    await adminService.deleteRateLimit(userId)
    if (selectedUser.value?.userId === userId) await loadRateLimit()
  }

  async function shadowBanUser(userId: string) {
    await adminService.shadowBanUser(userId)
    if (selectedUser.value?.userId === userId) await loadShadowBanStatus()
  }

  async function unshadowBanUser(userId: string) {
    await adminService.unshadowBanUser(userId)
    if (selectedUser.value?.userId === userId) await loadShadowBanStatus()
  }

  async function loadUserSessions() {
    if (!selectedUser.value) return
    sessionsLoading.value = true
    try {
      const sessions = await adminService.getUserSessions(selectedUser.value.userId)
      userSessions.value = sessions.map((s) => ({
        deviceId: (s.device_id as string) ?? (s.deviceId as string) ?? '',
        deviceName: (s.device_name as string) ?? (s.deviceName as string) ?? undefined,
        lastSeenIp: (s.last_seen_ip as string) ?? (s.lastSeenIp as string) ?? undefined,
        lastSeenTs: (s.last_seen_ts as number) ?? (s.lastSeenTs as number) ?? undefined
      }))
    } finally {
      sessionsLoading.value = false
    }
  }

  async function loadUserStats() {
    if (!selectedUser.value) return
    statsLoading.value = true
    try {
      userStats.value = await adminService.getUserStats(selectedUser.value.userId)
    } finally {
      statsLoading.value = false
    }
  }

  async function loadAccountStatus() {
    if (!selectedUser.value) return
    accountStatusLoading.value = true
    try {
      accountStatus.value = await adminService.getAccountStatus(selectedUser.value.userId)
    } finally {
      accountStatusLoading.value = false
    }
  }

  async function invalidateSession(userId: string) {
    await adminService.invalidateUserSession(userId)
    if (selectedUser.value?.userId === userId) await loadUserSessions()
  }

  async function batchDeactivate(
    userIds: string[],
    erase = false
  ): Promise<Array<{ userId: string; success: boolean }>> {
    const result = await adminService.batchDeactivateUsers(userIds, erase)
    await loadUsers()
    clearSelection()
    return result
  }

  function toggleUserSelection(userId: string) {
    const next = new Set(selectedUserIds.value)
    if (next.has(userId)) {
      next.delete(userId)
    } else {
      next.add(userId)
    }
    selectedUserIds.value = next
  }

  function selectAllUsers() {
    const next = new Set<string>()
    for (const u of filteredUsers.value) {
      next.add(u.userId)
    }
    selectedUserIds.value = next
  }

  function clearSelection() {
    selectedUserIds.value = new Set()
  }

  return {
    users,
    filteredUsers,
    loading,
    searchQuery,
    filterRole,
    filterStatus,
    selectedUser,
    userDevices,
    devicesLoading,
    rateLimit,
    rateLimitLoading,
    shadowBanStatus,
    shadowBanLoading,
    userSessions,
    sessionsLoading,
    userStats,
    statsLoading,
    accountStatus,
    accountStatusLoading,
    selectedUserIds,
    loadUsers,
    selectUser,
    loadUserDevices,
    loadRateLimit,
    loadShadowBanStatus,
    loadUserSessions,
    loadUserStats,
    loadAccountStatus,
    invalidateSession,
    batchDeactivate,
    toggleUserSelection,
    selectAllUsers,
    clearSelection,
    createUser,
    resetPassword,
    deactivateUser,
    activateUser,
    setAdmin,
    deleteUserDevice,
    overrideUserRateLimit,
    deleteRateLimit,
    shadowBanUser,
    unshadowBanUser
  }
}
