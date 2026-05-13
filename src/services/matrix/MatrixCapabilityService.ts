import { error, info } from '@tauri-apps/plugin-log'
import { computed } from 'vue'
import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
import { getRuntimeAwareFetch } from '@/services/matrix/network/runtimeFetch'
import type { MatrixCapabilities } from '@/stores/domains/chat/capability'
import { useCapabilityStore } from '@/stores/domains/chat/capability'
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
 * Matrix 服务端能力探测服务
 *
 * 负责应用启动或登录后，并发拉取 versions、capabilities 和 client config，
 * 并存入 capability store 供 UI 决策使用。
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

export class MatrixCapabilityService {
  private capabilityMap: Record<HulaCapability, string> = {
    'sliding-sync': 'org.matrix.msc3575',
    e2ee: 'm.e2ee',
    voip: 'm.voip',
    'friend-list': 'io.hula.friends',
    'admin-api': 'io.hula.admin'
  }

  hasCapability(capability: HulaCapability): boolean {
    const store = useCapabilityStore()
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
    return this.hasCapability('sliding-sync')
  }

  canUseE2EE(): boolean {
    return this.hasCapability('e2ee')
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
   * 刷新并加载服务端能力
   */
  async refreshCapabilities(): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      error('[CapabilityService] 客户端未初始化，跳过能力探测')
      return
    }

    const store = useCapabilityStore()
    const baseUrl = client.getHomeserverUrl()

    info(`[CapabilityService] 开始探测服务端能力: ${baseUrl}`)

    try {
      const [versionsResult, capabilitiesResult, clientConfigResult] = await Promise.allSettled([
        this.fetchVersions(baseUrl),
        matrixAccountService.getCapabilities() as Promise<MatrixCapabilitiesResponse>,
        this.fetchClientConfig(baseUrl)
      ])

      const versions = versionsResult.status === 'fulfilled' ? versionsResult.value : { unstable_features: {} }
      const capabilities = capabilitiesResult.status === 'fulfilled' ? capabilitiesResult.value : { capabilities: {} }
      const clientConfig = clientConfigResult.status === 'fulfilled' ? clientConfigResult.value : null

      store.setCapabilities({
        unstable_features: versions.unstable_features || {},
        capabilities: capabilities.capabilities || {},
        client_config: clientConfig || {}
      })

      info('[CapabilityService] 服务端能力探测完成')
    } catch (err) {
      error(`[CapabilityService] 服务端能力探测部分失败: ${err}`)
      // 失败时不中断流程，保持乐观默认或上次状态
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
 * Composable: 统一的服务器特性检查
 */
export function useServerCapability() {
  const store = useCapabilityStore()
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
