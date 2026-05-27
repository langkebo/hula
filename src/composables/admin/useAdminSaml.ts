import { type Ref, ref } from 'vue'
import { adminService } from '@/services/matrix/admin'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminSaml')

export interface SamlMapping {
  nameId: string
  userId?: string
  displayName?: string
  [key: string]: unknown
}

export interface UseAdminSamlResult {
  idpMetadata: Ref<Record<string, unknown>>
  spMetadata: Ref<string | null>
  samlConfig: Ref<Record<string, unknown>>
  mappings: Ref<SamlMapping[]>
  loading: Ref<boolean>
  refreshing: Ref<boolean>
  configLoading: Ref<boolean>
  configSaving: Ref<boolean>
  mappingsLoading: Ref<boolean>

  loadMetadata: () => Promise<void>
  refreshMetadata: () => Promise<void>
  downloadSpMetadata: () => Promise<void>
  loadConfig: () => Promise<void>
  saveConfig: (config: Record<string, unknown>) => Promise<void>
  loadMappings: () => Promise<void>
  deleteMapping: (nameId: string) => Promise<void>
  updateMapping: (nameId: string, updates: Record<string, unknown>) => Promise<void>
}

/**
 * Admin SAML composable.
 *
 * Provides IdP/SP metadata, SAML config CRUD, and attribute mappings management.
 */
export function useAdminSaml(): UseAdminSamlResult {
  const idpMetadata = ref<Record<string, unknown>>({})
  const spMetadata = ref<string | null>(null)
  const samlConfig = ref<Record<string, unknown>>({})
  const mappings = ref<SamlMapping[]>([])
  const loading = ref(false)
  const refreshing = ref(false)
  const configLoading = ref(false)
  const configSaving = ref(false)
  const mappingsLoading = ref(false)

  async function loadMetadata() {
    loading.value = true
    try {
      // Get IdP Metadata
      idpMetadata.value = await adminService.security.getSamlMetadata()

      // Try to get SP Metadata if needed, or just let download handle it
      const sp = await adminService.security.getSpMetadata()
      if (sp instanceof Blob) {
        spMetadata.value = await sp.text()
      } else if (typeof sp === 'string') {
        spMetadata.value = sp
      }
    } catch (e) {
      logger.error('加载 SAML 元数据失败', e)
    } finally {
      loading.value = false
    }
  }

  async function refreshMetadata() {
    refreshing.value = true
    try {
      idpMetadata.value = await adminService.security.refreshIdpMetadata()
    } finally {
      refreshing.value = false
    }
  }

  async function downloadSpMetadata() {
    try {
      const blobOrString = await adminService.security.getSpMetadata()
      let blob: Blob
      if (blobOrString instanceof Blob) {
        blob = blobOrString
      } else if (typeof blobOrString === 'string') {
        blob = new Blob([blobOrString], { type: 'application/xml' })
      } else {
        return
      }

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'saml_sp_metadata.xml'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (e) {
      logger.error('下载 SP 元数据失败', e)
    }
  }

  async function loadConfig() {
    configLoading.value = true
    try {
      samlConfig.value = await adminService.security.getSamlConfig()
    } catch (e) {
      logger.error('加载 SAML 配置失败', e)
    } finally {
      configLoading.value = false
    }
  }

  async function saveConfig(config: Record<string, unknown>) {
    configSaving.value = true
    try {
      await adminService.security.updateSamlConfig(config)
      samlConfig.value = { ...config }
    } finally {
      configSaving.value = false
    }
  }

  async function loadMappings() {
    mappingsLoading.value = true
    try {
      const result = await adminService.security.getSamlMappings()
      mappings.value = (result.mappings ?? []).map((m) => {
        const raw = m as Record<string, unknown>
        return {
          nameId: String(raw.name_id ?? raw.nameId ?? raw.nameid ?? ''),
          userId: raw.user_id != null ? String(raw.user_id) : raw.userId != null ? String(raw.userId) : undefined,
          displayName:
            raw.display_name != null
              ? String(raw.display_name)
              : raw.displayName != null
                ? String(raw.displayName)
                : undefined,
          ...raw
        } as SamlMapping
      })
    } catch (e) {
      logger.error('加载 SAML 映射失败', e)
    } finally {
      mappingsLoading.value = false
    }
  }

  async function deleteMapping(nameId: string) {
    await adminService.security.deleteSamlMapping(nameId)
    await loadMappings()
  }

  async function updateMapping(nameId: string, updates: Record<string, unknown>) {
    await adminService.security.updateSamlMapping(nameId, updates)
    await loadMappings()
  }

  return {
    idpMetadata,
    spMetadata,
    samlConfig,
    mappings,
    loading,
    refreshing,
    configLoading,
    configSaving,
    mappingsLoading,
    loadMetadata,
    refreshMetadata,
    downloadSpMetadata,
    loadConfig,
    saveConfig,
    loadMappings,
    deleteMapping,
    updateMapping
  }
}
