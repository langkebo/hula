import { ref, type Ref } from 'vue'
import { adminService } from '@/services/matrix'

export interface UseAdminSamlResult {
  config: Ref<Record<string, unknown>>
  loading: Ref<boolean>
  saving: Ref<boolean>

  loadConfig: () => Promise<void>
  updateConfig: (updates: Record<string, unknown>) => Promise<void>
}

/**
 * Admin SAML composable.
 *
 * Wraps `adminService.getSamlConfig` + `updateSamlConfig` so desktop / mobile
 * views share the same state. Backend feature is UX-gated — views should
 * still show the "not ready" banner until synapse-rust ships it.
 */
export function useAdminSaml(): UseAdminSamlResult {
  const config = ref<Record<string, unknown>>({})
  const loading = ref(false)
  const saving = ref(false)

  async function loadConfig() {
    loading.value = true
    try {
      config.value = await adminService.getSamlConfig()
    } finally {
      loading.value = false
    }
  }

  async function updateConfig(updates: Record<string, unknown>) {
    saving.value = true
    try {
      await adminService.updateSamlConfig(updates)
      await loadConfig()
    } finally {
      saving.value = false
    }
  }

  return { config, loading, saving, loadConfig, updateConfig }
}
