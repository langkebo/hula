import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { matrixClientService } from '../MatrixClientService'

const logger = createLogger('SynapseThirdpartyService')

/**
 * 第三方协议查询（/_matrix/client/v3/thirdparty/*）。
 * 从 SynapseRustExtensionsService 拆分而来。
 * 与其他扩展服务不同，本服务走 SDK client.http.authedRequest 而非裸 fetch。
 */
class SynapseThirdpartyService extends BaseMatrixService {
  async getThirdpartyProtocols(): Promise<Record<string, unknown>> {
    try {
      const client = matrixClientService.getClient()
      if (!client) return {}
      const result = await client.http.authedRequest('GET', '/thirdparty/protocols')
      return (result as Record<string, unknown>) || {}
    } catch (err) {
      logger.error(`[SynapseRust] 获取第三方协议失败: ${err}`)
      return {}
    }
  }

  async getThirdpartyLocation(
    protocol: string,
    params?: Record<string, string>
  ): Promise<Array<Record<string, unknown>>> {
    try {
      const client = matrixClientService.getClient()
      if (!client) return []
      const result = await client.http.authedRequest(
        'GET',
        `/thirdparty/location/${encodeURIComponent(protocol)}`,
        params
      )
      return (result as Array<Record<string, unknown>>) || []
    } catch (err) {
      logger.error(`[SynapseRust] 获取第三方位置失败: ${err}`)
      return []
    }
  }

  async getThirdpartyUser(protocol: string, params?: Record<string, string>): Promise<Array<Record<string, unknown>>> {
    try {
      const client = matrixClientService.getClient()
      if (!client) return []
      const result = await client.http.authedRequest('GET', `/thirdparty/user/${encodeURIComponent(protocol)}`, params)
      return (result as Array<Record<string, unknown>>) || []
    } catch (err) {
      logger.error(`[SynapseRust] 获取第三方用户失败: ${err}`)
      return []
    }
  }
}

export const synapseThirdpartyService = new SynapseThirdpartyService()
