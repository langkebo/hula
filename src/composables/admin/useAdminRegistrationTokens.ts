import { type Ref, ref } from 'vue'
import { adminService } from '@/services/matrix'
import type { RegistrationToken } from '@/services/matrix/admin/AdminTypes'

export interface UseAdminRegistrationTokensResult {
  tokens: Ref<RegistrationToken[]>
  loading: Ref<boolean>
  creating: Ref<boolean>

  loadTokens: () => Promise<void>
  createToken: (options?: {
    token?: string
    usesAllowed?: number
    expiryTime?: number
    length?: number
  }) => Promise<RegistrationToken | null>
  updateToken: (token: string, updates: { usesAllowed?: number; expiryTime?: number }) => Promise<void>
  deleteToken: (token: string) => Promise<void>
}

/**
 * Admin registration-tokens composable.
 *
 * Owns state + orchestration for the registration-token management surface
 * (desktop: `src/views/admin/AdminRegistrationTokens.vue`). The `creating`
 * flag is view-state that the composable exposes so both platforms can drive
 * the same loading UI.
 */
export function useAdminRegistrationTokens(): UseAdminRegistrationTokensResult {
  const tokens = ref<RegistrationToken[]>([])
  const loading = ref(false)
  const creating = ref(false)

  async function loadTokens() {
    loading.value = true
    try {
      tokens.value = await adminService.getRegistrationTokens()
    } finally {
      loading.value = false
    }
  }

  async function createToken(options?: { token?: string; usesAllowed?: number; expiryTime?: number; length?: number }) {
    creating.value = true
    try {
      const result = await adminService.createRegistrationToken(options)
      if (result) await loadTokens()
      return result
    } finally {
      creating.value = false
    }
  }

  async function updateToken(token: string, updates: { usesAllowed?: number; expiryTime?: number }) {
    await adminService.updateRegistrationToken(token, updates)
    await loadTokens()
  }

  async function deleteToken(token: string) {
    await adminService.deleteRegistrationToken(token)
    await loadTokens()
  }

  return {
    tokens,
    loading,
    creating,
    loadTokens,
    createToken,
    updateToken,
    deleteToken
  }
}
