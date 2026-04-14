import { Method } from 'matrix-js-sdk'
import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'
import { info, error as logError } from '@tauri-apps/plugin-log'

export interface Conversation {
  id: string
  title?: string
  roleId?: string
  knowledgeId?: string
  modelId?: string
  messageCount?: number
  isPinned?: boolean
  pinned?: boolean
  createTime?: number
  createdAt?: number
  updatedAt?: number
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt?: number
}

class MatrixConversationService extends BaseManager {
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

  async page(params?: { pageNo?: number; pageSize?: number }): Promise<{ list: Conversation[]; total: number }> {
    try {
      const result = await this.httpRequest<{ list: Conversation[]; total: number }>(
        Method.Get,
        '/_matrix/client/v1/ai/conversation/page',
        params
      )
      info(`[MatrixConversation] 获取会话列表成功`)
      return result
    } catch (err) {
      logError(`[MatrixConversation] 获取会话列表失败: ${err}`)
      throw this.handleError(err, 'page', null)
    }
  }

  async create(params: {
    roleId: string
    knowledgeId?: string
    title?: string
    modelId?: string
  }): Promise<Conversation> {
    try {
      const result = await this.httpRequest<Conversation>(
        Method.Post,
        '/_matrix/client/v1/ai/conversation/create',
        undefined,
        params
      )
      info(`[MatrixConversation] 创建会话成功: ${result.id}`)
      return result
    } catch (err) {
      logError(`[MatrixConversation] 创建会话失败: ${err}`)
      throw this.handleError(err, 'create', null)
    }
  }

  async update(params: {
    id: string
    title?: string
    isPinned?: boolean
    roleId?: string
    modelId?: string
    knowledgeId?: string
  }): Promise<Conversation> {
    try {
      const result = await this.httpRequest<Conversation>(
        Method.Post,
        '/_matrix/client/v1/ai/conversation/update',
        undefined,
        params
      )
      info(`[MatrixConversation] 更新会话成功: ${params.id}`)
      return result
    } catch (err) {
      logError(`[MatrixConversation] 更新会话失败: ${err}`)
      throw this.handleError(err, 'update', null)
    }
  }

  async delete(params: { conversationIdList: string[] }): Promise<boolean> {
    try {
      await this.httpRequest(Method.Post, '/_matrix/client/v1/ai/conversation/delete', undefined, params)
      info(`[MatrixConversation] 删除会话成功`)
      return true
    } catch (err) {
      logError(`[MatrixConversation] 删除会话失败: ${err}`)
      throw this.handleError(err, 'delete', false)
    }
  }

  async messageListByConversationId(params: { conversationId: string }): Promise<Message[]> {
    try {
      const result = await this.httpRequest<Message[]>(Method.Get, '/_matrix/client/v1/ai/message/list', params)
      info(`[MatrixConversation] 获取会话消息列表成功`)
      return result
    } catch (err) {
      logError(`[MatrixConversation] 获取会话消息列表失败: ${err}`)
      throw this.handleError(err, 'messageListByConversationId', [])
    }
  }

  async messageDelete(params: { id: string }): Promise<boolean> {
    try {
      await this.httpRequest(Method.Post, '/_matrix/client/v1/ai/message/delete', undefined, params)
      info(`[MatrixConversation] 删除消息成功: ${params.id}`)
      return true
    } catch (err) {
      logError(`[MatrixConversation] 删除消息失败: ${err}`)
      throw this.handleError(err, 'messageDelete', false)
    }
  }

  async messageDeleteByConversationId(params: { conversationId: string }): Promise<boolean> {
    try {
      await this.httpRequest(Method.Post, '/_matrix/client/v1/ai/message/delete_by_conversation', undefined, params)
      info(`[MatrixConversation] 删除会话所有消息成功`)
      return true
    } catch (err) {
      logError(`[MatrixConversation] 删除会话所有消息失败: ${err}`)
      throw this.handleError(err, 'messageDeleteByConversationId', false)
    }
  }
}

export const matrixConversationService = new MatrixConversationService()
