import { matrixExtensionEndpoints } from '@/services/backend'
import { matrixHttpClient } from '@/services/matrix/MatrixHttpClient'
import type {
  AIAudio,
  AIAudioListResponse,
  AIImage,
  AIImageListResponse,
  AIVideo,
  AIVideoListResponse,
  AIVoice
} from '@/types/matrix-api'
import type {
  AIAsyncGenerationResponse,
  AudioGenerationRequest,
  ImageGenerationRequest,
  ImageGenerationResult,
  VideoGenerationRequest
} from './aiMediaTypes'

/**
 * AI 媒体生成 API（图片 / 视频 / 语音）。
 *
 * 从 `AIService` 抽出：这些方法只做「构造请求 + 透传后端扩展端点」，
 * 与对话/消息/模型域无共享状态，独立成模块后两块可分别演进。
 * 门面 `aiService` 保留同名方法做单行委托，对外 API 不变。
 */

export async function generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult | number | string> {
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

export async function imageMyPage(params?: { pageNo?: number; pageSize?: number }): Promise<AIImageListResponse> {
  return matrixHttpClient.request<AIImageListResponse>(
    {
      url: matrixExtensionEndpoints.IMAGE_MY_PAGE,
      ...(params !== undefined ? { params } : {})
    },
    undefined,
    { logPrefix: 'MatrixAI' }
  )
}

/**
 * 按 ID 列表批量查询当前用户的图片记录。
 *
 * @param params - 查询参数
 * @param params.ids - 逗号分隔的图片 ID 串
 * @returns 图片列表
 */
export async function imageMyListByIds(params: { ids: string }): Promise<AIImage[]> {
  return matrixHttpClient.request<AIImage[]>(
    {
      url: matrixExtensionEndpoints.IMAGE_MY_LIST_BY_IDS,
      params
    },
    undefined,
    { logPrefix: 'MatrixAI' }
  )
}

/**
 * 分页查询当前用户的视频生成记录。
 *
 * @param params - 分页参数
 * @param params.pageNo - 页码
 * @param params.pageSize - 每页数量
 * @returns 视频列表与总数
 */
export async function videoMyPage(params?: { pageNo?: number; pageSize?: number }): Promise<AIVideoListResponse> {
  return matrixHttpClient.request<AIVideoListResponse>(
    {
      url: matrixExtensionEndpoints.VIDEO_MY_PAGE,
      ...(params !== undefined ? { params } : {})
    },
    undefined,
    { logPrefix: 'MatrixAI' }
  )
}

/**
 * 按 ID 列表批量查询当前用户的视频记录。
 *
 * @param params - 查询参数
 * @param params.ids - 逗号分隔的视频 ID 串
 * @returns 视频列表
 */
export async function videoMyListByIds(params: { ids: string }): Promise<AIVideo[]> {
  return matrixHttpClient.request<AIVideo[]>(
    {
      url: matrixExtensionEndpoints.VIDEO_MY_LIST_BY_IDS,
      params
    },
    undefined,
    { logPrefix: 'MatrixAI' }
  )
}

/**
 * 发起视频生成任务。
 *
 * 返回异步任务信息，结果需另行轮询查询。
 *
 * @param body - 视频生成参数
 * @returns 异步任务响应
 */
export async function videoGenerate(body: VideoGenerationRequest): Promise<AIAsyncGenerationResponse> {
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

/**
 * 分页查询当前用户的音频生成记录。
 *
 * @param params - 分页参数
 * @param params.pageNo - 页码
 * @param params.pageSize - 每页数量
 * @returns 音频列表与总数
 */
export async function audioMyPage(params?: { pageNo?: number; pageSize?: number }): Promise<AIAudioListResponse> {
  return matrixHttpClient.request<AIAudioListResponse>(
    {
      url: matrixExtensionEndpoints.AUDIO_MY_PAGE,
      ...(params !== undefined ? { params } : {})
    },
    undefined,
    { logPrefix: 'MatrixAI' }
  )
}

/**
 * 按 ID 列表批量查询当前用户的音频记录。
 *
 * @param params - 查询参数
 * @param params.ids - 逗号分隔的音频 ID 串
 * @returns 音频列表
 */
export async function audioMyListByIds(params: { ids: string }): Promise<AIAudio[]> {
  return matrixHttpClient.request<AIAudio[]>(
    {
      url: matrixExtensionEndpoints.AUDIO_MY_LIST_BY_IDS,
      params
    },
    undefined,
    { logPrefix: 'MatrixAI' }
  )
}

/**
 * 发起音频生成任务。
 *
 * 返回异步任务信息，结果需另行轮询查询。
 *
 * @param body - 音频生成参数
 * @returns 异步任务响应
 */
export async function audioGenerate(body: AudioGenerationRequest): Promise<AIAsyncGenerationResponse> {
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

/**
 * 查询指定模型支持的音色列表。
 *
 * @param params - 查询参数
 * @param params.model - 模型 ID
 * @returns 音色列表
 */
export async function audioGetVoices(params: { model: string }): Promise<AIVoice[]> {
  return matrixHttpClient.request<AIVoice[]>(
    {
      url: matrixExtensionEndpoints.AUDIO_VOICES,
      params
    },
    undefined,
    { logPrefix: 'MatrixAI' }
  )
}
