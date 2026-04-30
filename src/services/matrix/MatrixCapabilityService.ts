import { error, info } from '@tauri-apps/plugin-log'
import { computed } from 'vue'
import { getRuntimeAwareFetch } from '@/services/matrix/network/runtimeFetch'
import { useCapabilityStore } from '@/stores/domains/chat/capability'
import { matrixClientService } from './MatrixClientService'
import { matrixAccountService } from './user/MatrixAccountService'

/**
 * Matrix 服务端能力探测服务
 *
 * 负责应用启动或登录后，并发拉取 versions、capabilities 和 client config，
 * 并存入 capability store 供 UI 决策使用。
 */
export class MatrixCapabilityService {
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
      // 并发拉取三个核心端点
      const [versions, capabilities, clientConfig] = await Promise.all([
        this.fetchVersions(baseUrl),
        matrixAccountService.getCapabilities(),
        this.fetchClientConfig(baseUrl)
      ])

      store.setCapabilities({
        unstable_features: versions.unstable_features || {},
        capabilities: (capabilities as any)?.capabilities || {},
        client_config: clientConfig || {}
      })

      info('[CapabilityService] 服务端能力探测完成')
    } catch (err) {
      error(`[CapabilityService] 服务端能力探测部分失败: ${err}`)
      // 失败时不中断流程，保持乐观默认或上次状态
    }
  }

  private async fetchVersions(baseUrl: string): Promise<any> {
    try {
      const url = `${baseUrl}/_matrix/client/versions`
      const response = await getRuntimeAwareFetch()(url)
      if (!response.ok) return {}
      return await response.json()
    } catch {
      return {}
    }
  }

  private async fetchClientConfig(baseUrl: string): Promise<any> {
    try {
      const url = `${baseUrl}/_matrix/client/v1/config/client`
      const response = await getRuntimeAwareFetch()(url)
      if (!response.ok) return {}
      return await response.json()
    } catch {
      return {}
    }
  }
}

export const matrixCapabilityService = new MatrixCapabilityService()

/**
 * Composable: 统一的服务器特性检查
 */
export function useServerCapability() {
  const store = useCapabilityStore()

  return {
    isLoaded: computed(() => store.isLoaded),
    hasUnstable: (flag: string) => store.hasUnstable(flag).value,
    hasFeature: (feature: string) => store.hasFeature(feature).value,

    // 快捷常用特性检查
    canSetAvatar: computed(() => store.hasFeature('m.set_avatar_url').value),
    hasVoip: computed(() => store.hasFeature('m.voip').value),
    hasSpaces: computed(() => store.hasFeature('m.spaces').value),
    hasThreads: computed(() => store.hasUnstable('org.matrix.msc3026').value)
  }
}
