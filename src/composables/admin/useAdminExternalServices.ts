import { type Ref, ref } from 'vue'
import { adminService, type ExternalService, type ExternalServiceHealth } from '@/services/matrix/admin'

/** 注册外部服务时页面收集的草稿字段。 */
export interface ExternalServiceDraft {
  service_type: string
  service_id: string
  display_name: string
  webhook_url?: string
  api_key?: string
}

interface UseAdminExternalServicesResult {
  services: Ref<ExternalService[]>
  healthMap: Ref<Record<string, ExternalServiceHealth>>
  loading: Ref<boolean>
  error: Ref<string | null>
  serviceType: Ref<string>
  checkingId: Ref<string | null>
  mutating: Ref<boolean>

  loadServices: (serviceType?: string) => Promise<void>
  registerService: (draft: ExternalServiceDraft) => Promise<boolean>
  setEnabled: (service: ExternalService, enabled: boolean) => Promise<boolean>
  checkHealth: (service: ExternalService) => Promise<void>
  removeService: (service: ExternalService) => Promise<boolean>
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * 外部服务管理 composable。
 *
 * 复用 `AdminExternalServiceService`（`getAdminManager().externalService`）的
 * 列表 / 注册 / 更新 / 注销 / 健康检查能力，页面只负责渲染与触发。
 */
export function useAdminExternalServices(): UseAdminExternalServicesResult {
  const services = ref<ExternalService[]>([])
  const healthMap = ref<Record<string, ExternalServiceHealth>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  const serviceType = ref('all')
  const checkingId = ref<string | null>(null)
  const mutating = ref(false)

  async function loadHealth() {
    const list = await adminService.externalServices.getAllHealth()
    healthMap.value = Object.fromEntries(list.map((item) => [item.service_id, item]))
  }

  async function loadServices(nextServiceType?: string) {
    const target = nextServiceType ?? serviceType.value
    serviceType.value = target
    loading.value = true
    error.value = null
    try {
      services.value = await adminService.externalServices.listServices({ serviceType: target })
      await loadHealth()
    } catch (err) {
      services.value = []
      healthMap.value = {}
      error.value = toMessage(err)
    } finally {
      loading.value = false
    }
  }

  async function registerService(draft: ExternalServiceDraft): Promise<boolean> {
    mutating.value = true
    error.value = null
    try {
      await adminService.externalServices.registerService({
        service_type: draft.service_type,
        service_id: draft.service_id.trim(),
        display_name: draft.display_name.trim(),
        ...(draft.webhook_url?.trim() ? { webhook_url: draft.webhook_url.trim() } : {}),
        ...(draft.api_key?.trim() ? { api_key: draft.api_key.trim() } : {})
      })
      await loadServices()
      return true
    } catch (err) {
      error.value = toMessage(err)
      return false
    } finally {
      mutating.value = false
    }
  }

  async function setEnabled(service: ExternalService, enabled: boolean): Promise<boolean> {
    mutating.value = true
    error.value = null
    try {
      const updated = await adminService.externalServices.updateService(service.as_id, { is_enabled: enabled })
      services.value = services.value.map((item) => (item.as_id === service.as_id ? updated : item))
      return true
    } catch (err) {
      error.value = toMessage(err)
      return false
    } finally {
      mutating.value = false
    }
  }

  async function checkHealth(service: ExternalService): Promise<void> {
    checkingId.value = service.as_id
    error.value = null
    try {
      await adminService.externalServices.checkServiceHealth(service.as_id)
      await loadHealth()
    } catch (err) {
      error.value = toMessage(err)
    } finally {
      checkingId.value = null
    }
  }

  async function removeService(service: ExternalService): Promise<boolean> {
    mutating.value = true
    error.value = null
    try {
      await adminService.externalServices.deleteService(service.as_id)
      await loadServices()
      return true
    } catch (err) {
      error.value = toMessage(err)
      return false
    } finally {
      mutating.value = false
    }
  }

  return {
    services,
    healthMap,
    loading,
    error,
    serviceType,
    checkingId,
    mutating,
    loadServices,
    registerService,
    setEnabled,
    checkHealth,
    removeService
  }
}
