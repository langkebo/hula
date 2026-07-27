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
  async page(params?: { pageNo?: number; pageSize?: number }): Promise<{ list: Conversation[]; total: number }> {
    return matrixHttpClient.request<{ list: Conversation[]; total: number }>(
      {
        url: matrixExtensionEndpoints.CONVERSATION_PAGE,
        params
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
