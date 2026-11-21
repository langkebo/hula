/**
 * AI 媒体生成的请求/响应类型。
 *
 * 从 `AIService` 抽出，供 `aiMediaApi` 与门面共用；`AIService` 继续重导出，
 * 保证既有 `import type { VideoGenerationRequest } from '@/services/matrix/ai/AIService'` 不变。
 */

/**
 * 供应商特有的生成参数：键由具体模型 / 供应商决定，透传给后端，属真·动态包。
 */
export interface AIGenerationOptions {
  [option: string]: unknown
}

export interface ImageGenerationRequest {
  modelId: string
  prompt: string
  width?: number
  height?: number
  conversationId?: string
  options?: AIGenerationOptions
  [key: string]: unknown
}

export interface ImageGenerationResult {
  id: string
  url?: string
  status?: number
}

export interface VideoGenerationRequest {
  modelId?: string
  prompt: string
  width?: number
  height?: number
  duration?: number
  conversationId?: string
  options?: AIGenerationOptions
  [key: string]: unknown
}

export interface AudioGenerationRequest {
  modelId?: string | number
  prompt: string
  conversationId?: string
  options?: AIGenerationOptions
  [key: string]: unknown
}

export type AIAsyncGenerationResponse = number | string | { id?: number | string; url?: string; status?: number }
