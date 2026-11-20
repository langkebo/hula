/**
 * AI 域测试夹具。
 *
 * 类型来源全部是**已有的真实类型**：
 * - `AIConversation` / `AIMessage`：`AIService` 的公开方法签名（`AIMessage` 未导出，从方法返回推导）；
 * - 媒体/分页类型：`@/types/matrix-api` 与 `aiMediaTypes` 的具名导出。
 *
 * 手写字面量的偏差（如 `generateImage` 漏 `id`、`audioGetVoices` 漏 `language`/`gender`）
 * 会被 `vue-tsc` 直接拦下。
 */
import type { MatrixClient } from 'matrix-js-sdk'
import type { aiService } from '@/services/matrix/ai/AIService'
import type { ImageGenerationResult } from '@/services/matrix/ai/aiMediaTypes'
import type { modelService } from '@/services/matrix/ai/ModelService'
import type { AIModelListResponse, AIVoice } from '@/types/matrix-api'

export type AIConversationFixture = Awaited<ReturnType<typeof aiService.conversationCreate>>
export type AIMessageFixture = Awaited<ReturnType<typeof aiService.messageListByConversationId>>[number]
/** `ModelService.page` / `update` 的返回类型；`AIModel` 的 8 个必填键由此收口。 */
export type AIModelFixture = Awaited<ReturnType<typeof modelService.update>>
export type AIModelPageFixture = Awaited<ReturnType<typeof modelService.page>>

/** 五种分页接口（model / image / video / audio / chatRole）共同的空页形状。 */
export type AiEmptyPageFixture = Pick<AIModelListResponse, 'list' | 'total'>

export function makeAIConversation(overrides: Partial<AIConversationFixture> = {}): AIConversationFixture {
  return { id: 'c1', title: 'Conversation', ...overrides }
}

export function makeAIMessage(overrides: Partial<AIMessageFixture> = {}): AIMessageFixture {
  return { id: 'm1', conversationId: 'c1', role: 'user', content: 'hi', ...overrides }
}

export function makeEmptyAiPageResponse(): AiEmptyPageFixture {
  return { list: [], total: 0 }
}

export function makeAIModel(overrides: Partial<AIModelFixture> = {}): AIModelFixture {
  return {
    id: 'm1',
    name: 'GPT',
    model: 'gpt-4o',
    platform: 'openai',
    type: 0,
    sort: 0,
    status: 1,
    publicStatus: 0,
    ...overrides
  }
}

export function makeAIModelPage(overrides: Partial<AIModelPageFixture> = {}): AIModelPageFixture {
  return { list: [], total: 0, ...overrides }
}

/** `generateImage` 的结果是 `ImageGenerationResult | number | string`；这里取具名对象形态。 */
export function makeImageGenerationResult(overrides: Partial<ImageGenerationResult> = {}): ImageGenerationResult {
  return { id: 'img-1', url: 'https://i.example.com/x.png', ...overrides }
}

export function makeAIVoice(overrides: Partial<AIVoice> = {}): AIVoice {
  return { id: 'v1', name: 'Alice', language: 'zh-CN', gender: 'female', ...overrides }
}

/**
 * 流式用例只校验「客户端是否非空」：`messageSendStream` 拿到 client 后不再调用其任何方法。
 * 用 `MatrixClient` 类型收口，避免测试里散落 `as unknown as Record<string, unknown>`。
 */
export function makeMatrixClientStub(): MatrixClient {
  return {} as MatrixClient
}
