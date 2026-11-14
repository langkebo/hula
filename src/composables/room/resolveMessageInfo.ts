import { matrixMessageService } from '@/services/matrix/messaging/MatrixMessageService'
import { roomOperations } from '@/services/matrix/room/RoomOperations'
import { useChatStore } from '@/stores/domains/chat/chat'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('resolveMessageInfo')

/** 消息摘要（纯文本展示用），置顶与粘性事件共用 */
export interface MessageInfo {
  eventId: string
  sender: string
  body: string
  timestamp: number
  msgtype: string
}

/** 从消息体中提取纯文本摘要 */
export function extractMessageBody(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (typeof obj.content === 'string') return obj.content
    if (typeof obj.body === 'string') return obj.body
    if (typeof obj.text === 'string') return obj.text
  }
  return ''
}

/**
 * 解析单条消息摘要：
 * 1. 优先从 chat store 读取（已加载的消息）
 * 2. 回退到 MatrixMessageService.getRoomMessage
 */
export async function resolveMessageInfo(roomId: string, eventId: string): Promise<MessageInfo | null> {
  try {
    const chatStore = useChatStore()
    const cached = chatStore.getMessage(eventId)
    if (cached) {
      return {
        eventId: cached.message.id,
        sender: cached.fromUser.username || cached.fromUser.uid,
        body: extractMessageBody(cached.message.body),
        timestamp: cached.message.sendTime,
        msgtype: cached.message.body.msgtype ?? String(cached.message.type)
      }
    }
  } catch (err) {
    logger.warn('从 chat store 获取消息失败', err)
  }

  try {
    const event = await matrixMessageService.getRoomMessage(roomId, eventId)
    if (!event) return null
    const content = event.getContent() as Record<string, unknown>
    const senderId = event.getSender() ?? ''
    let senderName = senderId
    try {
      const name = await roomOperations.getMemberDisplayName(roomId, senderId)
      if (name) senderName = name
    } catch {
      /* 使用 senderId 作为兜底 */
    }
    return {
      eventId: event.getId() ?? eventId,
      sender: senderName,
      body: typeof content.body === 'string' ? content.body : '',
      timestamp: event.getTs(),
      msgtype: typeof content.msgtype === 'string' ? content.msgtype : ''
    }
  } catch (err) {
    logger.error(`解析消息 ${eventId} 失败`, err)
    return null
  }
}
