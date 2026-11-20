/**
 * Conversation 域测试夹具。
 *
 * 类型来源是 `ConversationService` 自己的契约：
 * - `Conversation`：服务层具名导出，仅 `id` 必填；
 * - 分页壳 `{ list: Conversation[]; total: number }`：从 `page()` 签名推导；
 * - `Message` 未导出，从 `messageListByConversationId()` 的返回类型推导。
 */
import type { Conversation, conversationService } from '../../ConversationService'

export type ConversationPageFixture = Awaited<ReturnType<typeof conversationService.page>>
export type ConversationMessageFixture = Awaited<
  ReturnType<typeof conversationService.messageListByConversationId>
>[number]

export function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return { id: 'c1', ...overrides }
}

/** `page()` 的返回壳：`{ list, total }`。 */
export function makeConversationPage(overrides: Partial<ConversationPageFixture> = {}): ConversationPageFixture {
  return { list: [], total: 0, ...overrides }
}

export function makeConversationMessage(
  overrides: Partial<ConversationMessageFixture> = {}
): ConversationMessageFixture {
  return { id: 'msg1', conversationId: 'c1', role: 'user', content: 'hi', ...overrides }
}
