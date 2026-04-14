import { Method } from 'matrix-js-sdk'
import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'
import { info, error as logError } from '@tauri-apps/plugin-log'

export interface ChatRole {
  id: string
  userId?: string
  name: string
  avatar: string
  category: string
  sort: number
  description: string
  systemMessage: string
  modelId?: string
  knowledgeIds?: string[]
  toolIds?: string[]
  publicStatus: boolean
  status: number
  createdAt?: number
  updatedAt?: number
}

class MatrixChatRoleService extends BaseManager {
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

  async page(params?: { pageNo?: number; pageSize?: number }): Promise<{ list: ChatRole[]; total: number }> {
    try {
      const result = await this.httpRequest<{ list: ChatRole[]; total: number }>(
        Method.Get,
        '/_matrix/client/v1/ai/chatrole/page',
        params
      )
      info(`[MatrixChatRole] 获取角色列表成功`)
      return result
    } catch (err) {
      logError(`[MatrixChatRole] 获取角色列表失败: ${err}`)
      throw this.handleError(err, 'page', null)
    }
  }

  async categoryList(): Promise<Array<{ label: string; value: string }>> {
    try {
      const result = await this.httpRequest<Array<{ label: string; value: string }>>(
        Method.Get,
        '/_matrix/client/v1/ai/chatrole/category_list'
      )
      info(`[MatrixChatRole] 获取角色类别列表成功`)
      return result
    } catch (err) {
      logError(`[MatrixChatRole] 获取角色类别列表失败: ${err}`)
      throw this.handleError(err, 'categoryList', [])
    }
  }

  async create(body: {
    modelId?: string
    name: string
    avatar: string
    category: string
    sort: number
    description: string
    systemMessage: string
    knowledgeIds?: string[]
    toolIds?: string[]
    publicStatus: boolean
    status: number
  }): Promise<ChatRole> {
    try {
      const result = await this.httpRequest<ChatRole>(
        Method.Post,
        '/_matrix/client/v1/ai/chatrole/create',
        undefined,
        body
      )
      info(`[MatrixChatRole] 创建角色成功: ${result.id}`)
      return result
    } catch (err) {
      logError(`[MatrixChatRole] 创建角色失败: ${err}`)
      throw this.handleError(err, 'create', null)
    }
  }

  async update(body: {
    id: string
    modelId?: string
    name: string
    avatar: string
    category: string
    sort: number
    description: string
    systemMessage: string
    knowledgeIds?: string[]
    toolIds?: string[]
    publicStatus: boolean
    status: number
  }): Promise<ChatRole> {
    try {
      const result = await this.httpRequest<ChatRole>(
        Method.Post,
        '/_matrix/client/v1/ai/chatrole/update',
        undefined,
        body
      )
      info(`[MatrixChatRole] 更新角色成功: ${body.id}`)
      return result
    } catch (err) {
      logError(`[MatrixChatRole] 更新角色失败: ${err}`)
      throw this.handleError(err, 'update', null)
    }
  }

  async delete(params: { id: string }): Promise<boolean> {
    try {
      await this.httpRequest(Method.Post, '/_matrix/client/v1/ai/chatrole/delete', undefined, params)
      info(`[MatrixChatRole] 删除角色成功: ${params.id}`)
      return true
    } catch (err) {
      logError(`[MatrixChatRole] 删除角色失败: ${err}`)
      throw this.handleError(err, 'delete', false)
    }
  }
}

export const matrixChatRoleService = new MatrixChatRoleService()
