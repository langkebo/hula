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
  async page(params?: { pageNo?: number; pageSize?: number }): Promise<{ list: ApiKey[]; total: number }> {
    return matrixHttpClient.request<{ list: ApiKey[]; total: number }>(
      {
        url: matrixExtensionEndpoints.API_KEY_PAGE,
        params
      },
      undefined,
      { logPrefix: 'MatrixApiKey' }
    )
  }

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

  async platformList(): Promise<Platform[]> {
    return matrixHttpClient.request<Platform[]>(
      {
        url: matrixExtensionEndpoints.PLATFORM_LIST
      },
      undefined,
      { logPrefix: 'MatrixApiKey' }
    )
  }

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
