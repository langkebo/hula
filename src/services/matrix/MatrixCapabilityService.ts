import { error, info } from '@tauri-apps/plugin-log'
import { computed } from 'vue'
import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
import { getRuntimeAwareFetch } from '@/services/matrix/network/runtimeFetch'
import type { MatrixCapabilities } from '@/types/message'
import { matrixClientService } from './MatrixClientService'
import { MATRIX_PATHS } from './paths'
import { matrixAccountService } from './user/MatrixAccountService'

type MatrixVersionsResponse = {
  unstable_features?: Record<string, boolean>
}

type MatrixCapabilitiesResponse = {
  capabilities?: MatrixCapabilities['capabilities']
}

/**
 * Matrix server capability detection service.
 *
 * Decoupled from Pinia store to break the circular dependency:
 *   MatrixCapabilityService ↔ capability store ↔ matrix store
 *
 * - `fetchCapabilities()` returns data without writing to any store.
 * - Query methods access the store via a lazily-initialized getter,
 *   so the module-level import graph has no service → store edge.
 * - The `useServerCapability()` composable bridges service + store at the
 *   consumption layer (no circular import at the service definition level).
 */
export type HulaCapability = 'sliding-sync' | 'e2ee' | 'voip' | 'friend-list' | 'admin-api'

export class CapabilityUnavailableError extends Error {
  capability: string
  code = 'CAPABILITY_UNAVAILABLE'

  constructor(capability: string) {
    super(`Capability unavailable: ${capability}`)
    this.name = 'CapabilityUnavailableError'
    this.capability = capability
  }
}

/**
 * Lazy store resolver — set at application boot by registerCapabilityStore().
 * This breaks the static import cycle between service and store layers.
 */
let _capabilityStore: ReturnType<typeof import('@/stores/domains/chat/capability').useCapabilityStore> | null = null
let _storeResolver: (() => ReturnType<typeof import('@/stores/domains/chat/capability').useCapabilityStore>) | null =
  null

/**
 * Register the capability store resolver. Called once at app initialization
 * (before any capability queries) to break the circular dependency.
 */
export function registerCapabilityStoreResolver(
  resolver: () => ReturnType<typeof import('@/stores/domains/chat/capability').useCapabilityStore>
): void {
  _storeResolver = resolver
  _capabilityStore = null // Reset cache so next access uses the new resolver
}

function getCapabilityStore() {
  if (_capabilityStore) return _capabilityStore
  if (_storeResolver) {
    _capabilityStore = _storeResolver()
    return _capabilityStore
  }
  throw new Error('[CapabilityService] Store not registered. Call registerCapabilityStoreResolver() during app init.')
}

export class MatrixCapabilityService {
  private capabilityMap: Record<HulaCapability, string> = {
    'sliding-sync': 'org.matrix.msc3575',
    e2ee: 'm.e2ee',
    voip: 'm.voip',
    'friend-list': 'io.hula.friends',
    'admin-api': 'io.hula.admin'
  }

  hasCapability(capability: HulaCapability): boolean {
    const store = getCapabilityStore()
    const featureKey = this.capabilityMap[capability]
    if (!featureKey) return false
    return store.hasFeature(featureKey).value || store.hasUnstable(featureKey).value
  }

  canUseAdminApi(): boolean {
    return this.hasCapability('admin-api')
  }

  canUseFriendList(): boolean {
    return this.hasCapability('friend-list')
  }

  canUseSlidingSync(): boolean {
    const store = getCapabilityStore()
    return store.hasUnstable('org.matrix.msc3575').value || store.hasUnstable('org.matrix.simplified_msc3575').value
  }

  canUseE2EE(): boolean {
    const store = getCapabilityStore()
    const encryptionCapability = store.capabilities['m.room.encryption'] as { enabled?: boolean } | undefined
    if (encryptionCapability?.enabled === false) {
      return false
    }
    return true
  }

  canUseVoip(): boolean {
    return this.hasCapability('voip')
  }

  requireCapability(capability: HulaCapability): void {
    if (!this.hasCapability(capability)) {
      throw new CapabilityUnavailableError(capability)
    }
  }

  /**
   * Fetch server capabilities without writing to any store.
   * The caller is responsible for persisting the result.
   */
  async fetchCapabilities(): Promise<MatrixCapabilities | null> {
    const client = matrixClientService.getClient()
    if (!client) {
      error('[CapabilityService] Client not initialized, skipping capability detection')
      return null
    }

    const baseUrl = client.getHomeserverUrl()
    info(`[CapabilityService] Detecting server capabilities: ${baseUrl}`)

    try {
      const [versionsResult, capabilitiesResult, clientConfigResult] = await Promise.allSettled([
        this.fetchVersions(baseUrl),
        matrixAccountService.getCapabilities() as Promise<MatrixCapabilitiesResponse>,
        this.fetchClientConfig(baseUrl)
      ])

      const versions = versionsResult.status === 'fulfilled' ? versionsResult.value : { unstable_features: {} }
      const capabilities = capabilitiesResult.status === 'fulfilled' ? capabilitiesResult.value : { capabilities: {} }
      const clientConfig = clientConfigResult.status === 'fulfilled' ? clientConfigResult.value : null

      const result: MatrixCapabilities = {
        unstable_features: versions.unstable_features || {},
        capabilities: capabilities.capabilities || {},
        client_config: clientConfig || {}
      }

      info('[CapabilityService] Server capability detection complete')
      return result
    } catch (err) {
      error(`[CapabilityService] Server capability detection partially failed: ${err}`)
      return null
    }
  }

  /**
   * @deprecated Use fetchCapabilities() + store.setCapabilities() instead.
   * Kept for backward compatibility during migration.
   */
  async refreshCapabilities(): Promise<void> {
    const data = await this.fetchCapabilities()
    if (data) {
      getCapabilityStore().setCapabilities(data)
    }
  }

  private async fetchVersions(baseUrl: string): Promise<MatrixVersionsResponse> {
    if (matrixWorkerHost.isStarted) {
      try {
        const data = await matrixWorkerHost.getServerVersions(baseUrl)
        return { unstable_features: data.unstable_features }
      } catch {
        return {}
      }
    }
    try {
      const url = `${baseUrl}/_matrix/client/versions`
      const response = await getRuntimeAwareFetch()(url)
      if (!response.ok) return {}
      return (await response.json()) as MatrixVersionsResponse
    } catch {
      return {}
    }
  }

  private async fetchClientConfig(baseUrl: string): Promise<MatrixCapabilities['client_config']> {
    try {
      const url = `${baseUrl}${MATRIX_PATHS.CLIENT_CONFIG.CLIENT}`
      const response = await getRuntimeAwareFetch()(url)
      if (!response.ok) return {} as MatrixCapabilities['client_config']
      return (await response.json()) as MatrixCapabilities['client_config']
    } catch {
      return {} as MatrixCapabilities['client_config']
    }
  }
}

export const matrixCapabilityService = new MatrixCapabilityService()

/**
 * Composable: unified server capability checks.
 * This is the bridge layer that connects service + store at consumption time.
 */
export function useServerCapability() {
  const store = getCapabilityStore()
  const service = matrixCapabilityService

  return {
    isLoaded: computed(() => store.isLoaded),
    hasUnstable: (flag: string) => store.hasUnstable(flag).value,
    hasFeature: (feature: string) => store.hasFeature(feature).value,

    canSetAvatar: computed(() => store.hasFeature('m.set_avatar_url').value),
    hasVoip: computed(() => store.hasFeature('m.voip').value),
    hasSpaces: computed(() => store.hasFeature('m.spaces').value),
    hasThreads: computed(() => store.hasUnstable('org.matrix.msc3026').value),

    canUseAdminApi: computed(() => service.canUseAdminApi()),
    canUseFriendList: computed(() => service.canUseFriendList()),
    canUseSlidingSync: computed(() => service.canUseSlidingSync()),
    canUseE2EE: computed(() => service.canUseE2EE()),
    canUseVoip: computed(() => service.canUseVoip())
  }
}
