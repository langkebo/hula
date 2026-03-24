/**
 * Message Store 辅助函数
 * 消息转换、格式化等工具函数
 */
import type { MatrixEvent } from 'matrix-js-sdk'
import { MsgEnum } from '@/enums'
import type { MessageType } from './types'

/**
 * 将 Matrix 事件转换为消息类型
 */
export function convertEventToMessage(event: MatrixEvent, _room: any): MessageType | null {
  try {
    const content = event.getContent() as any
    const sender = event.sender as any
    const eventId = event.getId()

    if (!eventId) return null

    const msgType = content.msgtype as MsgEnum
    const body = content.body

    const message: MessageType = {
      message: {
        id: eventId,
        roomId: event.getRoomId() || '',
        sendTime: event.getOriginServerTs() || Date.now(),
        type: msgType || MsgEnum.TEXT,
        body,
        status: 'sent' as any,
        burnAfterRead: !!content['burn_after_read']
      },
      fromUser: {
        uid: sender?.userId || '',
        username: sender?.name,
        avatar: sender?.avatarUrl
      }
    }

    // 处理不同消息类型
    if (msgType === MsgEnum.IMAGE) {
      message.message.body = {
        url: content.url,
        thumbnailUrl: content.thumbnailUrl,
        width: content.info?.w,
        height: content.info?.h,
        size: content.info?.size,
        mimeType: content.info?.mimetype
      }
    } else if (msgType === MsgEnum.VIDEO) {
      message.message.body = {
        url: content.url,
        thumbnailUrl: content.thumbnailUrl,
        width: content.info?.w,
        height: content.info?.h,
        duration: content.info?.duration,
        size: content.info?.size,
        mimeType: content.info?.mimetype
      }
    } else if (msgType === MsgEnum.FILE) {
      message.message.body = {
        url: content.url,
        fileName: content.filename || body,
        size: content.info?.size,
        mimeType: content.info?.mimetype
      }
    } else if (msgType === MsgEnum.AUDIO) {
      message.message.body = {
        url: content.url,
        duration: content.info?.duration,
        size: content.info?.size,
        mimeType: content.info?.mimetype
      }
    }

    // 处理回复
    if (content['m.relates_to']?.['m.in_reply_to']) {
      message.message.body = {
        ...message.message.body,
        replyId: content['m.relates_to']['m.in_reply_to'].event_id,
        replyMsg: content['m.relates_to'].reply_text
      }
    }

    return message
  } catch (error) {
    console.error('[convertEventToMessage] Error:', error)
    return null
  }
}

/**
 * 检查消息是否需要保留（临时消息）
 */
export function shouldKeepTransientMessage(msg?: MessageType): boolean {
  if (!msg) return false

  const type = msg.message?.type
  // 保留正在上传、正在销毁的消息
  return (
    msg.loading ||
    (msg.message?.isBurning ?? false) ||
    type === MsgEnum.IMAGE ||
    type === MsgEnum.VIDEO ||
    type === MsgEnum.FILE ||
    type === MsgEnum.VOICE
  )
}

/**
 * 清除指定房间除临时消息外的所有消息
 */
export function clearRoomMessagesExceptTransient(
  roomId: string,
  messageMap: Record<string, Record<string, MessageType>>
): Record<string, Record<string, MessageType>> {
  const roomMessages = messageMap[roomId]
  if (!roomMessages) return messageMap

  const filteredMessages: Record<string, MessageType> = {}

  for (const [msgId, msg] of Object.entries(roomMessages)) {
    if (shouldKeepTransientMessage(msg)) {
      filteredMessages[msgId] = msg
    }
  }

  return {
    ...messageMap,
    [roomId]: filteredMessages
  }
}

/**
 * 清除其他房间的消息（保留当前房间）
 */
export function clearOtherRoomsMessages(
  currentRoomId: string,
  messageMap: Record<string, Record<string, MessageType>>
): Record<string, Record<string, MessageType>> {
  const result: Record<string, Record<string, MessageType>> = {}
  result[currentRoomId] = messageMap[currentRoomId]
  return result
}

/**
 * 计算时间块
 * 用于消息分组显示
 */
export function calculateTimeBlock(timestamp: number, blockSize: number = 5 * 60 * 1000): number {
  return Math.floor(timestamp / blockSize) * blockSize
}

/**
 * 格式化消息时间显示
 */
export function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  const timeStr = date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })

  if (isToday) {
    return timeStr
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  if (isYesterday) {
    return `昨天 ${timeStr}`
  }

  return (
    date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric'
    }) + ` ${timeStr}`
  )
}

/**
 * 获取消息摘要
 */
export function getMessageSummary(message: MessageType): string {
  const type = message.message?.type
  const body = message.message?.body

  switch (type) {
    case MsgEnum.IMAGE:
      return '[图片]'
    case MsgEnum.VIDEO:
      return '[视频]'
    case MsgEnum.FILE:
      return `[文件: ${body?.fileName || '文件'}]`
    case MsgEnum.VOICE:
      return '[语音]'
    case MsgEnum.LOCATION:
      return '[位置]'
    case MsgEnum.BEACON:
      return '[实时位置共享]'
    default:
      return typeof body === 'string' ? body.slice(0, 50) : '[消息]'
  }
}

/**
 * 检查消息是否来自当前用户
 */
export function isOwnMessage(message: MessageType, currentUserId: string): boolean {
  return message.fromUser?.uid === currentUserId
}

/**
 * 检查消息是否可以撤回
 */
export function canRecallMessage(
  message: MessageType,
  currentUserId: string,
  expirationMs: number = 2 * 60 * 1000
): boolean {
  // 只有自己发送的消息可以撤回
  if (!isOwnMessage(message, currentUserId)) return false

  // 检查是否在撤回时限内
  const sendTime = message.message?.sendTime || message.sendTime || 0
  const elapsed = Date.now() - sendTime

  return elapsed < expirationMs
}

/**
 * 消息排序
 */
export function sortMessages(messages: MessageType[], ascending: boolean = true): MessageType[] {
  return [...messages].sort((a, b) => {
    const timeA = a.message?.sendTime || a.sendTime || 0
    const timeB = b.message?.sendTime || b.sendTime || 0
    return ascending ? timeA - timeB : timeB - timeA
  })
}
