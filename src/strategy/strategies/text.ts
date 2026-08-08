import DOMPurify from 'dompurify'
import { AppException } from '@/common/exception.ts'
import { MsgEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat/message'
import { removeTag } from '@/utils/Formatting'
import { AbstractMessageStrategy, type ReplyRef } from './base'

export class TextMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.TEXT)
  }

  getMsg(msgInputValue: string, replyValue: MessageType | null): Record<string, unknown> {
    // 处理&nbsp;为空格
    let content = removeTag(msgInputValue)
    if (content && typeof content === 'string') {
      content = content.replace(/&nbsp;/g, ' ')
    }

    const msg: Record<string, unknown> = {
      type: this.msgType,
      content: content,
      reply: replyValue?.message?.body?.content
        ? {
            content: replyValue.message.body.content,
            key: replyValue.message.id
          }
        : undefined
    }
    // 处理回复内容
    if (replyValue?.message?.body?.content) {
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = DOMPurify.sanitize(msg.content as string)
      tempDiv.innerHTML = DOMPurify.sanitize(removeTag(tempDiv.innerHTML), { RETURN_DOM: false })

      // 确保所有的&nbsp;都被替换为空格
      msg.content = tempDiv.innerHTML
        .replace(/&nbsp;/g, ' ')
        .replace(/\n+/g, '\n')
        .trim()
    }
    // 验证消息长度
    if ((msg.content as string).length > 500) {
      throw new AppException('消息内容超过限制500，请分段发送')
    }
    return msg
  }

  buildMessageBody(msg: Record<string, unknown>, reply: MessageType | null): Record<string, unknown> {
    return {
      content: msg.content,
      msgtype: 'm.text',
      body: msg.content,
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
