import { Method } from 'matrix-js-sdk'
import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'
import { info, error as logError } from '@tauri-apps/plugin-log'

export interface AIModel {
  id: string
  userId?: string
  keyId?: string
  name: string
  model: string
  platform: string
  avatar?: string
  type: number
  sort: number
  status: number
  publicStatus: number
  temperature?: number
  maxTokens?: number
  maxContexts?: number
  createdAt?: number
  updatedAt?: number
}

class MatrixModelService extends BaseManager {
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

  async page(params?: { pageNo?: number; pageSize?: number }): Promise<{ list: AIModel[]; total: number }> {
    try {
      const result = await this.httpRequest<{ list: AIModel[]; total: number }>(
        Method.Get,
        '/_matrix/client/v1/ai/model/page',
        params
      )
      info(`[MatrixModel] 获取模型列表成功`)
      return result
    } catch (err) {
      logError(`[MatrixModel] 获取模型列表失败: ${err}`)
      throw this.handleError(err, 'page', null)
    }
  }

  async update(body: {
    id?: string
    keyId?: string
    name?: string
    model?: string
    platform?: string
    avatar?: string
    type?: number
    sort?: number
    status?: number
    publicStatus?: number
    temperature?: number
    maxTokens?: number
    maxContexts?: number
  }): Promise<AIModel> {
    try {
      const result = await this.httpRequest<AIModel>(Method.Post, '/_matrix/client/v1/ai/model/update', undefined, body)
      info(`[MatrixModel] 更新模型成功`)
      return result
    } catch (err) {
      logError(`[MatrixModel] 更新模型失败: ${err}`)
      throw this.handleError(err, 'update', null)
    }
  }

  async delete(params: { id: string }): Promise<boolean> {
    try {
      await this.httpRequest(Method.Post, '/_matrix/client/v1/ai/model/delete', undefined, params)
      info(`[MatrixModel] 删除模型成功: ${params.id}`)
      return true
    } catch (err) {
      logError(`[MatrixModel] 删除模型失败: ${err}`)
      throw this.handleError(err, 'delete', false)
    }
  }
}

export const matrixModelService = new MatrixModelService()
