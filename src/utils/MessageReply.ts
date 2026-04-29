import { MsgEnum } from '@/enums'
import type { MsgType } from '@/services/types'
import type { MessageType } from '@/stores/domains/chat/chat'

const getBodyRecord = (message: MsgType | MessageType['message']): Record<string, unknown> => {
  const body = message.body
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
}

/**
 * 根据消息类型获取回复内容
 * @param message 消息对象
 * @returns 格式化后的回复内容
 */
export const getReplyContent = (message: MsgType | MessageType['message']): string => {
  let content: string
  const bodyRecord = getBodyRecord(message)

  // 根据消息类型确定回复内容
  switch (message.type) {
    case MsgEnum.TEXT: {
      // 文本消息：显示原内容，处理&nbsp;
      content = typeof bodyRecord.content === 'string' ? bodyRecord.content : ''
      if (typeof content === 'string') {
        content = content.replace(/&nbsp;/g, ' ')
      }
      break
    }

    case MsgEnum.VIDEO: {
      // 视频消息：使用缩略图URL或显示[视频]
      content = typeof bodyRecord.thumbUrl === 'string' ? bodyRecord.thumbUrl : '[视频]'
      break
    }

    case MsgEnum.VOICE: {
      // 语音消息：显示 "[语音] X秒"
      const seconds = typeof bodyRecord.second === 'number' ? bodyRecord.second : 0
      content = `[语音] ${seconds}秒`
      break
    }

    case MsgEnum.FILE: {
      // 文件消息：显示文件名
      content = `[文件] ${typeof bodyRecord.fileName === 'string' ? bodyRecord.fileName : ''}`
      break
    }

    case MsgEnum.IMAGE: {
      // 图片消息：使用图片URL
      content = typeof bodyRecord.url === 'string' ? bodyRecord.url : '[图片]'
      break
    }

    case MsgEnum.NOTICE: {
      // 公告消息：显示内容
      content = `[公告] ${typeof bodyRecord.content === 'string' ? bodyRecord.content : ''}`
      break
    }

    case MsgEnum.SYSTEM: {
      // 系统消息
      content = '[系统消息]'
      break
    }

    case MsgEnum.MERGE: {
      // 聊天记录
      content = '[聊天记录]'
      break
    }

    case MsgEnum.AI: {
      // AI消息
      content = `'[AI消息]'${typeof bodyRecord.content === 'string' ? bodyRecord.content : ''}`
      if (typeof content === 'string') {
        content = content.replace(/&nbsp;/g, ' ')
      }
      break
    }

    default: {
      // 其他类型：尝试获取content或url
      const rawContent =
        (typeof bodyRecord.content === 'string' && bodyRecord.content) ||
        (typeof bodyRecord.url === 'string' && bodyRecord.url) ||
        '[未知消息]'
      content = rawContent
      if (typeof content === 'string') {
        content = content.replace(/&nbsp;/g, ' ')
      }
      break
    }
  }

  return content
}
