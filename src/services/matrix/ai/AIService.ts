import { matrixExtensionEndpoints } from '@/services/backend'
import { matrixHttpClient } from '@/services/matrix/MatrixHttpClient'
import type {
  AIAudio,
  AIAudioListResponse,
  AIChatRoleListResponse,
  AIImage,
  AIImageListResponse,
  AIModelListResponse,
  AIVideo,
  AIVideoListResponse,
  AIVoice
} from '@/types/matrix-api'
import { createLogger } from '@/utils/Logger'
import { matrixClientService } from '../MatrixClientService'

const logger = createLogger('MatrixAI')

export interface AIConversation {
  id: string
  title?: string
  roleId?: string
  knowledgeId?: string
  modelId?: string
  systemMessage?: string
  temperature?: number
  maxTokens?: number
  maxContexts?: number
  pinned?: boolean
  createdAt?: number
  updatedAt?: number
}

interface AIMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt?: number
  type?: string
  msgType?: string
  createTime?: number
  replyId?: string
  model?: string
  imageUrl?: string
  reasoningContent?: string
}

interface ImageGenerationRequest {
  modelId: string
  prompt: string
  width?: number
  height?: number
  conversationId?: string
  options?: Record<string, unknown>
  [key: string]: unknown
}

interface ImageGenerationResult {
  id: string
  url?: string
  status?: number
}

interface AIModelRemainingUsageResponse {
  remainingUsage: number
}

export interface VideoGenerationRequest {
  modelId?: string
  prompt: string
  width?: number
  height?: number
  duration?: number
  conversationId?: string
  options?: Record<string, unknown>
  [key: string]: unknown
}

interface AudioGenerationRequest {
  modelId?: string | number
  prompt: string
  conversationId?: string
  options?: Record<string, unknown>
  [key: string]: unknown
}

export type AIAsyncGenerationResponse = number | string | { id?: number | string; url?: string; status?: number }

interface StreamCallbacks {
  onChunk?: (chunk: string) => void
  onDone?: (fullContent: string) => void
  onError?: (error: string) => void
  onStart?: (requestId: string) => void
}

class MatrixAIService {
  /**
   * 获取用户的 AI 对话列表
   *
   * @param params - 查询参数
   * @param params.id - 对话 ID（可选）
   * @returns AI 对话列表
   */
  async conversationGetMy(params?: { id?: string }): Promise<AIConversation[]> {
    return matrixHttpClient.request<AIConversation[]>(
      {
        url: matrixExtensionEndpoints.CONVERSATION_GET_MY,
        params
      },
      undefined,
      { logPrefix: 'MatrixAI' }
    )
  }

  /**
   * 创建新的 AI 对话
   *
   * @param params - 创建参数
   * @param params.roleId - 角色 ID
   * @param params.knowledgeId - 知识库 ID
   * @param params.title - 对话标题
   * @param params.modelId - 模型 ID
   * @param params.systemMessage - 系统消息
   * @param params.temperature - 温度参数
   * @param params.maxTokens - 最大令牌数
   * @param params.maxContexts - 最大上下文数
   * @returns 创建的对话
   */
  async conversationCreate(params: {
    roleId?: string
    knowledgeId?: string
    title?: string
    modelId?: string
    systemMessage?: string
    temperature?: number
    maxTokens?: number
    maxContexts?: number
  }): Promise<AIConversation> {
    return matrixHttpClient.request<AIConversation>(
      {
        url: matrixExtensionEndpoints.CONVERSATION_CREATE_MY,
        method: 'POST',
        body: params
      },
      undefined,
      { logPrefix: 'MatrixAI' }
    )
  }

  /**
   * 更新 AI 对话元数据
   *
   * @param params - 更新参数
   * @param params.id - 对话 ID
   * @param params.title - 对话标题
   * @param params.pinned - 是否置顶
   * @param params.roleId - 角色 ID
   * @param params.modelId - 模型 ID
   * @param params.knowledgeId - 知识库 ID
   * @param params.systemMessage - 系统消息
   * @param params.temperature - 温度参数
   * @param params.maxTokens - 最大令牌数
   * @param params.maxContexts - 最大上下文数
   * @returns 更新后的对话
   */
  async conversationUpdate(params: {
    id: string
    title?: string
    pinned?: boolean
    roleId?: string
    modelId?: string
    knowledgeId?: string
    systemMessage?: string
    temperature?: number
    maxTokens?: number
    maxContexts?: number
  }): Promise<AIConversation> {
    return matrixHttpClient.request<AIConversation>(
      {
        url: matrixExtensionEndpoints.CONVERSATION_UPDATE_MY,
        method: 'POST',
        body: params
      },
      undefined,
      { logPrefix: 'MatrixAI' }
    )
  }

  /**
   * 删除 AI 对话
   *
   * @param conversationIdList - 要删除的对话 ID 列表
   * @returns 是否删除成功
   */
  async conversationDelete(conversationIdList: string[]): Promise<boolean> {
    await matrixHttpClient.request(
      {
        url: matrixExtensionEndpoints.CONVERSATION_DELETE_MY,
        method: 'POST',
        body: { conversationIdList }
      },
      undefined,
      { logPrefix: 'MatrixAI' }
    )
    return true
  }

  /**
   * 保存 AI 生成的内容消息
   *
   * @param params - 保存参数
   * @param params.conversationId - 对话 ID
   * @param params.prompt - 提示词
   * @param params.generatedContent - 生成的内容
   * @returns 是否保存成功
   */
  async messageSaveGeneratedContent(params: {
    conversationId: string
    prompt: string
    generatedContent: string
  }): Promise<boolean> {
    await matrixHttpClient.request(
      {
        url: matrixExtensionEndpoints.MESSAGE_SAVE_GENERATED_CONTENT,
        params
      },
      undefined,
      { logPrefix: 'MatrixAI' }
    )
    return true
  }

  /**
   * 取消正在进行的 AI 流式生成
   *
   * @param requestId - 请求 ID
   * @returns 是否取消成功
   */
  async messageCancelStream(requestId: string): Promise<boolean> {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('ai_message_cancel_stream', { requestId })
      logger.info(`取消流式生成成功: ${requestId}`)
      return true
    } catch (err) {
      logger.error(`取消流式生成失败: ${err}`)
      return false
    }
  }

  private getClient() {
    const client = matrixClientService.getClient()
    if (!client) {
      logger.info('Matrix client not initialized, service unavailable.')
      return null
    }
    return client
  }

  /**
   * 发送 AI 消息（流式）
   *
   * @param conversationId - 对话 ID
   * @param content - 消息内容
   * @param callbacks - 流式回调
   * @param useContext - 是否使用上下文
   * @param reasoningEnabled - 是否启用推理
   * @returns 完整内容
   */
  async messageSendStream(
    conversationId: string,
    content: string,
    callbacks?: StreamCallbacks,
    useContext?: boolean,
    reasoningEnabled?: boolean
  ): Promise<string> {
    const client = this.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const { invoke, Channel } = await import('@tauri-apps/api/core')
    const requestId = `ai-stream-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

    return new Promise<string>((resolve, reject) => {
      let fullContent = ''
      let isResolved = false

      const onEvent = new Channel<{
        eventType: 'chunk' | 'done' | 'error'
        data?: string
        error?: string
        requestId: string
      }>()

      onEvent.onmessage = (event) => {
        const { eventType, data, error, requestId: eventRequestId } = event

        if (eventRequestId !== requestId) {
          return
        }

        switch (eventType) {
          case 'chunk':
            if (data) {
              fullContent += data
              callbacks?.onChunk?.(data)
            }
            break
          case 'done':
            if (!isResolved) {
              isResolved = true
              const finalContent = data || fullContent
              callbacks?.onDone?.(finalContent)
              resolve(finalContent)
            }
            break
          case 'error':
            if (!isResolved) {
              isResolved = true
              const errorMsg = error || '未知错误'
              callbacks?.onError?.(errorMsg)
              reject(new Error(errorMsg))
            }
            break
        }
      }

      callbacks?.onStart?.(requestId)

      invoke('ai_message_send_stream', {
        body: {
          conversationId,
          content,
          useContext,
          reasoningEnabled
        },
        requestId,
        onEvent
      }).catch((error) => {
        if (!isResolved) {
          isResolved = true
          const errorMsg = error instanceof Error ? error.message : String(error)
          callbacks?.onError?.(errorMsg)
          reject(new Error(errorMsg))
        }
      })
    })
  }

  /**
   * 生成图片
   *
   * @param request - 图片生成参数
   * @param request.modelId - 模型 ID
   * @param request.prompt - 提示词
   * @param request.width - 宽度
   * @param request.height - 高度
   * @param request.conversationId - 对话 ID
   * @param request.options - 其他选项
   * @returns 图片生成结果
   */
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult | number | string> {
    return matrixHttpClient.request<ImageGenerationResult | number | string>(
      {
        url: matrixExtensionEndpoints.IMAGE_DRAW,
        method: 'POST',
        body: request
      },
      undefined,
      { logPrefix: 'MatrixAI' }
    )
  }

  /**
   * 获取对话消息列表
   *
   * @param params - 查询参数
   * @param params.conversationId - 对话 ID
   * @param params.pageNo - 页码
   * @param params.pageSize - 每页数量
   * @returns 消息列表
   */
  async messageListByConversationId(params: {
    conversationId: string
    pageNo?: number
    pageSize?: number
  }): Promise<AIMessage[]> {
    return matrixHttpClient.request<AIMessage[]>(
      {
        url: matrixExtensionEndpoints.MESSAGE_LIST_BY_CONVERSATION_ID,
        params
      },
      undefined,
      { logPrefix: 'MatrixAI' }
    )
  }

  async modelPage(params?: { pageNo?: number; pageSize?: number }): Promise<AIModelListResponse> {
    return matrixHttpClient.request<AIModelListResponse>(
      {
        url: matrixExtensionEndpoints.MODEL_PAGE,
        params
      },
      undefined,
      { logPrefix: 'MatrixAI' }
    )
  }

  async getModelRemainingUsage(params: { modelId: string }): Promise<number> {
    const result = await matrixHttpClient.request<number | AIModelRemainingUsageResponse>(
      {
        url: matrixExtensionEndpoints.MODEL_REMAINING_USAGE,
        params
      },
      undefined,
      { logPrefix: 'MatrixAI' }
    )
    return typeof result === 'number' ? result : result.remainingUsage
  }

  async imageMyPage(params?: { pageNo?: number; pageSize?: number }): Promise<AIImageListResponse> {
    return matrixHttpClient.request<AIImageListResponse>(
      {
        url: matrixExtensionEndpoints.IMAGE_MY_PAGE,
        params
      },
      undefined,
      { logPrefix: 'MatrixAI' }
    )
  }

  async imageMyListByIds(params: { ids: string }): Promise<AIImage[]> {
    return matrixHttpClient.request<AIImage[]>(
      {
        url: matrixExtensionEndpoints.IMAGE_MY_LIST_BY_IDS,
        params
      },
      undefined,
      { logPrefix: 'MatrixAI' }
    )
  }

  async videoMyPage(params?: { pageNo?: number; pageSize?: number }): Promise<AIVideoListResponse> {
    return matrixHttpClient.request<AIVideoListResponse>(
      {
        url: matrixExtensionEndpoints.VIDEO_MY_PAGE,
        params
      },
      undefined,
      { logPrefix: 'MatrixAI' }
    )
  }

  async videoMyListByIds(params: { ids: string }): Promise<AIVideo[]> {
    return matrixHttpClient.request<AIVideo[]>(
      {
        url: matrixExtensionEndpoints.VIDEO_MY_LIST_BY_IDS,
        params
      },
      undefined,
      { logPrefix: 'MatrixAI' }
    )
  }

  async videoGenerate(body: VideoGenerationRequest): Promise<AIAsyncGenerationResponse> {
    return matrixHttpClient.request<AIAsyncGenerationResponse>(
      {
        url: matrixExtensionEndpoints.VIDEO_GENERATE,
        method: 'POST',
        body
      },
      undefined,
      { logPrefix: 'MatrixAI' }
    )
  }

  async audioMyPage(params?: { pageNo?: number; pageSize?: number }): Promise<AIAudioListResponse> {
    return matrixHttpClient.request<AIAudioListResponse>(
      {
        url: matrixExtensionEndpoints.AUDIO_MY_PAGE,
        params
      },
      undefined,
      { logPrefix: 'MatrixAI' }
    )
  }

  async audioMyListByIds(params: { ids: string }): Promise<AIAudio[]> {
    return matrixHttpClient.request<AIAudio[]>(
      {
        url: matrixExtensionEndpoints.AUDIO_MY_LIST_BY_IDS,
        params
      },
      undefined,
      { logPrefix: 'MatrixAI' }
    )
  }

  async audioGenerate(body: AudioGenerationRequest): Promise<AIAsyncGenerationResponse> {
    return matrixHttpClient.request<AIAsyncGenerationResponse>(
      {
        url: matrixExtensionEndpoints.AUDIO_GENERATE,
        method: 'POST',
        body
      },
      undefined,
      { logPrefix: 'MatrixAI' }
    )
  }

  async audioGetVoices(params: { model: string }): Promise<AIVoice[]> {
    return matrixHttpClient.request<AIVoice[]>(
      {
        url: matrixExtensionEndpoints.AUDIO_VOICES,
        params
      },
      undefined,
      { logPrefix: 'MatrixAI' }
    )
  }

  async messageDelete(params: { id: string }): Promise<boolean> {
    await matrixHttpClient.request(
      {
        url: matrixExtensionEndpoints.MESSAGE_DELETE,
        params
      },
      undefined,
      { logPrefix: 'MatrixAI' }
    )
    return true
  }

  async messageDeleteByConversationId(params: { conversationIdList: string[] }): Promise<boolean> {
    await matrixHttpClient.request(
      {
        url: matrixExtensionEndpoints.MESSAGE_DELETE_BY_CONVERSATION_ID,
        method: 'POST',
        body: params
      },
      undefined,
      { logPrefix: 'MatrixAI' }
    )
    return true
  }

  async chatRolePage(params?: { pageNo?: number; pageSize?: number }): Promise<AIChatRoleListResponse> {
    return matrixHttpClient.request<AIChatRoleListResponse>(
      {
        url: matrixExtensionEndpoints.CHAT_ROLE_PAGE,
        params
      },
      undefined,
      { logPrefix: 'MatrixAI' }
    )
  }
}

export const aiService = new MatrixAIService()
