import { type Ref, ref } from 'vue'
import {
  adminPushService,
  type PushCleanupLogsResponse,
  type PushConfigPatchRequest,
  type PushConfigResponse,
  type PushProcessQueueResponse
} from '@/services/matrix/admin'

interface UseAdminPushResult {
  config: Ref<PushConfigResponse | null>
  configLoading: Ref<boolean>
  configSaving: Ref<boolean>
  configError: Ref<string | null>

  processing: Ref<boolean>
  processResult: Ref<PushProcessQueueResponse | null>
  processError: Ref<string | null>

  cleaning: Ref<boolean>
  cleanupResult: Ref<PushCleanupLogsResponse | null>
  cleanupError: Ref<string | null>

  loadConfig: () => Promise<void>
  saveConfig: (patch: PushConfigPatchRequest) => Promise<boolean>
  processQueue: (batchSize?: number) => Promise<boolean>
  cleanupLogs: (days?: number) => Promise<boolean>
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * 推送运维 composable。
 *
 * 覆盖 ADM-05 组 b 的 4 条推送端点：配置读取/更新、队列消费、日志清理。
 * 配置中的敏感值由后端以掩码返回，页面只提交需要变更的键。
 */
export function useAdminPush(): UseAdminPushResult {
  const config = ref<PushConfigResponse | null>(null)
  const configLoading = ref(false)
  const configSaving = ref(false)
  const configError = ref<string | null>(null)

  const processing = ref(false)
  const processResult = ref<PushProcessQueueResponse | null>(null)
  const processError = ref<string | null>(null)

  const cleaning = ref(false)
  const cleanupResult = ref<PushCleanupLogsResponse | null>(null)
  const cleanupError = ref<string | null>(null)

  async function loadConfig(): Promise<void> {
    configLoading.value = true
    configError.value = null
    try {
      config.value = await adminPushService.getConfig()
    } catch (err) {
      config.value = null
      configError.value = toMessage(err)
    } finally {
      configLoading.value = false
    }
  }

  async function saveConfig(patch: PushConfigPatchRequest): Promise<boolean> {
    configSaving.value = true
    configError.value = null
    try {
      await adminPushService.setConfig(patch)
      await loadConfig()
      return true
    } catch (err) {
      configError.value = toMessage(err)
      return false
    } finally {
      configSaving.value = false
    }
  }

  async function processQueue(batchSize?: number): Promise<boolean> {
    processing.value = true
    processError.value = null
    try {
      processResult.value = await adminPushService.processQueue(batchSize)
      return true
    } catch (err) {
      processError.value = toMessage(err)
      return false
    } finally {
      processing.value = false
    }
  }

  async function cleanupLogs(days?: number): Promise<boolean> {
    cleaning.value = true
    cleanupError.value = null
    try {
      cleanupResult.value = await adminPushService.cleanupLogs(days)
      return true
    } catch (err) {
      cleanupError.value = toMessage(err)
      return false
    } finally {
      cleaning.value = false
    }
  }

  return {
    config,
    configLoading,
    configSaving,
    configError,
    processing,
    processResult,
    processError,
    cleaning,
    cleanupResult,
    cleanupError,
    loadConfig,
    saveConfig,
    processQueue,
    cleanupLogs
  }
}
