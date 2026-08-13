import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { matrixClientService } from '../MatrixClientService'

const logger = createLogger('SynapseThirdpartyService')

/**
 * 第三方协议查询（/_matrix/client/v3/thirdparty/*）。
 * 从 SynapseRustExtensionsService 拆分而来。
 * 走 SDK ThirdPartyManager，不再裸调 client.http.authedRequest。
 */
class SynapseThirdpartyService extends BaseMatrixService {
  /** 获取第三方协议列表
   */
  async getThirdpartyProtocols(): Promise<Record<string, unknown>> {
    try {
      const client = matrixClientService.getClient()
      if (!client) return {}
      const result = await client.getThirdPartyManager().getThirdpartyProtocols()
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
      // SDK getThirdpartyLocation 签名期望 { searchFields?: string[] }，但内部作为 QueryDict 传递，
      // Record<string, string> 在运行时兼容，这里做类型断言。
      const result = await client.getThirdPartyManager().getThirdpartyLocation(protocol, params as never)
      return (result as unknown as Array<Record<string, unknown>>) || []
    } catch (err) {
      logger.error(`[SynapseRust] 获取第三方位置失败: ${err}`)
      return []
    }
  }

  /** 查询第三方协议用户
   */
  async getThirdpartyUser(protocol: string, params?: Record<string, string>): Promise<Array<Record<string, unknown>>> {
    try {
      const client = matrixClientService.getClient()
      if (!client) return []
      const result = await client.getThirdPartyManager().getThirdpartyUser(protocol, params)
      return (result as unknown as Array<Record<string, unknown>>) || []
    } catch (err) {
      logger.error(`[SynapseRust] 获取第三方用户失败: ${err}`)
      return []
    }
  }
}

export const synapseThirdpartyService = new SynapseThirdpartyService()
