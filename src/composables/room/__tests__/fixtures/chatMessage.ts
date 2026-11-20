import { MsgEnum } from '@/enums'
import type { MessageType } from '@/types/message'

/**
 * chat store 缓存消息（`useChatStore().getMessage` 的返回值）。
 *
 * 结构真值来自 `@/types/message` 的 `MessageType`：`message.type` 是 `MsgEnum`，
 * 不是裸字符串；`body` 承载 content/msgtype。
 */
export function makeCachedChatMessage(overrides: Partial<MessageType> = {}): MessageType {
  return {
    message: {
      id: '$e1:s',
      roomId: '!r:s',
      sendTime: 2000,
      type: MsgEnum.TEXT,
      body: { content: 'cached body', msgtype: 'm.text' }
    },
    fromUser: { uid: '@alice:s', username: 'Alice' },
    ...overrides
  }
}
