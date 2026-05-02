import { type Ref, ref } from 'vue'
import { adminService } from '@/services/matrix/admin'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminSaml')

export interface UseAdminSamlResult {
  idpMetadata: Ref<Record<string, unknown>>
  spMetadata: Ref<string | null>
  loading: Ref<boolean>
  refreshing: Ref<boolean>

  loadMetadata: () => Promise<void>
  refreshMetadata: () => Promise<void>
  downloadSpMetadata: () => Promise<void>
}

/**
 * Admin SAML composable.
 *
 * Modified to focus on IdP/SP metadata + refresh functionality,
 * avoiding unimplemented legacy config endpoints.
 */
export function useAdminSaml(): UseAdminSamlResult {
  const idpMetadata = ref<Record<string, unknown>>({})
  const spMetadata = ref<string | null>(null)
  const loading = ref(false)
  const refreshing = ref(false)

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

  return {
    idpMetadata,
    spMetadata,
    loading,
    refreshing,
    loadMetadata,
    refreshMetadata,
    downloadSpMetadata
  }
}
