import { ImUrlEnum } from '@/enums'
import { imRequest } from '@/utils/ImRequestUtils'
import { info, error as logError } from '@tauri-apps/plugin-log'

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

class MatrixApiKeyService {
  async page(params?: { pageNo?: number; pageSize?: number }): Promise<{ list: ApiKey[]; total: number }> {
    try {
      const result = await imRequest<{ list: ApiKey[]; total: number }>({
        url: ImUrlEnum.API_KEY_PAGE,
        params
      })
      info(`[MatrixApiKey] 获取 API 密钥列表成功`)
      return result
    } catch (err) {
      logError(`[MatrixApiKey] 获取 API 密钥列表失败: ${err}`)
      throw err
    }
  }

  async simpleList(): Promise<ApiKey[]> {
    try {
      const result = await imRequest<ApiKey[]>({
        url: ImUrlEnum.API_KEY_SIMPLE_LIST
      })
      info(`[MatrixApiKey] 获取 API 密钥简单列表成功`)
      return result
    } catch (err) {
      logError(`[MatrixApiKey] 获取 API 密钥简单列表失败: ${err}`)
      throw err
    }
  }

  async create(body: {
    name: string
    apiKey: string
    platform: string
    url?: string
    status: number
  }): Promise<ApiKey> {
    try {
      const result = await imRequest<ApiKey>({
        url: ImUrlEnum.API_KEY_CREATE,
        body
      })
      info(`[MatrixApiKey] 创建 API 密钥成功: ${result.id}`)
      return result
    } catch (err) {
      logError(`[MatrixApiKey] 创建 API 密钥失败: ${err}`)
      throw err
    }
  }

  async update(body: {
    id: string
    name: string
    apiKey: string
    platform: string
    url?: string
    status: number
  }): Promise<ApiKey> {
    try {
      const result = await imRequest<ApiKey>({
        url: ImUrlEnum.API_KEY_UPDATE,
        body
      })
      info(`[MatrixApiKey] 更新 API 密钥成功: ${body.id}`)
      return result
    } catch (err) {
      logError(`[MatrixApiKey] 更新 API 密钥失败: ${err}`)
      throw err
    }
  }

  async delete(params: { id: string }): Promise<boolean> {
    try {
      await imRequest({
        url: ImUrlEnum.API_KEY_DELETE,
        params
      })
      info(`[MatrixApiKey] 删除 API 密钥成功: ${params.id}`)
      return true
    } catch (err) {
      logError(`[MatrixApiKey] 删除 API 密钥失败: ${err}`)
      throw err
    }
  }

  async balance(params: { id: string }): Promise<any> {
    try {
      const result = await imRequest({
        url: ImUrlEnum.API_KEY_BALANCE,
        params
      })
      info(`[MatrixApiKey] 查询 API 密钥余额成功: ${params.id}`)
      return result
    } catch (err) {
      logError(`[MatrixApiKey] 查询 API 密钥余额失败: ${err}`)
      throw err
    }
  }

  async platformList(): Promise<Platform[]> {
    try {
      const result = await imRequest<Platform[]>({
        url: ImUrlEnum.PLATFORM_LIST
      })
      info(`[MatrixApiKey] 获取平台列表成功`)
      return result
    } catch (err) {
      logError(`[MatrixApiKey] 获取平台列表失败: ${err}`)
      throw err
    }
  }

  async addPlatformModel(platform: string, model: string): Promise<boolean> {
    try {
      await imRequest({
        url: ImUrlEnum.PLATFORM_ADD_MODEL,
        body: { platform, model }
      })
      info(`[MatrixApiKey] 添加平台模型成功: ${platform}/${model}`)
      return true
    } catch (err) {
      logError(`[MatrixApiKey] 添加平台模型失败: ${err}`)
      throw err
    }
  }
}

export const matrixApiKeyService = new MatrixApiKeyService()
