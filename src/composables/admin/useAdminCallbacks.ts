import { type Ref, ref } from 'vue'
import {
  type AdminAccountDataCallback,
  type AdminMediaCallback,
  adminCallbackService,
  type CreateAccountDataCallbackRequest,
  type CreateMediaCallbackRequest
} from '@/services/matrix/admin'

/** 新建媒体回调时页面收集的草稿字段。 */
interface MediaCallbackDraft {
  callbackName: string
  callbackType: string
  url: string
  method: string
  timeoutMs: number
  retryCount: number
  isEnabled: boolean
}

/** 新建账户数据回调时页面收集的草稿字段（`config` 由页面完成 JSON 解析与校验）。 */
interface AccountDataCallbackDraft {
  callbackName: string
  dataTypes: string
  config: Record<string, unknown>
  isEnabled: boolean
}

interface UseAdminCallbacksResult {
  mediaCallbacks: Ref<AdminMediaCallback[]>
  mediaLoading: Ref<boolean>
  mediaSaving: Ref<boolean>
  mediaError: Ref<string | null>

  accountDataCallbacks: Ref<AdminAccountDataCallback[]>
  accountDataLoading: Ref<boolean>
  accountDataSaving: Ref<boolean>
  accountDataError: Ref<string | null>

  loadMediaCallbacks: (callbackType?: string) => Promise<void>
  createMediaCallback: (draft: MediaCallbackDraft) => Promise<boolean>
  loadAccountDataCallbacks: () => Promise<void>
  createAccountDataCallback: (draft: AccountDataCallbackDraft) => Promise<boolean>
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** 把逗号或空格分隔的类型列表拆成数组。 */
function splitTypes(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

/**
 * 回调管理 composable。
 *
 * 覆盖 ADM-05 组 b 的 5 条回调端点：媒体回调（列表/按类型过滤/创建）、
 * 账户数据回调（列表/创建）。
 */
export function useAdminCallbacks(): UseAdminCallbacksResult {
  const mediaCallbacks = ref<AdminMediaCallback[]>([])
  const mediaLoading = ref(false)
  const mediaSaving = ref(false)
  const mediaError = ref<string | null>(null)

  const accountDataCallbacks = ref<AdminAccountDataCallback[]>([])
  const accountDataLoading = ref(false)
  const accountDataSaving = ref(false)
  const accountDataError = ref<string | null>(null)

  async function loadMediaCallbacks(callbackType?: string): Promise<void> {
    mediaLoading.value = true
    mediaError.value = null
    try {
      const type = callbackType?.trim()
      mediaCallbacks.value = type
        ? await adminCallbackService.listMediaCallbacksByType(type)
        : await adminCallbackService.listMediaCallbacks()
    } catch (err) {
      mediaCallbacks.value = []
      mediaError.value = toMessage(err)
    } finally {
      mediaLoading.value = false
    }
  }

  async function createMediaCallback(draft: MediaCallbackDraft): Promise<boolean> {
    const payload: CreateMediaCallbackRequest = {
      callback_name: draft.callbackName.trim(),
      callback_type: draft.callbackType.trim(),
      url: draft.url.trim(),
      method: draft.method.trim() || 'POST',
      is_enabled: draft.isEnabled,
      timeout_ms: draft.timeoutMs,
      retry_count: draft.retryCount
    }
    mediaSaving.value = true
    mediaError.value = null
    try {
      await adminCallbackService.createMediaCallback(payload)
      await loadMediaCallbacks()
      return true
    } catch (err) {
      mediaError.value = toMessage(err)
      return false
    } finally {
      mediaSaving.value = false
    }
  }

  async function loadAccountDataCallbacks(): Promise<void> {
    accountDataLoading.value = true
    accountDataError.value = null
    try {
      accountDataCallbacks.value = await adminCallbackService.listAccountDataCallbacks()
    } catch (err) {
      accountDataCallbacks.value = []
      accountDataError.value = toMessage(err)
    } finally {
      accountDataLoading.value = false
    }
  }

  async function createAccountDataCallback(draft: AccountDataCallbackDraft): Promise<boolean> {
    const dataTypes = splitTypes(draft.dataTypes)
    const payload: CreateAccountDataCallbackRequest = {
      callback_name: draft.callbackName.trim(),
      config: draft.config,
      is_enabled: draft.isEnabled
    }
    if (dataTypes.length > 0) {
      payload.data_types = dataTypes
    }
    accountDataSaving.value = true
    accountDataError.value = null
    try {
      await adminCallbackService.createAccountDataCallback(payload)
      await loadAccountDataCallbacks()
      return true
    } catch (err) {
      accountDataError.value = toMessage(err)
      return false
    } finally {
      accountDataSaving.value = false
    }
  }

  return {
    mediaCallbacks,
    mediaLoading,
    mediaSaving,
    mediaError,
    accountDataCallbacks,
    accountDataLoading,
    accountDataSaving,
    accountDataError,
    loadMediaCallbacks,
    createMediaCallback,
    loadAccountDataCallbacks,
    createAccountDataCallback
  }
}
