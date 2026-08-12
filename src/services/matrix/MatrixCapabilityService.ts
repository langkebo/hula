import { computed } from 'vue'
import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
import { getRuntimeAwareFetch } from '@/services/matrix/network/runtimeFetch'
import type { MatrixCapabilities } from '@/types/message'
import { SingleFlight } from '@/utils/ExecutionGuard'
import { createLogger } from '@/utils/Logger'
import { matrixClientService } from './MatrixClientService'
import { MATRIX_PATHS } from './paths'
import { matrixAccountService } from './user/MatrixAccountService'

const logger = createLogger('MatrixCapabilityService')

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
export type TjgCapability =
  | 'sliding-sync'
  | 'e2ee'
  | 'voip'
  | 'friend-list'
  | 'admin-api'
  | 'burn-after-read'
  | 'openclaw'
  | 'ai-connection'

const HULA_CAPABILITY_ALIASES: Record<TjgCapability, { unstable: string[]; capabilities: string[] }> = {
  'sliding-sync': {
    unstable: ['org.matrix.msc3886.sliding_sync', 'org.matrix.msc3575', 'org.matrix.simplified_msc3575'],
    capabilities: ['io.hula.sliding_sync']
  },
  e2ee: {
    unstable: ['org.matrix.msc3814'],
    capabilities: ['m.room.encryption']
  },
  voip: {
    unstable: ['org.matrix.msc3245'],
    capabilities: ['m.voice', 'm.voip', 'io.hula.voice_extended']
  },
  'friend-list': {
    unstable: ['io.hula.friends'],
    capabilities: ['io.hula.friends']
  },
  'admin-api': {
    unstable: ['io.hula.admin'],
    capabilities: ['io.hula.admin']
  },
  'burn-after-read': {
    unstable: ['io.hula.burn_after_read'],
    capabilities: ['io.hula.burn_after_read']
  },
  openclaw: {
    unstable: ['openclaw'],
    capabilities: ['openclaw']
  },
  'ai-connection': {
    unstable: ['ai_connection'],
    capabilities: ['ai_connection']
  }
}

const THREAD_UNSTABLE_FEATURES = ['org.matrix.msc3983', 'org.matrix.msc3983.thread', 'org.matrix.msc3026']

function mergeUnstableFeatures(...sources: Array<Record<string, boolean> | undefined>): Record<string, boolean> {
  const merged: Record<string, boolean> = {}
  for (const source of sources) {
    if (!source) continue
    for (const [key, enabled] of Object.entries(source)) {
      merged[key] = merged[key] === true || enabled === true
    }
  }
  return merged
}

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

function tryGetStore() {
  try {
    return getCapabilityStore()
  } catch (err) {
    // R-16: log silent catch in tryGetStore
    logger.warn('tryGetStore failed:', err)
    return null
  }
}

class MatrixCapabilityService {
  // SingleFlight：并发调用 fetchCapabilities 时复用同一 Promise，
  // 避免重复发起 /versions + /capabilities + /client_config 共 3 个 HTTP 请求。
  // 场景：settlePostLoginStartup 的 finally 中 await refreshCapabilities()
  // 与 startClient store 方法中 fire-and-forget refreshCapabilities() 并发触发。
  private capabilityFlight = new SingleFlight<MatrixCapabilities | null>()

  hasCapability(capability: TjgCapability): boolean {
    const store = tryGetStore()
    if (!store) return false
    const aliases = HULA_CAPABILITY_ALIASES[capability]
    return (
      aliases.unstable.some((feature) => store.hasUnstable(feature).value) ||
      aliases.capabilities.some((feature) => store.hasFeature(feature).value)
    )
  }

  canUseAdminApi(): boolean {
    return this.hasCapability('admin-api')
  }

  canUseFriendList(): boolean {
    return this.hasCapability('friend-list')
  }

  canUseSlidingSync(): boolean {
    return this.hasCapability('sliding-sync')
  }

  canUseE2EE(): boolean {
    const store = tryGetStore()
    if (!store) return false
    const encryptionCapability = store.capabilities['m.room.encryption'] as { enabled?: boolean } | undefined
    if (encryptionCapability?.enabled === false) {
      return false
    }
    return true
  }

  canUseVoip(): boolean {
    return this.hasCapability('voip')
  }

  /** FT-099: 阅后即焚扩展能力检测 */
  canUseBurnAfterRead(): boolean {
    return this.hasCapability('burn-after-read')
  }

  /** FT-099: OpenClaw 路由扩展能力检测 */
  canUseOpenClaw(): boolean {
    return this.hasCapability('openclaw')
  }

  /** FT-099: AI 连接扩展能力检测 */
  canUseAiConnection(): boolean {
    return this.hasCapability('ai-connection')
  }

  canUseThreads(): boolean {
    const store = tryGetStore()
    if (!store) return false
    return (
      THREAD_UNSTABLE_FEATURES.some((feature) => store.hasUnstable(feature).value) || store.hasFeature('m.thread').value
    )
  }

  requireCapability(capability: TjgCapability): void {
    if (!this.hasCapability(capability)) {
      throw new CapabilityUnavailableError(capability)
    }
  }

  /**
   * Fetch server capabilities without writing to any store.
   * The caller is responsible for persisting the result.
   *
   * SingleFlight：并发调用时复用同一 Promise，只发一次 /versions + /capabilities + /client_config。
   */
  async fetchCapabilities(): Promise<MatrixCapabilities | null> {
    const client = matrixClientService.getClient()
    if (!client) {
      logger.error('[CapabilityService] Client not initialized, skipping capability detection')
      return null
    }

    const baseUrl = client.getHomeserverUrl()
    logger.info(`[CapabilityService] Detecting server capabilities: ${baseUrl}`)

    return this.capabilityFlight.run(async () => {
      try {
        const [versionsResult, capabilitiesResult, clientConfigResult] = await Promise.allSettled([
          this.fetchVersions(baseUrl),
          matrixAccountService.getCapabilities() as Promise<MatrixCapabilitiesResponse>,
          this.fetchClientConfig(baseUrl)
        ])

        const versions = versionsResult.status === 'fulfilled' ? versionsResult.value : { unstable_features: {} }
        const capabilities = capabilitiesResult.status === 'fulfilled' ? capabilitiesResult.value : { capabilities: {} }
        const clientConfig = clientConfigResult.status === 'fulfilled' ? clientConfigResult.value : null

        // 合并 versions 和 capabilities 两个来源的 unstable_features
        const capabilitiesUnstable = (capabilities as Record<string, unknown>).unstable_features as
          | Record<string, boolean>
          | undefined
        const mergedUnstableFeatures = mergeUnstableFeatures(capabilitiesUnstable, versions.unstable_features)

        const result: MatrixCapabilities = {
          unstable_features: mergedUnstableFeatures,
          capabilities: capabilities.capabilities || {},
          client_config: clientConfig || {}
        }

        logger.info('[CapabilityService] Server capability detection complete')
        return result
      } catch (err) {
        logger.error(`[CapabilityService] Server capability detection partially failed: ${err}`)
        return null
      }
    })
  }

  /**
   * @deprecated Use fetchCapabilities() + store.setCapabilities() instead.
   * Kept for backward compatibility during migration.
   *
   * 错误兜底：即使 fetchCapabilities 返回 null（client 未就绪、网络异常等），
   * 也必须 setCapabilities(空对象) 将 isLoaded 置 true。
   * 否则 FriendListView 的 isCapabilityLoading = !isLoaded 会永久为 true，
   * 导致 n-spin 无限转圈（即便好友数据已成功返回 0 条）。
   */
  async refreshCapabilities(): Promise<void> {
    const data = await this.fetchCapabilities()
    // data 为 null 时用空对象兜底，确保 isLoaded=true，UI 不再无限转圈
    getCapabilityStore().setCapabilities(
      data ?? {
        unstable_features: {},
        capabilities: {},
        client_config: {}
      }
    )
  }

  private async fetchVersions(baseUrl: string): Promise<MatrixVersionsResponse> {
    if (matrixWorkerHost.isStarted) {
      try {
        const data = await matrixWorkerHost.getServerVersions(baseUrl)
        return { unstable_features: data.unstable_features }
      } catch (err) {
        // FT-131-B: 记录 versions 拉取失败，避免静默吞错导致能力检测异常无法排查
        logger.warn(`[CapabilityService] fetchVersions (worker) failed: ${err}`)
        return {}
      }
    }
    try {
      const url = `${baseUrl}/_matrix/client/versions`
      const response = await getRuntimeAwareFetch()(url)
      if (!response.ok) {
        // FT-131-B: HTTP 非 2xx 也需记录，避免静默降级掩盖服务端错误
        logger.warn(`[CapabilityService] fetchVersions got HTTP ${response.status}`)
        return {}
      }
      return (await response.json()) as MatrixVersionsResponse
    } catch (err) {
      // FT-131-B: 记录 versions 拉取失败，避免静默吞错导致能力检测异常无法排查
      logger.warn(`[CapabilityService] fetchVersions failed: ${err}`)
      return {}
    }
  }

  private async fetchClientConfig(baseUrl: string): Promise<MatrixCapabilities['client_config']> {
    try {
      const url = `${baseUrl}${MATRIX_PATHS.CLIENT_CONFIG.CLIENT}`
      const response = await getRuntimeAwareFetch()(url)
      if (!response.ok) {
        // FT-131-B: HTTP 非 2xx 也需记录，避免静默降级掩盖服务端错误
        logger.warn(`[CapabilityService] fetchClientConfig got HTTP ${response.status}`)
        return {} as MatrixCapabilities['client_config']
      }
      return (await response.json()) as MatrixCapabilities['client_config']
    } catch (err) {
      // FT-131-B: 记录 client_config 拉取失败，避免静默吞错导致能力检测异常无法排查
      logger.warn(`[CapabilityService] fetchClientConfig failed: ${err}`)
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
  const service = matrixCapabilityService

  return {
    isLoaded: computed(() => tryGetStore()?.isLoaded ?? false),
    hasUnstable: (flag: string) => tryGetStore()?.hasUnstable(flag).value ?? false,
    hasFeature: (feature: string) => tryGetStore()?.hasFeature(feature).value ?? false,

    canSetAvatar: computed(() => tryGetStore()?.hasFeature('m.set_avatar_url').value ?? false),
    hasVoip: computed(() => service.canUseVoip()),
    hasSpaces: computed(() => tryGetStore()?.hasFeature('m.spaces').value ?? false),
    hasThreads: computed(() => service.canUseThreads()),

    canUseAdminApi: computed(() => service.canUseAdminApi()),
    canUseFriendList: computed(() => service.canUseFriendList()),
    canUseSlidingSync: computed(() => service.canUseSlidingSync()),
    canUseE2EE: computed(() => service.canUseE2EE()),
    canUseVoip: computed(() => service.canUseVoip()),
    canUseBurnAfterRead: computed(() => service.canUseBurnAfterRead()),
    canUseOpenclaw: computed(() => service.canUseOpenClaw()),
    canUseAiConnection: computed(() => service.canUseAiConnection())
  }
}
