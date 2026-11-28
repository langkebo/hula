import DOMPurify from 'dompurify'
import { AppException } from '@/common/exception.ts'
import { MsgEnum } from '@/enums'
import { removeTag } from '@/utils/Formatting'
import { AbstractMessageStrategy, type ReplyInput, type ReplyRef, resolveReplyTarget } from './base'

export class TextMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.TEXT)
  }

  getMsg(msgInputValue: string, replyValue: ReplyInput | null): Record<string, unknown> {
    const replyTarget = resolveReplyTarget(replyValue)
    // 处理&nbsp;为空格
    let content = removeTag(msgInputValue)
    if (content && typeof content === 'string') {
      content = content.replace(/&nbsp;/g, ' ')
    }

    const msg: Record<string, unknown> = {
      type: this.msgType,
      content: content,
      reply: replyTarget ? { content: replyTarget.content, key: replyTarget.key } : undefined
    }
    // 处理回复内容
    if (replyTarget) {
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

  buildMessageBody(msg: Record<string, unknown>, reply: ReplyInput | null): Record<string, unknown> {
    const replyTarget = resolveReplyTarget(reply)
    return {
      content: msg.content,
      msgtype: 'm.text',
      body: msg.content,
      replyMsgId: (msg.reply as ReplyRef | undefined)?.key || void 0,
      reply: replyTarget
        ? {
            body: replyTarget.content,
            id: replyTarget.key,
            username: replyTarget.username,
            type: msg.type as string
          }
        : void 0
    }
  }
}
