import { AppException } from '@/common/exception.ts'
import type { UploadOptions, UploadProviderEnum } from '@/composables/common/useUpload'
import { MsgEnum } from '@/enums'
import {
  AbstractMessageStrategy,
  strategyLogger as logger,
  type ReplyInput,
  type ReplyRef,
  resolveReplyTarget
} from './base'

export class EmojiMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.EMOJI)
  }

  // 验证是否是有效的表情包URL
  private isValidEmojiUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  getMsg(msgInputValue: string, replyValue: ReplyInput | null): Record<string, unknown> {
    const replyTarget = resolveReplyTarget(replyValue)
    // 检查是否是URL
    if (!this.isValidEmojiUrl(msgInputValue)) {
      throw new AppException('无效的表情包URL')
    }

    return {
      type: this.msgType,
      url: msgInputValue,
      path: msgInputValue,
      reply: replyTarget ? { content: replyTarget.content, key: replyTarget.key } : undefined
    }
  }

  buildMessageBody(msg: Record<string, unknown>, reply: ReplyInput | null): Record<string, unknown> {
    const replyTarget = resolveReplyTarget(reply)
    return {
      url: msg.url as string,
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

  async uploadFile(
    path: string,
    options?: { provider?: UploadProviderEnum }
  ): Promise<{ uploadUrl: string; downloadUrl: string }> {
    logger.debug('表情包使用原始URL:', path, options)
    return {
      uploadUrl: '',
      downloadUrl: path
    }
  }

  async doUpload(path?: string, uploadUrl?: string, options?: UploadOptions): Promise<void> {
    logger.debug('表情包无需上传，跳过上传步骤', path, uploadUrl, options)
    return Promise.resolve()
  }
}
