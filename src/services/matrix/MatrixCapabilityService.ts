import { computed } from 'vue'
import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
import { getRuntimeAwareFetch } from '@/services/matrix/network/runtimeFetch'
import type { MatrixCapabilities } from '@/types/message'
import { SingleFlight } from '@/utils/ExecutionGuard'
import { createLogger } from '@/utils/Logger'
import { matrixEncryptionContextService } from './crypto/MatrixEncryptionContextService'
import { matrixClientService } from './MatrixClientService'
import { MATRIX_PATHS } from './paths'
import { matrixAccountService } from './user/MatrixAccountService'

const logger = createLogger('MatrixCapabilityService')

type MatrixVersionsResponse = {
  unstable_features?: Record<string, boolean> | undefined
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
  | 'dehydrated-device'
  | 'sticky-events'
  | 'scheduled-send'
  | 'rtc-transports'
  | 'account-status'
  | 'extended-profile'
  | 'qr-rendezvous'
  | 'mutual-rooms'

/**
 * 能力三态判定结果。
 * - `supported`：服务端显式声明支持
 * - `unsupported`：能力快照已加载，但服务端未声明该能力
 * - `unknown`：能力快照尚未加载（登录前 / 探测失败），调用方按 unsupported 处理
 */
export type CapabilityStatus = 'supported' | 'unsupported' | 'unknown'

/**
 * 能力位与服务端 key 的映射。
 *
 * 说明（R1）：SDK 的 `SynapseRustFeature` 常量位于 `lib/server-capabilities`，
 * 未通过 matrix-js-sdk 的 package exports 暴露，无法直接派生；此处按服务端
 * 实际声明补齐，并与 SDK `SYNAPSE_RUST_FEATURE_FALLBACK` 的兼容 key 保持一致。
 */
const HULA_CAPABILITY_ALIASES: Record<TjgCapability, { unstable: string[]; capabilities: string[] }> = {
  'sliding-sync': {
    unstable: ['org.matrix.msc3886.sliding_sync', 'org.matrix.msc3575', 'org.matrix.simplified_msc3575'],
    capabilities: ['io.hula.sliding_sync']
  },
  // E2EE 属客户端能力：服务端 /capabilities 与 /versions 都不宣告，
  // 由客户端 crypto 初始化状态判定（见 canUseE2EE），因此两个来源均为空。
  e2ee: {
    unstable: [],
    capabilities: []
  },
  voip: {
    unstable: ['org.matrix.msc3245.voice', 'org.matrix.msc3245'],
    capabilities: ['m.voice', 'm.voip', 'io.hula.voice_extended']
  },
  'friend-list': {
    unstable: ['io.hula.friends'],
    capabilities: ['io.hula.friends']
  },
  // 后台管理权限由 /_synapse/admin/* 的 is_admin 校验，不经 capabilities 面宣告；
  // 能力位只表示"本客户端暴露 admin 入口"，由桌面端 admin 桥接层注册的
  // 可用性判定提供（首次请求 403 即降级为 false）。
  'admin-api': {
    unstable: [],
    capabilities: []
  },
  'burn-after-read': {
    unstable: ['io.hula.burn_after_read'],
    capabilities: ['io.hula.burn_after_read']
  },
  'dehydrated-device': {
    unstable: ['org.matrix.msc3814'],
    capabilities: []
  },
  'sticky-events': {
    unstable: ['org.matrix.msc4354'],
    capabilities: []
  },
  'scheduled-send': {
    unstable: ['org.matrix.msc4140'],
    capabilities: []
  },
  'rtc-transports': {
    unstable: ['org.matrix.msc4143'],
    capabilities: []
  },
  'account-status': {
    unstable: [],
    capabilities: ['org.matrix.msc3720.account_status']
  },
  'extended-profile': {
    unstable: ['uk.tcpip.msc4133'],
    capabilities: ['m.profile_fields']
  },
  'qr-rendezvous': {
    unstable: ['org.matrix.msc4108'],
    capabilities: []
  },
  'mutual-rooms': {
    // MSC2666 自提交起就带 `uk.half-shot.` 前缀，稳定形态是
    // `uk.half-shot.msc2666.query_mutual_rooms`（与
    // `GET /_matrix/client/unstable/uk.half-shot.msc2666/user/mutual_rooms` 绑定）。
    // 曾经这里写的 `org.matrix.msc2666` 不存在于任何 homeserver 的 /versions 里，
    // 导致该能力位永远 unsupported。也不能退到短名 `uk.half-shot.msc2666`：
    // matrix-js-sdk 见短名会走本仓不服务的 `/user/shared_rooms/{userId}`。
    unstable: ['uk.half-shot.msc2666.query_mutual_rooms'],
    capabilities: []
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

/** admin-api 可用性判定（由桌面端 admin 桥接层在路由注册期注入）。 */
let _adminApiAvailabilityResolver: (() => boolean) | null = null

/**
 * 注册 admin-api 可用性判定器。桌面端 admin 桥接层在路由注册期调用；
 * 移动端不注册，能力位恒为不可用，避免 admin 代码进入移动端产物。
 */
export function registerAdminApiAvailabilityResolver(resolver: (() => boolean) | null): void {
  _adminApiAvailabilityResolver = resolver
}

class MatrixCapabilityService {
  // SingleFlight：并发调用 fetchCapabilities 时复用同一 Promise，
  // 避免重复发起 /versions + /capabilities + /client_config 共 3 个 HTTP 请求。
  // 场景：settlePostLoginStartup 的 finally 中 await refreshCapabilities()
  // 与 startClient store 方法中 fire-and-forget refreshCapabilities() 并发触发。
  private capabilityFlight = new SingleFlight<MatrixCapabilities | null>()

  /**
   * 能力三态判定（唯一判定实现）。
   * 能力快照未加载时返回 `unknown`；调用方按 `unsupported` 处理，不渲染入口。
   */
  getCapabilityStatus(capability: TjgCapability): CapabilityStatus {
    // 这两个能力位不由服务端宣告，改由客户端状态判定，不能走别名表。
    if (capability === 'e2ee') return this.canUseE2EE() ? 'supported' : 'unsupported'
    if (capability === 'admin-api') return this.canUseAdminApi() ? 'supported' : 'unsupported'
    const store = tryGetStore()
    if (!store?.isLoaded) return 'unknown'
    const aliases = HULA_CAPABILITY_ALIASES[capability]
    const supported =
      aliases.unstable.some((feature) => store.hasUnstable(feature).value) ||
      aliases.capabilities.some((feature) => store.hasFeature(feature).value)
    return supported ? 'supported' : 'unsupported'
  }

  hasCapability(capability: TjgCapability): boolean {
    return this.getCapabilityStatus(capability) === 'supported'
  }

  /** 诊断用：返回能力位对应的服务端宣告 key，便于在界面上展示「为什么不可用」 */
  getCapabilityAliases(capability: TjgCapability): { unstable: string[]; capabilities: string[] } {
    const aliases = HULA_CAPABILITY_ALIASES[capability]
    return { unstable: [...aliases.unstable], capabilities: [...aliases.capabilities] }
  }

  /** admin 入口可用性：桌面端读后台权限探测结果，移动端恒不可用 */
  canUseAdminApi(): boolean {
    return _adminApiAvailabilityResolver?.() ?? false
  }

  canUseFriendList(): boolean {
    return this.hasCapability('friend-list')
  }

  canUseSlidingSync(): boolean {
    return this.hasCapability('sliding-sync')
  }

  /** E2EE 可用性：服务端不宣告，按客户端 crypto 是否初始化判定 */
  canUseE2EE(): boolean {
    return matrixEncryptionContextService.getCurrentSessionContext().isCryptoEnabled
  }

  canUseVoip(): boolean {
    return this.hasCapability('voip')
  }

  /** 检测是否支持阅后即焚能力
   */
  canUseBurnAfterRead(): boolean {
    return this.hasCapability('burn-after-read')
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

  /**
   * 能力 id → 判定函数（唯一实现）。
   * 桌面设置页与移动设置页共用，避免两端各维护一份映射后判定口径分叉。
   */
  const capabilityCheckers: Record<TjgCapability, () => boolean> = {
    'sliding-sync': () => service.canUseSlidingSync(),
    e2ee: () => service.canUseE2EE(),
    voip: () => service.canUseVoip(),
    'friend-list': () => service.canUseFriendList(),
    'admin-api': () => service.canUseAdminApi(),
    'burn-after-read': () => service.canUseBurnAfterRead(),
    'dehydrated-device': () => service.hasCapability('dehydrated-device'),
    'sticky-events': () => service.hasCapability('sticky-events'),
    'scheduled-send': () => service.hasCapability('scheduled-send'),
    'rtc-transports': () => service.hasCapability('rtc-transports'),
    'account-status': () => service.hasCapability('account-status'),
    'extended-profile': () => service.hasCapability('extended-profile'),
    'qr-rendezvous': () => service.hasCapability('qr-rendezvous'),
    'mutual-rooms': () => service.hasCapability('mutual-rooms')
  }

  const isCapabilityAvailable = (capability: TjgCapability): boolean => capabilityCheckers[capability]()

  /** 三态判定：供需要区分「未知」与「不支持」的展示层使用 */
  const getCapabilityStatus = (capability: TjgCapability): CapabilityStatus => service.getCapabilityStatus(capability)

  return {
    isLoaded: computed(() => tryGetStore()?.isLoaded ?? false),
    isCapabilityAvailable,
    getCapabilityStatus,
    getCapabilityAliases: (capability: TjgCapability) => service.getCapabilityAliases(capability),
    /** 全量重拉能力快照，供诊断面板的「重试」入口使用 */
    refreshCapabilities: () => service.refreshCapabilities(),
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
    canUseBurnAfterRead: computed(() => service.canUseBurnAfterRead())
  }
}
