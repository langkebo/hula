import { type Ref, ref } from 'vue'
import {
  type AdminAccountValidityInfo,
  type AdminPasswordAuthProvider,
  adminAccountValidityService,
  adminPasswordAuthProviderService,
  adminPolicyServerService,
  adminRateLimitService,
  type PolicyCheckRequest,
  type PolicyCheckResponse,
  type PolicyServerStatus,
  type RateLimitStatusResponse
} from '@/services/matrix/admin'

/** 新建密码认证提供方时页面收集的草稿字段。 */
interface PasswordAuthProviderDraft {
  providerName: string
  providerType: string
  config: Record<string, unknown>
  isEnabled: boolean
  priority: number
}

interface UseAdminAccountPolicyResult {
  validity: Ref<AdminAccountValidityInfo | null>
  validityLoading: Ref<boolean>
  validitySaving: Ref<boolean>
  validityError: Ref<string | null>

  providers: Ref<AdminPasswordAuthProvider[]>
  providersLoading: Ref<boolean>
  providersSaving: Ref<boolean>
  providersError: Ref<string | null>

  policyStatus: Ref<PolicyServerStatus | null>
  policyLoading: Ref<boolean>
  policyChecking: Ref<boolean>
  policyError: Ref<string | null>
  policyResult: Ref<PolicyCheckResponse | null>

  rateLimit: Ref<RateLimitStatusResponse | null>
  rateLimitLoading: Ref<boolean>
  rateLimitError: Ref<string | null>

  loadValidity: (userId: string) => Promise<void>
  setValidity: (userId: string, expirationTs: number) => Promise<boolean>
  renewValidity: (userId: string, renewalToken: string, newExpirationTs: number) => Promise<boolean>
  loadProviders: () => Promise<void>
  createProvider: (draft: PasswordAuthProviderDraft) => Promise<boolean>
  loadPolicyStatus: () => Promise<void>
  runPolicyCheck: (request: PolicyCheckRequest) => Promise<boolean>
  loadRateLimit: () => Promise<void>
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * 账户与策略管理 composable。
 *
 * 覆盖 ADM-05 组 a 的 8 条端点：账户有效期（查询/设置/续期）、密码认证提供方
 * （列表/创建）、策略服务器（状态/检查）、限流状态。
 */
export function useAdminAccountPolicy(): UseAdminAccountPolicyResult {
  const validity = ref<AdminAccountValidityInfo | null>(null)
  const validityLoading = ref(false)
  const validitySaving = ref(false)
  const validityError = ref<string | null>(null)

  const providers = ref<AdminPasswordAuthProvider[]>([])
  const providersLoading = ref(false)
  const providersSaving = ref(false)
  const providersError = ref<string | null>(null)

  const policyStatus = ref<PolicyServerStatus | null>(null)
  const policyLoading = ref(false)
  const policyChecking = ref(false)
  const policyError = ref<string | null>(null)
  const policyResult = ref<PolicyCheckResponse | null>(null)

  const rateLimit = ref<RateLimitStatusResponse | null>(null)
  const rateLimitLoading = ref(false)
  const rateLimitError = ref<string | null>(null)

  async function loadValidity(userId: string): Promise<void> {
    validityLoading.value = true
    validityError.value = null
    try {
      validity.value = await adminAccountValidityService.getValidity(userId)
    } catch (err) {
      validity.value = null
      validityError.value = toMessage(err)
    } finally {
      validityLoading.value = false
    }
  }

  /**
   * 写后回读：写接口的响应只作为兜底值，最终状态以服务端查询为准，
   * 避免本地状态与服务端漂移。回读失败时保留写响应，不把面板打成空态。
   */
  async function refreshValidity(userId: string, written: AdminAccountValidityInfo): Promise<void> {
    try {
      validity.value = await adminAccountValidityService.getValidity(userId)
    } catch (err) {
      validity.value = written
      validityError.value = toMessage(err)
    }
  }

  async function setValidity(userId: string, expirationTs: number): Promise<boolean> {
    validitySaving.value = true
    validityError.value = null
    try {
      const written = await adminAccountValidityService.createValidity({
        user_id: userId,
        expiration_ts: expirationTs,
        is_valid: true
      })
      await refreshValidity(userId, written)
      return true
    } catch (err) {
      validityError.value = toMessage(err)
      return false
    } finally {
      validitySaving.value = false
    }
  }

  async function renewValidity(userId: string, renewalToken: string, newExpirationTs: number): Promise<boolean> {
    validitySaving.value = true
    validityError.value = null
    try {
      const written = await adminAccountValidityService.renewValidity(userId, {
        renewal_token: renewalToken,
        new_expiration_ts: newExpirationTs
      })
      await refreshValidity(userId, written)
      return true
    } catch (err) {
      validityError.value = toMessage(err)
      return false
    } finally {
      validitySaving.value = false
    }
  }

  async function loadProviders(): Promise<void> {
    providersLoading.value = true
    providersError.value = null
    try {
      providers.value = await adminPasswordAuthProviderService.listProviders()
    } catch (err) {
      providers.value = []
      providersError.value = toMessage(err)
    } finally {
      providersLoading.value = false
    }
  }

  async function createProvider(draft: PasswordAuthProviderDraft): Promise<boolean> {
    providersSaving.value = true
    providersError.value = null
    try {
      await adminPasswordAuthProviderService.createProvider({
        provider_name: draft.providerName.trim(),
        provider_type: draft.providerType.trim(),
        config: draft.config,
        is_enabled: draft.isEnabled,
        priority: draft.priority
      })
      await loadProviders()
      return true
    } catch (err) {
      providersError.value = toMessage(err)
      return false
    } finally {
      providersSaving.value = false
    }
  }

  async function loadPolicyStatus(): Promise<void> {
    policyLoading.value = true
    policyError.value = null
    try {
      policyStatus.value = await adminPolicyServerService.getStatus()
    } catch (err) {
      policyStatus.value = null
      policyError.value = toMessage(err)
    } finally {
      policyLoading.value = false
    }
  }

  async function runPolicyCheck(request: PolicyCheckRequest): Promise<boolean> {
    policyChecking.value = true
    policyError.value = null
    policyResult.value = null
    try {
      policyResult.value = await adminPolicyServerService.check(request)
      return true
    } catch (err) {
      policyError.value = toMessage(err)
      return false
    } finally {
      policyChecking.value = false
    }
  }

  async function loadRateLimit(): Promise<void> {
    rateLimitLoading.value = true
    rateLimitError.value = null
    try {
      rateLimit.value = await adminRateLimitService.getStatus()
    } catch (err) {
      rateLimit.value = null
      rateLimitError.value = toMessage(err)
    } finally {
      rateLimitLoading.value = false
    }
  }

  return {
    validity,
    validityLoading,
    validitySaving,
    validityError,
    providers,
    providersLoading,
    providersSaving,
    providersError,
    policyStatus,
    policyLoading,
    policyChecking,
    policyError,
    policyResult,
    rateLimit,
    rateLimitLoading,
    rateLimitError,
    loadValidity,
    setValidity,
    renewValidity,
    loadProviders,
    createProvider,
    loadPolicyStatus,
    runPolicyCheck,
    loadRateLimit
  }
}
