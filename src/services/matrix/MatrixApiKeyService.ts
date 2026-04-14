import { Method } from 'matrix-js-sdk'
import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'
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

class MatrixApiKeyService extends BaseManager {
  private get client() {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('Matrix client not initialized')
    return client
  }

  private httpRequest<T>(
    method: Method,
    path: string,
    queryParams?: Record<string, unknown>,
    body?: Record<string, unknown>
  ): Promise<T> {
    return (this.client.http as any).authedRequest(method, path, queryParams ?? {}, body ?? {})
  }

  async page(params?: { pageNo?: number; pageSize?: number }): Promise<{ list: ApiKey[]; total: number }> {
    try {
      const result = await this.httpRequest<{ list: ApiKey[]; total: number }>(
        Method.Get,
        '/_matrix/client/v1/ai/apikey/page',
        params
      )
      info(`[MatrixApiKey] 获取 API 密钥列表成功`)
      return result
    } catch (err) {
      logError(`[MatrixApiKey] 获取 API 密钥列表失败: ${err}`)
      throw this.handleError(err, 'page', null, true)
    }
  }

  async simpleList(): Promise<ApiKey[]> {
    try {
      const result = await this.httpRequest<ApiKey[]>(Method.Get, '/_matrix/client/v1/ai/apikey/simple_list')
      info(`[MatrixApiKey] 获取 API 密钥简单列表成功`)
      return result
    } catch (err) {
      logError(`[MatrixApiKey] 获取 API 密钥简单列表失败: ${err}`)
      throw this.handleError(err, 'simpleList', [], true)
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
      const result = await this.httpRequest<ApiKey>(Method.Post, '/_matrix/client/v1/ai/apikey/create', undefined, body)
      info(`[MatrixApiKey] 创建 API 密钥成功: ${result.id}`)
      return result
    } catch (err) {
      logError(`[MatrixApiKey] 创建 API 密钥失败: ${err}`)
      throw this.handleError(err, 'create', null, true)
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
      const result = await this.httpRequest<ApiKey>(Method.Post, '/_matrix/client/v1/ai/apikey/update', undefined, body)
      info(`[MatrixApiKey] 更新 API 密钥成功: ${body.id}`)
      return result
    } catch (err) {
      logError(`[MatrixApiKey] 更新 API 密钥失败: ${err}`)
      throw this.handleError(err, 'update', null, true)
    }
  }

  async delete(params: { id: string }): Promise<boolean> {
    try {
      await this.httpRequest(Method.Post, '/_matrix/client/v1/ai/apikey/delete', undefined, params)
      info(`[MatrixApiKey] 删除 API 密钥成功: ${params.id}`)
      return true
    } catch (err) {
      logError(`[MatrixApiKey] 删除 API 密钥失败: ${err}`)
      throw this.handleError(err, 'delete', false, true)
    }
  }

  async balance(params: { id: string }): Promise<any> {
    try {
      const result = await this.httpRequest<any>(Method.Get, '/_matrix/client/v1/ai/apikey/balance', params)
      info(`[MatrixApiKey] 查询 API 密钥余额成功: ${params.id}`)
      return result
    } catch (err) {
      logError(`[MatrixApiKey] 查询 API 密钥余额失败: ${err}`)
      throw this.handleError(err, 'balance', null, true)
    }
  }

  async platformList(): Promise<Platform[]> {
    try {
      const result = await this.httpRequest<Platform[]>(Method.Get, '/_matrix/client/v1/ai/platform/list')
      info(`[MatrixApiKey] 获取平台列表成功`)
      return result
    } catch (err) {
      logError(`[MatrixApiKey] 获取平台列表失败: ${err}`)
      throw this.handleError(err, 'platformList', [], true)
    }
  }

  async addPlatformModel(platform: string, model: string): Promise<boolean> {
    try {
      await this.httpRequest(Method.Post, '/_matrix/client/v1/ai/platform/add_model', undefined, { platform, model })
      info(`[MatrixApiKey] 添加平台模型成功: ${platform}/${model}`)
      return true
    } catch (err) {
      logError(`[MatrixApiKey] 添加平台模型失败: ${err}`)
      throw this.handleError(err, 'addPlatformModel', false, true)
    }
  }
}

export const matrixApiKeyService = new MatrixApiKeyService()
