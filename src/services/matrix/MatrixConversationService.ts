import { ImUrlEnum } from '@/enums'
import { imRequest } from '@/utils/ImRequestUtils'
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

class MatrixConversationService {
  async page(params?: { pageNo?: number; pageSize?: number }): Promise<{ list: Conversation[]; total: number }> {
    try {
      const result = await imRequest<{ list: Conversation[]; total: number }>({
        url: ImUrlEnum.CONVERSATION_PAGE,
        params
      })
      info(`[MatrixConversation] 获取会话列表成功`)
      return result
    } catch (err) {
      logError(`[MatrixConversation] 获取会话列表失败: ${err}`)
      throw err
    }
  }

  async create(params: {
    roleId: string
    knowledgeId?: string
    title?: string
    modelId?: string
  }): Promise<Conversation> {
    try {
      const result = await imRequest<Conversation>({
        url: ImUrlEnum.CONVERSATION_CREATE_MY,
        body: params
      })
      info(`[MatrixConversation] 创建会话成功: ${result.id}`)
      return result
    } catch (err) {
      logError(`[MatrixConversation] 创建会话失败: ${err}`)
      throw err
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
      const result = await imRequest<Conversation>({
        url: ImUrlEnum.CONVERSATION_UPDATE_MY,
        body: params
      })
      info(`[MatrixConversation] 更新会话成功: ${params.id}`)
      return result
    } catch (err) {
      logError(`[MatrixConversation] 更新会话失败: ${err}`)
      throw err
    }
  }

  async delete(params: { conversationIdList: string[] }): Promise<boolean> {
    try {
      await imRequest({
        url: ImUrlEnum.CONVERSATION_DELETE_MY,
        body: params
      })
      info(`[MatrixConversation] 删除会话成功`)
      return true
    } catch (err) {
      logError(`[MatrixConversation] 删除会话失败: ${err}`)
      throw err
    }
  }

  async messageListByConversationId(params: { conversationId: string }): Promise<Message[]> {
    try {
      const result = await imRequest<Message[]>({
        url: ImUrlEnum.MESSAGE_LIST_BY_CONVERSATION_ID,
        params
      })
      info(`[MatrixConversation] 获取会话消息列表成功`)
      return result
    } catch (err) {
      logError(`[MatrixConversation] 获取会话消息列表失败: ${err}`)
      throw err
    }
  }

  async messageDelete(params: { id: string }): Promise<boolean> {
    try {
      await imRequest({
        url: ImUrlEnum.MESSAGE_DELETE,
        params
      })
      info(`[MatrixConversation] 删除消息成功: ${params.id}`)
      return true
    } catch (err) {
      logError(`[MatrixConversation] 删除消息失败: ${err}`)
      throw err
    }
  }

  async messageDeleteByConversationId(params: { conversationId: string }): Promise<boolean> {
    try {
      await imRequest({
        url: ImUrlEnum.MESSAGE_DELETE_BY_CONVERSATION_ID,
        params
      })
      info(`[MatrixConversation] 删除会话所有消息成功`)
      return true
    } catch (err) {
      logError(`[MatrixConversation] 删除会话所有消息失败: ${err}`)
      throw err
    }
  }
}

export const matrixConversationService = new MatrixConversationService()
