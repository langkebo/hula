import { computed, type Ref, ref } from 'vue'
import { adminService } from '@/services/matrix/admin'
import type { RateLimit, ShadowBanStatus, UserDevice, UserInfo } from '@/services/matrix/admin/AdminTypes'

export interface UseAdminUsersResult {
  // state
  users: Ref<UserInfo[]>
  filteredUsers: Ref<UserInfo[]>
  loading: Ref<boolean>
  searchQuery: Ref<string>

  // selected user detail state
  selectedUser: Ref<UserInfo | null>
  userDevices: Ref<UserDevice[]>
  devicesLoading: Ref<boolean>
  rateLimit: Ref<RateLimit | null>
  rateLimitLoading: Ref<boolean>
  shadowBanStatus: Ref<ShadowBanStatus | null>
  shadowBanLoading: Ref<boolean>

  // actions
  loadUsers: (limit?: number) => Promise<void>
  selectUser: (user: UserInfo | null) => Promise<void>
  loadUserDevices: () => Promise<void>
  loadRateLimit: () => Promise<void>
  loadShadowBanStatus: () => Promise<void>

  createUser: (
    username: string,
    password: string,
    opts?: { admin?: boolean; displayname?: string }
  ) => Promise<UserInfo | null>
  resetPassword: (userId: string, newPassword: string) => Promise<void>
  deactivateUser: (userId: string) => Promise<void>
  setAdmin: (userId: string, isAdmin: boolean) => Promise<void>
  deleteUserDevice: (userId: string, deviceId: string) => Promise<void>
  setRateLimit: (userId: string, limit: RateLimit) => Promise<void>
  deleteRateLimit: (userId: string) => Promise<void>
  shadowBanUser: (userId: string) => Promise<void>
  unshadowBanUser: (userId: string) => Promise<void>
}

/**
 * Admin users composable.
 *
 * Owns state + orchestration for the admin user-management surface so that
 * desktop (`src/views/admin/AdminUsers.vue`) and mobile
 * (`src/mobile/views/admin/AdminUsers.vue`) render the same business logic.
 *
 * Views should be declarative: bind to the refs, call the actions, render UI.
 * Do not duplicate fetch/mutation logic inside `.vue` files.
 */
export function useAdminUsers(): UseAdminUsersResult {
  const users = ref<UserInfo[]>([])
  const loading = ref(false)
  const searchQuery = ref('')

  const selectedUser = ref<UserInfo | null>(null)
  const userDevices = ref<UserDevice[]>([])
  const devicesLoading = ref(false)
  const rateLimit = ref<RateLimit | null>(null)
  const rateLimitLoading = ref(false)
  const shadowBanStatus = ref<ShadowBanStatus | null>(null)
  const shadowBanLoading = ref(false)

  const filteredUsers = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return users.value
    return users.value.filter((u) => {
      return (
        u.userId.toLowerCase().includes(q) ||
        (u.displayname ?? '').toLowerCase().includes(q) ||
        (u.name ?? '').toLowerCase().includes(q)
      )
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
    if (!user) return
    await Promise.allSettled([loadUserDevices(), loadRateLimit(), loadShadowBanStatus()])
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

  async function setAdmin(userId: string, isAdmin: boolean) {
    await adminService.setAdmin(userId, isAdmin)
    await loadUsers()
  }

  async function deleteUserDevice(userId: string, deviceId: string) {
    await adminService.deleteUserDevice(userId, deviceId)
    if (selectedUser.value?.userId === userId) await loadUserDevices()
  }

  async function setRateLimit(userId: string, limit: RateLimit) {
    await adminService.setRateLimit(userId, limit)
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

  return {
    users,
    filteredUsers,
    loading,
    searchQuery,
    selectedUser,
    userDevices,
    devicesLoading,
    rateLimit,
    rateLimitLoading,
    shadowBanStatus,
    shadowBanLoading,
    loadUsers,
    selectUser,
    loadUserDevices,
    loadRateLimit,
    loadShadowBanStatus,
    createUser,
    resetPassword,
    deactivateUser,
    setAdmin,
    deleteUserDevice,
    setRateLimit,
    deleteRateLimit,
    shadowBanUser,
    unshadowBanUser
  }
}
