import { matrixExtensionEndpoints } from '@/services/backend'
import { matrixHttpClient } from '@/services/matrix/MatrixHttpClient'

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

interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt?: number
}

class MatrixConversationService {
  /**
   * 分页查询当前用户的 AI 对话列表。
   *
   * @param params - 分页参数
   * @param params.pageNo - 页码
   * @param params.pageSize - 每页数量
   * @returns 列表与总数
   */
  async page(params?: { pageNo?: number; pageSize?: number }): Promise<{ list: Conversation[]; total: number }> {
    return matrixHttpClient.request<{ list: Conversation[]; total: number }>(
      {
        url: matrixExtensionEndpoints.CONVERSATION_PAGE,
        ...(params !== undefined ? { params } : {})
      },
      undefined,
      { logPrefix: 'MatrixConversation' }
    )
  }

  async create(params: {
    roleId: string
    knowledgeId?: string
    title?: string
    modelId?: string
  }): Promise<Conversation> {
    return matrixHttpClient.request<Conversation>(
      {
        url: matrixExtensionEndpoints.CONVERSATION_CREATE_MY,
        method: 'POST',
        body: params
      },
      undefined,
      { logPrefix: 'MatrixConversation' }
    )
  }

  async update(params: {
    id: string
    title?: string
    isPinned?: boolean
    roleId?: string
    modelId?: string
    knowledgeId?: string
  }): Promise<Conversation> {
    return matrixHttpClient.request<Conversation>(
      {
        url: matrixExtensionEndpoints.CONVERSATION_UPDATE_MY,
        method: 'POST',
        body: params
      },
      undefined,
      { logPrefix: 'MatrixConversation' }
    )
  }

  /**
   * 按对话 ID 列表批量删除当前用户的对话。
   *
   * @param params - 删除参数
   * @param params.conversationIdList - 待删除的对话 ID 列表
   * @returns 删除成功返回 true
   */
  async delete(params: { conversationIdList: string[] }): Promise<boolean> {
    await matrixHttpClient.request(
      {
        url: matrixExtensionEndpoints.CONVERSATION_DELETE_MY,
        method: 'POST',
        body: params
      },
      undefined,
      { logPrefix: 'MatrixConversation' }
    )
    return true
  }

  /**
   * 查询指定对话下的历史消息。
   *
   * @param params - 查询参数
   * @param params.conversationId - 对话 ID
   * @returns 消息列表
   */
  async messageListByConversationId(params: { conversationId: string }): Promise<Message[]> {
    return matrixHttpClient.request<Message[]>(
      {
        url: matrixExtensionEndpoints.MESSAGE_LIST_BY_CONVERSATION_ID,
        params
      },
      undefined,
      { logPrefix: 'MatrixConversation' }
    )
  }

  /**
   * 删除单条消息。
   *
   * @param params - 删除参数
   * @param params.id - 消息 ID
   * @returns 删除成功返回 true
   */
  async messageDelete(params: { id: string }): Promise<boolean> {
    await matrixHttpClient.request(
      {
        url: matrixExtensionEndpoints.MESSAGE_DELETE,
        params
      },
      undefined,
      { logPrefix: 'MatrixConversation' }
    )
    return true
  }

  /**
   * 删除指定对话下的全部消息。
   *
   * @param params - 删除参数
   * @param params.conversationId - 对话 ID
   * @returns 删除成功返回 true
   */
  async messageDeleteByConversationId(params: { conversationId: string }): Promise<boolean> {
    await matrixHttpClient.request(
      {
        url: matrixExtensionEndpoints.MESSAGE_DELETE_BY_CONVERSATION_ID,
        params
      },
      undefined,
      { logPrefix: 'MatrixConversation' }
    )
    return true
  }
}

export const conversationService = new MatrixConversationService()
