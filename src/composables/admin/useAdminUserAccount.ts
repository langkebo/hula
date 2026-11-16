import { type Ref, ref } from 'vue'
import { adminService } from '@/services/matrix/admin'
import type { UserInfo } from '@/services/matrix/admin/AdminTypes'

export interface AdminUserAccountState {
  accountStatus: Ref<Record<string, unknown> | null>
  accountStatusLoading: Ref<boolean>
  accountInfo: Ref<Record<string, unknown> | null>
  accountInfoLoading: Ref<boolean>
  accountInfoSaving: Ref<boolean>
  whois: Ref<Record<string, unknown> | null>
  whoisLoading: Ref<boolean>
  registrationNonce: Ref<string>
  registrationNonceLoading: Ref<boolean>
  registering: Ref<boolean>

  loadAccountStatus: () => Promise<void>
  loadAccountInfo: () => Promise<void>
  updateAccountInfo: (updates: Record<string, unknown>) => Promise<void>
  loadWhois: () => Promise<void>
  loadRegistrationNonce: () => Promise<string>
  registerWithNonce: (username: string, password: string, nonce: string, admin?: boolean) => Promise<boolean>
}

/**
 * 管理后台用户「账户状态 / 账户信息 / whois / 注册 nonce」子域。
 *
 * 由 `useAdminUsers` 组合注入当前选中用户与该用户的刷新回调，
 * 使单文件保持可维护体量，同时对外暴露的状态形状不变。
 */
export function useAdminUserAccount(
  selectedUser: Ref<UserInfo | null>,
  onUsersChanged: () => Promise<void>
): AdminUserAccountState {
  const accountStatus = ref<Record<string, unknown> | null>(null)
  const accountStatusLoading = ref(false)
  const accountInfo = ref<Record<string, unknown> | null>(null)
  const accountInfoLoading = ref(false)
  const accountInfoSaving = ref(false)
  const whois = ref<Record<string, unknown> | null>(null)
  const whoisLoading = ref(false)
  const registrationNonce = ref('')
  const registrationNonceLoading = ref(false)
  const registering = ref(false)

  async function loadAccountStatus() {
    if (!selectedUser.value) return
    accountStatusLoading.value = true
    try {
      accountStatus.value = await adminService.getAccountStatus(selectedUser.value.userId)
    } finally {
      accountStatusLoading.value = false
    }
  }

  async function loadAccountInfo() {
    if (!selectedUser.value) return
    accountInfoLoading.value = true
    try {
      accountInfo.value = await adminService.getAccountInfo(selectedUser.value.userId)
    } finally {
      accountInfoLoading.value = false
    }
  }

  async function updateAccountInfo(updates: Record<string, unknown>) {
    if (!selectedUser.value) return
    accountInfoSaving.value = true
    try {
      await adminService.updateAccountInfo(selectedUser.value.userId, updates)
      await loadAccountInfo()
      await onUsersChanged()
    } finally {
      accountInfoSaving.value = false
    }
  }

  async function loadWhois() {
    if (!selectedUser.value) return
    whoisLoading.value = true
    try {
      whois.value = await adminService.getWhois(selectedUser.value.userId)
    } finally {
      whoisLoading.value = false
    }
  }

  async function loadRegistrationNonce(): Promise<string> {
    registrationNonceLoading.value = true
    try {
      registrationNonce.value = await adminService.getRegistrationNonce()
      return registrationNonce.value
    } finally {
      registrationNonceLoading.value = false
    }
  }

  async function registerWithNonce(username: string, password: string, nonce: string, admin = false): Promise<boolean> {
    registering.value = true
    try {
      const result = await adminService.adminRegister(username, password, nonce, admin)
      if (!result) return false
      await onUsersChanged()
      return true
    } finally {
      registering.value = false
    }
  }

  return {
    accountStatus,
    accountStatusLoading,
    accountInfo,
    accountInfoLoading,
    accountInfoSaving,
    whois,
    whoisLoading,
    registrationNonce,
    registrationNonceLoading,
    registering,
    loadAccountStatus,
    loadAccountInfo,
    updateAccountInfo,
    loadWhois,
    loadRegistrationNonce,
    registerWithNonce
  }
}
