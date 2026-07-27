import { type Ref, ref } from 'vue'
import { adminService } from '@/services/matrix/admin'

export interface AppServiceInfo {
  id: string
  url?: string
  asToken?: string
  hsToken?: string
  senderLocalpart?: string
  rateLimited?: boolean
  enabled?: boolean
  [key: string]: unknown
}

interface AppServiceDetail {
  id: string
  url?: string
  asToken?: string
  hsToken?: string
  senderLocalpart?: string
  rateLimited?: boolean
  enabled?: boolean
  namespaces?: {
    users?: Array<Record<string, unknown>>
    rooms?: Array<Record<string, unknown>>
    aliases?: Array<Record<string, unknown>>
  }
  [key: string]: unknown
}

interface UseAdminAppServicesResult {
  services: Ref<AppServiceInfo[]>
  servicesLoading: Ref<boolean>
  selectedService: Ref<AppServiceDetail | null>
  detailLoading: Ref<boolean>
  pingResult: Ref<{ ok: boolean; durationMs?: number } | null>
  pingLoading: Ref<boolean>

  loadServices: () => Promise<void>
  selectService: (serviceId: string) => Promise<void>
  pingService: (serviceId: string) => Promise<void>
  deleteService: (serviceId: string) => Promise<boolean>
  updateService: (serviceId: string, config: Record<string, unknown>) => Promise<boolean>
  clearSelection: () => void
}

export function useAdminAppServices(): UseAdminAppServicesResult {
  const services = ref<AppServiceInfo[]>([])
  const servicesLoading = ref(false)

  const selectedService = ref<AppServiceDetail | null>(null)
  const detailLoading = ref(false)
  const pingResult = ref<{ ok: boolean; durationMs?: number } | null>(null)
  const pingLoading = ref(false)

  async function loadServices() {
    servicesLoading.value = true
    try {
      const result = await adminService.getApplicationServices()
      services.value = (result.services ?? []).map((s) => {
        const raw = s as Record<string, unknown>
        return {
          id: (raw.id as string) ?? (raw.as_id as string) ?? '',
          url: raw.url as string | undefined,
          asToken: raw.as_token as string | undefined,
          hsToken: raw.hs_token as string | undefined,
          senderLocalpart: raw.sender_localpart as string | undefined,
          rateLimited: raw.rate_limited as boolean | undefined,
          enabled: raw.enabled as boolean | undefined,
          ...raw
        }
      })
    } finally {
      servicesLoading.value = false
    }
  }

  async function selectService(serviceId: string) {
    detailLoading.value = true
    try {
      const detail = await adminService.getApplicationService(serviceId)
      selectedService.value = detail as AppServiceDetail | null
    } finally {
      detailLoading.value = false
    }
  }

  async function pingService(serviceId: string) {
    pingLoading.value = true
    try {
      pingResult.value = await adminService.pingApplicationService(serviceId)
    } finally {
      pingLoading.value = false
    }
  }

  async function deleteService(serviceId: string): Promise<boolean> {
    await adminService.deleteApplicationService(serviceId)
    await loadServices()
    if (selectedService.value?.id === serviceId) {
      clearSelection()
    }
    return true
  }

  async function updateService(serviceId: string, config: Record<string, unknown>): Promise<boolean> {
    await adminService.updateApplicationService(serviceId, config)
    await loadServices()
    if (selectedService.value?.id === serviceId) {
      await selectService(serviceId)
    }
    return true
  }

  function clearSelection() {
    selectedService.value = null
    pingResult.value = null
  }

  return {
    services,
    servicesLoading,
    selectedService,
    detailLoading,
    pingResult,
    pingLoading,
    loadServices,
    selectService,
    pingService,
    deleteService,
    updateService,
    clearSelection
  }
}
