import { MsgEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat/message'
import { AppException } from '@/common/exception.ts'
import { AbstractMessageStrategy, type ReplyRef } from './base'

/**
 * 链接预览消息
 */
export class LinkPreviewMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.LINK_PREVIEW)
  }

  getMsg(msgInputValue: string, replyValue: MessageType | null): Record<string, unknown> {
    try {
      const linkData = JSON.parse(msgInputValue)

      if (!linkData.url || !linkData.title) {
        throw new AppException('无效的链接预览数据，缺少必要字段')
      }

      return {
        type: this.msgType,
        url: linkData.url,
        title: linkData.title,
        description: linkData.description || '',
        imageUrl: linkData.imageUrl || '',
        siteName: linkData.siteName || '',
        reply: replyValue?.message?.body?.content
          ? {
              content: replyValue.message.body.content,
              key: replyValue.message.id
            }
          : undefined
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new AppException('链接数据格式错误，必须是有效的JSON')
      }
      throw error
    }
  }

  buildMessageBody(msg: Record<string, unknown>, reply: MessageType | null): Record<string, unknown> {
    return {
      msgtype: 'm.text',
      body: msg.url as string,
      format: 'org.matrix.custom.html',
      formatted_body: `<a href="${msg.url}">${msg.title}</a>`,
      'org.matrix.msc2788.room.message': {
        url: msg.url,
        title: msg.title,
        description: msg.description,
        image_url: msg.imageUrl,
        site_name: msg.siteName
      },
      replyMsgId: (msg.reply as ReplyRef | undefined)?.key || void 0,
      reply: reply?.message?.body?.content
        ? {
            body: reply.message.body.content,
            id: reply.message.id,
            username: reply.fromUser.username,
            type: msg.type as string
          }
        : void 0
    }
  }
}
