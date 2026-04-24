import { ref, type Ref } from 'vue'
import { adminService } from '@/services/matrix'

export interface UseAdminMaintenanceResult {
  backups: Ref<Array<Record<string, unknown>>>
  experimentalFeatures: Ref<Record<string, unknown>>
  mediaStats: Ref<Record<string, unknown> | null>
  loading: Ref<boolean>
  purging: Ref<boolean>
  featureMutating: Ref<boolean>

  loadBackups: () => Promise<void>
  loadExperimentalFeatures: () => Promise<void>
  loadMediaStats: () => Promise<void>
  loadAll: () => Promise<void>
  purgeMediaCache: (beforeTs?: number) => Promise<{ deleted: number }>
  setExperimentalFeature: (feature: string, enabled: boolean) => Promise<void>
}

/**
 * Admin maintenance composable.
 *
 * Owns state + orchestration for the Phase E maintenance surface (backups,
 * media cache purge, experimental feature flags, media stats). Views are
 * render-only and delegate mutation orchestration here so desktop and mobile
 * share the same behavior.
 */
export function useAdminMaintenance(): UseAdminMaintenanceResult {
  const backups = ref<Array<Record<string, unknown>>>([])
  const experimentalFeatures = ref<Record<string, unknown>>({})
  const mediaStats = ref<Record<string, unknown> | null>(null)
  const loading = ref(false)
  const purging = ref(false)
  const featureMutating = ref(false)

  async function loadBackups() {
    backups.value = await adminService.getBackups()
  }

  async function loadExperimentalFeatures() {
    experimentalFeatures.value = await adminService.getExperimentalFeatures()
  }

  async function loadMediaStats() {
    mediaStats.value = await adminService.getMediaStats()
  }

  async function loadAll() {
    loading.value = true
    try {
      await Promise.all([loadBackups(), loadExperimentalFeatures(), loadMediaStats()])
    } finally {
      loading.value = false
    }
  }

  async function purgeMediaCache(beforeTs?: number) {
    purging.value = true
    try {
      const result = await adminService.purgeMediaCache(beforeTs)
      await loadMediaStats()
      return result
    } finally {
      purging.value = false
    }
  }

  async function setExperimentalFeature(feature: string, enabled: boolean) {
    featureMutating.value = true
    try {
      await adminService.setExperimentalFeature(feature, enabled)
      await loadExperimentalFeatures()
    } finally {
      featureMutating.value = false
    }
  }

  return {
    backups,
    experimentalFeatures,
    mediaStats,
    loading,
    purging,
    featureMutating,
    loadBackups,
    loadExperimentalFeatures,
    loadMediaStats,
    loadAll,
    purgeMediaCache,
    setExperimentalFeature
  }
}
