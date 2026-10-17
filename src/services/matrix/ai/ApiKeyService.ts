import { matrixExtensionEndpoints } from '@/services/backend'
import { matrixHttpClient } from '@/services/matrix/MatrixHttpClient'

export interface ApiKey {
  id: string
  name: string
  apiKey: string
  platform: string
  url?: string
  status: number
  publicStatus?: boolean
}

export interface Platform {
  label: string
  platform: string
  examples?: string
  docs?: string
  hint?: string
}

export interface ApiKeyBalanceInfo {
  totalBalance?: string
  currency?: string
  [key: string]: unknown
}

export interface ApiKeyBalance {
  balanceInfos: ApiKeyBalanceInfo[]
  [key: string]: unknown
}

class MatrixApiKeyService {
  /**
   * 分页查询当前用户的 API Key 列表。
   *
   * @param params - 分页参数
   * @param params.pageNo - 页码
   * @param params.pageSize - 每页数量
   * @returns 列表与总数
   */
  async page(params?: { pageNo?: number; pageSize?: number }): Promise<{ list: ApiKey[]; total: number }> {
    return matrixHttpClient.request<{ list: ApiKey[]; total: number }>(
      {
        url: matrixExtensionEndpoints.API_KEY_PAGE,
        ...(params !== undefined ? { params } : {})
      },
      undefined,
      { logPrefix: 'MatrixApiKey' }
    )
  }

  /**
   * 查询当前用户的 API Key 精简列表。
   *
   * 仅返回用于下拉选择的核心字段，不分页。
   */
  async simpleList(): Promise<ApiKey[]> {
    return matrixHttpClient.request<ApiKey[]>(
      {
        url: matrixExtensionEndpoints.API_KEY_SIMPLE_LIST
      },
      undefined,
      { logPrefix: 'MatrixApiKey' }
    )
  }

  async create(body: {
    name: string
    apiKey: string
    platform: string
    url?: string
    status: number
  }): Promise<ApiKey> {
    return matrixHttpClient.request<ApiKey>(
      {
        url: matrixExtensionEndpoints.API_KEY_CREATE,
        method: 'POST',
        body
      },
      undefined,
      { logPrefix: 'MatrixApiKey' }
    )
  }

  async update(body: {
    id: string
    name: string
    apiKey: string
    platform: string
    url?: string
    status: number
  }): Promise<ApiKey> {
    return matrixHttpClient.request<ApiKey>(
      {
        url: matrixExtensionEndpoints.API_KEY_UPDATE,
        method: 'POST',
        body
      },
      undefined,
      { logPrefix: 'MatrixApiKey' }
    )
  }

  /**
   * 删除指定 API Key。
   *
   * @param params - 删除参数
   * @param params.id - API Key ID
   * @returns 删除成功返回 true
   */
  async delete(params: { id: string }): Promise<boolean> {
    await matrixHttpClient.request(
      {
        url: matrixExtensionEndpoints.API_KEY_DELETE,
        params
      },
      undefined,
      { logPrefix: 'MatrixApiKey' }
    )
    return true
  }

  /**
   * 查询指定 API Key 的余额信息。
   *
   * @param params - 查询参数
   * @param params.id - API Key ID
   * @returns 余额信息
   */
  async balance(params: { id: string }): Promise<ApiKeyBalance> {
    return matrixHttpClient.request<ApiKeyBalance>(
      {
        url: matrixExtensionEndpoints.API_KEY_BALANCE,
        params
      },
      undefined,
      { logPrefix: 'MatrixApiKey' }
    )
  }

  /**
   * 查询支持的平台列表。
   *
   * 用于 API Key 创建/编辑时的平台选择。
   */
  async platformList(): Promise<Platform[]> {
    return matrixHttpClient.request<Platform[]>(
      {
        url: matrixExtensionEndpoints.PLATFORM_LIST
      },
      undefined,
      { logPrefix: 'MatrixApiKey' }
    )
  }

  /**
   * 为指定平台登记可用模型。
   *
   * @param platform - 平台标识
   * @param model - 模型名称
   * @returns 登记成功返回 true
   */
  async addPlatformModel(platform: string, model: string): Promise<boolean> {
    await matrixHttpClient.request(
      {
        url: matrixExtensionEndpoints.PLATFORM_ADD_MODEL,
        method: 'POST',
        body: { platform, model }
      },
      undefined,
      { logPrefix: 'MatrixApiKey' }
    )
    return true
  }
}

export const apiKeyService = new MatrixApiKeyService()
