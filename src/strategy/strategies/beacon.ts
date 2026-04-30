import { AppException } from '@/common/exception.ts'
import { MsgEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat/message'
import { AbstractMessageStrategy, type ReplyRef } from './base'

/**
 * 处理 Beacon 位置信标消息
 */
export class BeaconMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.BEACON)
  }

  getMsg(msgInputValue: string, replyValue: MessageType | null): Record<string, unknown> {
    try {
      const beaconData = JSON.parse(msgInputValue)

      if (!beaconData.description || beaconData.timeout === undefined || beaconData.isLive === undefined) {
        throw new AppException('无效的信标数据，缺少必要字段')
      }

      return {
        type: this.msgType,
        description: beaconData.description,
        timeout: beaconData.timeout,
        isLive: beaconData.isLive,
        reply: replyValue?.message?.body?.content
          ? {
              content: replyValue.message.body.content,
              key: replyValue.message.id
            }
          : undefined
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new AppException('信标数据格式错误，必须是有效的JSON')
      }
      throw error
    }
  }

  buildMessageBody(msg: Record<string, unknown>, reply: MessageType | null): Record<string, unknown> {
    return {
      description: msg.description,
      timeout: msg.timeout,
      live: msg.isLive,
      // Matrix 规定的信标资产类型，通常是 'm.self' (自己的位置) 或 'm.pin' (放置的图钉)
      'org.matrix.msc3488.asset': {
        type: 'm.self'
      },
      // 必须包含一个初始的位置点以便向后兼容
      'org.matrix.msc3488.ts': Date.now(),
      msgtype: 'm.beacon_info',
      body: `开启了位置共享: ${msg.description}`,
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
