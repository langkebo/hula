import { type Ref, ref } from 'vue'
import { adminService } from '@/services/matrix/admin'

export interface AdminFeatureFlagTarget {
  subjectType: string
  subjectId: string
}

export interface AdminFeatureFlag {
  flagKey: string
  enabled: boolean
  status: string
  description: string
  targetScope: string
  rolloutPercent: number
  expiresAt: number | null
  reason: string
  createdBy: string
  createdTs: number
  updatedTs: number
  targets: AdminFeatureFlagTarget[]
}

export interface AdminFeatureFlagInput {
  flagKey: string
  targetScope: string
  rolloutPercent: number
  expiresAt?: number | null
  reason?: string
  targets?: AdminFeatureFlagTarget[]
}

export interface UseAdminMaintenanceResult {
  backups: Ref<Array<Record<string, unknown>>>
  experimentalFeatures: Ref<Record<string, unknown>>
  featureFlags: Ref<AdminFeatureFlag[]>
  mediaStats: Ref<Record<string, unknown> | null>
  loading: Ref<boolean>
  purging: Ref<boolean>
  featureMutating: Ref<boolean>
  featureSaving: Ref<boolean>
  featureDeleting: Ref<boolean>

  loadBackups: () => Promise<void>
  loadExperimentalFeatures: () => Promise<void>
  loadFeatureFlags: () => Promise<void>
  loadMediaStats: () => Promise<void>
  loadAll: () => Promise<void>
  purgeMediaCache: (beforeTs?: number) => Promise<{ deleted: number }>
  setExperimentalFeature: (feature: string, enabled: boolean) => Promise<void>
  getFeatureFlagDetail: (flagKey: string) => Promise<AdminFeatureFlag | null>
  saveFeatureFlag: (input: AdminFeatureFlagInput) => Promise<AdminFeatureFlag>
  deleteFeatureFlag: (flagKey: string) => Promise<void>
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
  const featureFlags = ref<AdminFeatureFlag[]>([])
  const mediaStats = ref<Record<string, unknown> | null>(null)
  const loading = ref(false)
  const purging = ref(false)
  const featureMutating = ref(false)
  const featureSaving = ref(false)
  const featureDeleting = ref(false)

  async function loadBackups() {
    backups.value = await adminService.getBackups()
  }

  async function loadExperimentalFeatures() {
    const flags = (await adminService.listFeatureFlagsDetailed()) as AdminFeatureFlag[]
    featureFlags.value = flags
    experimentalFeatures.value = Object.fromEntries(
      flags.map((flag) => [
        flag.flagKey,
        {
          enabled: flag.enabled,
          status: flag.status,
          description: flag.description,
          targetScope: flag.targetScope,
          rolloutPercent: flag.rolloutPercent,
          reason: flag.reason,
          expiresAt: flag.expiresAt,
          updatedTs: flag.updatedTs,
          createdTs: flag.createdTs,
          targets: flag.targets
        }
      ])
    )
  }

  async function loadFeatureFlags() {
    await loadExperimentalFeatures()
  }

  async function loadMediaStats() {
    mediaStats.value = await adminService.getMediaStats()
  }

  async function loadAll() {
    loading.value = true
    try {
      await Promise.allSettled([loadBackups(), loadExperimentalFeatures(), loadMediaStats()])
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

  async function getFeatureFlagDetail(flagKey: string) {
    return (await adminService.getFeatureFlagDetail(flagKey)) as AdminFeatureFlag | null
  }

  async function saveFeatureFlag(input: AdminFeatureFlagInput) {
    featureSaving.value = true
    try {
      const result = (await adminService.saveFeatureFlag(input)) as AdminFeatureFlag
      await loadExperimentalFeatures()
      return result
    } finally {
      featureSaving.value = false
    }
  }

  async function deleteFeatureFlag(flagKey: string) {
    featureDeleting.value = true
    try {
      await adminService.deleteFeatureFlag(flagKey)
      await loadExperimentalFeatures()
    } finally {
      featureDeleting.value = false
    }
  }

  return {
    backups,
    experimentalFeatures,
    featureFlags,
    mediaStats,
    loading,
    purging,
    featureMutating,
    featureSaving,
    featureDeleting,
    loadBackups,
    loadExperimentalFeatures,
    loadFeatureFlags,
    loadMediaStats,
    loadAll,
    purgeMediaCache,
    setExperimentalFeature,
    getFeatureFlagDetail,
    saveFeatureFlag,
    deleteFeatureFlag
  }
}
