import { computed, type Ref, ref } from 'vue'
import { type AdminModuleItem, adminModuleService } from '@/services/matrix/admin'

export type { AdminModuleItem, AdminModuleStatus } from '@/services/matrix/admin'

interface UseAdminModulesResult {
  modules: Ref<AdminModuleItem[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  hasMore: Ref<boolean>

  loadModules: (options?: { append?: boolean }) => Promise<void>
  loadMore: () => Promise<void>
}

/**
 * Admin module-list composable.
 *
 * Owns the three render states (loading / empty / error) for the module
 * management page and consumes the SDK `AdminManager.listModules` cursor
 * pagination via `adminModuleService`.
 */
export function useAdminModules(): UseAdminModulesResult {
  const modules = ref<AdminModuleItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const nextBatch = ref<string | null>(null)

  const hasMore = computed(() => Boolean(nextBatch.value))

  async function loadModules(options: { append?: boolean } = {}) {
    const append = options.append === true
    loading.value = true
    error.value = null
    try {
      const result = await adminModuleService.listModules(append && nextBatch.value ? { from: nextBatch.value } : {})
      modules.value = append ? [...modules.value, ...result.modules] : result.modules
      nextBatch.value = result.nextBatch
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      if (!append) {
        modules.value = []
      }
      nextBatch.value = null
    } finally {
      loading.value = false
    }
  }

  async function loadMore() {
    if (!hasMore.value || loading.value) return
    await loadModules({ append: true })
  }

  return { modules, loading, error, hasMore, loadModules, loadMore }
}
