import { type Ref, ref } from 'vue'
import {
  adminCasService,
  type CasServiceCreateRequest,
  type CasServiceInfo,
  type CasSetAttributeRequest,
  type CasUserAttribute
} from '@/services/matrix/admin'

interface UseAdminCasResult {
  services: Ref<CasServiceInfo[]>
  servicesLoading: Ref<boolean>
  servicesError: Ref<string | null>
  creating: Ref<boolean>
  deleting: Ref<boolean>

  attributes: Ref<CasUserAttribute[]>
  attributesLoading: Ref<boolean>
  attributesSaving: Ref<boolean>
  attributesError: Ref<string | null>

  loadServices: () => Promise<void>
  createService: (data: CasServiceCreateRequest) => Promise<boolean>
  deleteService: (serviceId: string) => Promise<boolean>
  loadUserAttributes: (userId: string) => Promise<boolean>
  saveUserAttribute: (userId: string, body: CasSetAttributeRequest) => Promise<boolean>
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * CAS 服务管理 composable。
 *
 * 覆盖 ADM-05 组 c 的 5 条 CAS 管理端点：服务列表/注册/删除、用户属性读取/单属性写入。
 * 用户属性写接口一次只接受一个属性，写入成功后回读列表以保证与服务端一致。
 */
export function useAdminCas(): UseAdminCasResult {
  const services = ref<CasServiceInfo[]>([])
  const servicesLoading = ref(false)
  const servicesError = ref<string | null>(null)
  const creating = ref(false)
  const deleting = ref(false)

  const attributes = ref<CasUserAttribute[]>([])
  const attributesLoading = ref(false)
  const attributesSaving = ref(false)
  const attributesError = ref<string | null>(null)

  async function loadServices(): Promise<void> {
    servicesLoading.value = true
    servicesError.value = null
    try {
      const response = await adminCasService.listServices()
      services.value = response.services
    } catch (err) {
      services.value = []
      servicesError.value = toMessage(err)
    } finally {
      servicesLoading.value = false
    }
  }

  async function createService(data: CasServiceCreateRequest): Promise<boolean> {
    creating.value = true
    servicesError.value = null
    try {
      await adminCasService.createService(data)
      await loadServices()
      return true
    } catch (err) {
      servicesError.value = toMessage(err)
      return false
    } finally {
      creating.value = false
    }
  }

  async function deleteService(serviceId: string): Promise<boolean> {
    deleting.value = true
    servicesError.value = null
    try {
      await adminCasService.deleteService(serviceId)
      await loadServices()
      return true
    } catch (err) {
      servicesError.value = toMessage(err)
      return false
    } finally {
      deleting.value = false
    }
  }

  async function loadUserAttributes(userId: string): Promise<boolean> {
    attributesLoading.value = true
    attributesError.value = null
    attributes.value = []
    try {
      attributes.value = await adminCasService.getUserAttributes(userId)
      return true
    } catch (err) {
      attributesError.value = toMessage(err)
      return false
    } finally {
      attributesLoading.value = false
    }
  }

  async function saveUserAttribute(userId: string, body: CasSetAttributeRequest): Promise<boolean> {
    attributesSaving.value = true
    attributesError.value = null
    try {
      await adminCasService.setUserAttribute(userId, body)
      await loadUserAttributes(userId)
      return true
    } catch (err) {
      attributesError.value = toMessage(err)
      return false
    } finally {
      attributesSaving.value = false
    }
  }

  return {
    services,
    servicesLoading,
    servicesError,
    creating,
    deleting,
    attributes,
    attributesLoading,
    attributesSaving,
    attributesError,
    loadServices,
    createService,
    deleteService,
    loadUserAttributes,
    saveUserAttribute
  }
}
