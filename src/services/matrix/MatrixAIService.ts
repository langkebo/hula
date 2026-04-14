import { Method } from 'matrix-js-sdk'
import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'
import { info, error as logError } from '@tauri-apps/plugin-log'
import type {
  AIModelListResponse,
  AIImageListResponse,
  AIVideoListResponse,
  AIAudioListResponse,
  AIChatRoleListResponse,
  AIVoice,
  AIImage,
  AIVideo,
  AIAudio
} from '@/types/matrix-api'

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

export interface AIMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt?: number
}

export interface ImageGenerationRequest {
  modelId: string
  prompt: string
  width?: number
  height?: number
  conversationId?: string
  options?: Record<string, unknown>
  [key: string]: unknown
}

export interface ImageGenerationResult {
  id: string
  url?: string
  status?: number
}

export interface StreamCallbacks {
  onChunk?: (chunk: string) => void
  onDone?: (fullContent: string) => void
  onError?: (error: string) => void
  onStart?: (requestId: string) => void
}

class MatrixAIService extends BaseManager {
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

  async conversationGetMy(params?: { id?: string }): Promise<AIConversation[]> {
    try {
      const result = await this.httpRequest<AIConversation[]>(
        Method.Get,
        '/_matrix/client/v1/ai/conversation/my',
        params
      )
      info(`[MatrixAI] 获取 AI 对话列表成功`)
      return result
    } catch (err) {
      logError(`[MatrixAI] 获取 AI 对话列表失败: ${err}`)
      throw this.handleError(err, 'conversationGetMy', [])
    }
  }

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
    try {
      const result = await this.httpRequest<AIConversation>(
        Method.Post,
        '/_matrix/client/v1/ai/conversation/create',
        undefined,
        params
      )
      info(`[MatrixAI] 创建 AI 对话成功: ${result.id}`)
      return result
    } catch (err) {
      logError(`[MatrixAI] 创建 AI 对话失败: ${err}`)
      throw this.handleError(err, 'conversationCreate', null)
    }
  }

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
    try {
      const result = await this.httpRequest<AIConversation>(
        Method.Post,
        '/_matrix/client/v1/ai/conversation/update',
        undefined,
        params
      )
      info(`[MatrixAI] 更新 AI 对话成功: ${params.id}`)
      return result
    } catch (err) {
      logError(`[MatrixAI] 更新 AI 对话失败: ${err}`)
      throw this.handleError(err, 'conversationUpdate', null)
    }
  }

  async conversationDelete(conversationIdList: string[]): Promise<boolean> {
    try {
      await this.httpRequest(Method.Post, '/_matrix/client/v1/ai/conversation/delete', undefined, {
        conversationIdList
      })
      info(`[MatrixAI] 删除 AI 对话成功: ${conversationIdList.join(', ')}`)
      return true
    } catch (err) {
      logError(`[MatrixAI] 删除 AI 对话失败: ${err}`)
      throw this.handleError(err, 'conversationDelete', false)
    }
  }

  async messageSaveGeneratedContent(params: {
    conversationId: string
    prompt: string
    generatedContent: string
  }): Promise<boolean> {
    try {
      await this.httpRequest(Method.Post, '/_matrix/client/v1/ai/message/save_generated', undefined, params)
      info(`[MatrixAI] 保存生成内容成功`)
      return true
    } catch (err) {
      logError(`[MatrixAI] 保存生成内容失败: ${err}`)
      throw this.handleError(err, 'messageSaveGeneratedContent', false)
    }
  }

  async messageCancelStream(requestId: string): Promise<boolean> {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('ai_message_cancel_stream', { requestId })
      info(`[MatrixAI] 取消流式生成成功: ${requestId}`)
      return true
    } catch (err) {
      logError(`[MatrixAI] 取消流式生成失败: ${err}`)
      return false
    }
  }

  async messageSendStream(
    conversationId: string,
    content: string,
    callbacks?: StreamCallbacks,
    useContext?: boolean,
    reasoningEnabled?: boolean
  ): Promise<string> {
    const client = matrixClientService.getClient()
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

  async generateImage(request: ImageGenerationRequest): Promise<any> {
    try {
      const result = await this.httpRequest(Method.Post, '/_matrix/client/v1/ai/image/generate', undefined, request)
      info(`[MatrixAI] 生成图片请求成功`)
      return result
    } catch (err) {
      logError(`[MatrixAI] 生成图片失败: ${err}`)
      throw this.handleError(err, 'generateImage', null)
    }
  }

  async messageListByConversationId(params: {
    conversationId: string
    pageNo?: number
    pageSize?: number
  }): Promise<AIMessage[]> {
    try {
      const result = await this.httpRequest<AIMessage[]>(Method.Get, '/_matrix/client/v1/ai/message/list', params)
      info(`[MatrixAI] 获取对话消息列表成功`)
      return result
    } catch (err) {
      logError(`[MatrixAI] 获取对话消息列表失败: ${err}`)
      throw this.handleError(err, 'messageListByConversationId', [])
    }
  }

  async modelPage(params?: { pageNo?: number; pageSize?: number }): Promise<AIModelListResponse> {
    try {
      const result = await this.httpRequest<AIModelListResponse>(Method.Get, '/_matrix/client/v1/ai/model/page', params)
      info(`[MatrixAI] 获取模型列表成功`)
      return result
    } catch (err) {
      logError(`[MatrixAI] 获取模型列表失败: ${err}`)
      throw this.handleError(err, 'modelPage', null)
    }
  }

  async getModelRemainingUsage(params: { modelId: string }): Promise<any> {
    try {
      const result = await this.httpRequest(Method.Get, '/_matrix/client/v1/ai/model/remaining_usage', params)
      info(`[MatrixAI] 获取模型剩余使用量成功`)
      return result
    } catch (err) {
      logError(`[MatrixAI] 获取模型剩余使用量失败: ${err}`)
      throw this.handleError(err, 'getModelRemainingUsage', null)
    }
  }

  async imageMyPage(params?: { pageNo?: number; pageSize?: number }): Promise<AIImageListResponse> {
    try {
      const result = await this.httpRequest<AIImageListResponse>(
        Method.Get,
        '/_matrix/client/v1/ai/image/my_page',
        params
      )
      info(`[MatrixAI] 获取我的图片列表成功`)
      return result
    } catch (err) {
      logError(`[MatrixAI] 获取我的图片列表失败: ${err}`)
      throw this.handleError(err, 'imageMyPage', null)
    }
  }

  async imageMyListByIds(params: { ids: string }): Promise<AIImage[]> {
    try {
      const result = await this.httpRequest<AIImage[]>(Method.Get, '/_matrix/client/v1/ai/image/my_list_by_ids', params)
      info(`[MatrixAI] 根据ID列表获取图片成功`)
      return result
    } catch (err) {
      logError(`[MatrixAI] 根据ID列表获取图片失败: ${err}`)
      throw this.handleError(err, 'imageMyListByIds', [])
    }
  }

  async videoMyPage(params?: { pageNo?: number; pageSize?: number }): Promise<AIVideoListResponse> {
    try {
      const result = await this.httpRequest<AIVideoListResponse>(
        Method.Get,
        '/_matrix/client/v1/ai/video/my_page',
        params
      )
      info(`[MatrixAI] 获取我的视频列表成功`)
      return result
    } catch (err) {
      logError(`[MatrixAI] 获取我的视频列表失败: ${err}`)
      throw this.handleError(err, 'videoMyPage', null)
    }
  }

  async videoMyListByIds(params: { ids: string }): Promise<AIVideo[]> {
    try {
      const result = await this.httpRequest<AIVideo[]>(Method.Get, '/_matrix/client/v1/ai/video/my_list_by_ids', params)
      info(`[MatrixAI] 根据ID列表获取视频成功`)
      return result
    } catch (err) {
      logError(`[MatrixAI] 根据ID列表获取视频失败: ${err}`)
      throw this.handleError(err, 'videoMyListByIds', [])
    }
  }

  async videoGenerate(body: any): Promise<any> {
    try {
      const result = await this.httpRequest(Method.Post, '/_matrix/client/v1/ai/video/generate', undefined, body)
      info(`[MatrixAI] 请求视频生成成功`)
      return result
    } catch (err) {
      logError(`[MatrixAI] 请求视频生成失败: ${err}`)
      throw this.handleError(err, 'videoGenerate', null)
    }
  }

  async audioMyPage(params?: { pageNo?: number; pageSize?: number }): Promise<AIAudioListResponse> {
    try {
      const result = await this.httpRequest<AIAudioListResponse>(
        Method.Get,
        '/_matrix/client/v1/ai/audio/my_page',
        params
      )
      info(`[MatrixAI] 获取我的音频列表成功`)
      return result
    } catch (err) {
      logError(`[MatrixAI] 获取我的音频列表失败: ${err}`)
      throw this.handleError(err, 'audioMyPage', null)
    }
  }

  async audioMyListByIds(params: { ids: string }): Promise<AIAudio[]> {
    try {
      const result = await this.httpRequest<AIAudio[]>(Method.Get, '/_matrix/client/v1/ai/audio/my_list_by_ids', params)
      info(`[MatrixAI] 根据ID列表获取音频成功`)
      return result
    } catch (err) {
      logError(`[MatrixAI] 根据ID列表获取音频失败: ${err}`)
      throw this.handleError(err, 'audioMyListByIds', [])
    }
  }

  async audioGenerate(body: any): Promise<any> {
    try {
      const result = await this.httpRequest(Method.Post, '/_matrix/client/v1/ai/audio/generate', undefined, body)
      info(`[MatrixAI] 请求音频生成成功`)
      return result
    } catch (err) {
      logError(`[MatrixAI] 请求音频生成失败: ${err}`)
      throw this.handleError(err, 'audioGenerate', null)
    }
  }

  async audioGetVoices(params: { model: string }): Promise<AIVoice[]> {
    try {
      const result = await this.httpRequest<AIVoice[]>(Method.Get, '/_matrix/client/v1/ai/audio/voices', params)
      info(`[MatrixAI] 获取语音列表成功`)
      return result
    } catch (err) {
      logError(`[MatrixAI] 获取语音列表失败: ${err}`)
      throw this.handleError(err, 'audioGetVoices', [])
    }
  }

  async messageDelete(params: { id: string }): Promise<boolean> {
    try {
      await this.httpRequest(Method.Post, '/_matrix/client/v1/ai/message/delete', undefined, params)
      info(`[MatrixAI] 删除消息成功: ${params.id}`)
      return true
    } catch (err) {
      logError(`[MatrixAI] 删除消息失败: ${err}`)
      throw this.handleError(err, 'messageDelete', false)
    }
  }

  async messageDeleteByConversationId(params: { conversationIdList: string[] }): Promise<boolean> {
    try {
      await this.httpRequest(Method.Post, '/_matrix/client/v1/ai/message/delete_by_conversation', undefined, params)
      info(`[MatrixAI] 删除会话所有消息成功`)
      return true
    } catch (err) {
      logError(`[MatrixAI] 删除会话所有消息失败: ${err}`)
      throw this.handleError(err, 'messageDeleteByConversationId', false)
    }
  }

  async chatRolePage(params?: { pageNo?: number; pageSize?: number }): Promise<AIChatRoleListResponse> {
    try {
      const result = await this.httpRequest<AIChatRoleListResponse>(
        Method.Get,
        '/_matrix/client/v1/ai/chatrole/page',
        params
      )
      info(`[MatrixAI] 获取聊天角色列表成功`)
      return result
    } catch (err) {
      logError(`[MatrixAI] 获取聊天角色列表失败: ${err}`)
      throw this.handleError(err, 'chatRolePage', null)
    }
  }
}

export const matrixAIService = new MatrixAIService()
export default matrixAIService
