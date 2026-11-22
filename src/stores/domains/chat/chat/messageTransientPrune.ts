import type { MessageType } from './types'

/**
 * 只保留处于瞬时状态（pending/sending/failed）的消息条目。
 *
 * `clearOtherRoomsMessages` / `clearRoomMessagesExceptTransient` 共用：
 * 按排序键过滤消息表，并同步产出新的排序键数组，避免两处各写一遍循环。
 */
export function pruneToTransientMessages(
  roomMessages: Record<string, MessageType>,
  sortedKeys: string[],
  isTransient: (msg?: MessageType) => boolean
): { messages: Record<string, MessageType>; keys: string[] } {
  const messages: Record<string, MessageType> = {}
  const keys: string[] = []
  for (const msgId of sortedKeys) {
    const msg = roomMessages[msgId]
    if (isTransient(msg)) {
      messages[msgId] = msg
      keys.push(msgId)
    }
  }
  return { messages, keys }
}
