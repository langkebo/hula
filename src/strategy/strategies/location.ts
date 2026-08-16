import type { Ref } from 'vue'
import { AppException } from '@/common/exception.ts'
import { MessageStatusEnum, MsgEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat/message'
import { useGroupStore } from '@/stores/domains/chat/group'
import { AbstractMessageStrategy, type ReplyRef } from './base'

/**
 * 处理位置消息的策略
 */
export class LocationMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.LOCATION)
  }

  /**
   * 构建位置消息对象
   * @param msgInputValue 位置数据JSON字符串
   * @param replyValue 回复信息
   * @returns 位置消息对象
   */
  getMsg(msgInputValue: string, replyValue: MessageType | null): Record<string, unknown> {
    try {
      // 解析位置数据
      const locationData = JSON.parse(msgInputValue)

      // 验证必要字段
      if (!locationData.latitude || !locationData.longitude || !locationData.address) {
        throw new AppException('无效的位置数据，缺少必要字段')
      }

      return {
        type: this.msgType,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        address: locationData.address,
        precision: locationData.precision || '高精度',
        timestamp: locationData.timestamp || Date.now(),
        reply: replyValue?.message?.body?.content
          ? {
              content: replyValue.message.body.content,
              key: replyValue.message.id
            }
          : undefined
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new AppException('位置数据格式错误，必须是有效的JSON')
      }
      throw error
    }
  }

  /**
   * 构建消息体
   * @param msg 位置消息对象
   * @param reply 回复信息
   * @returns 消息体
   */
  buildMessageBody(msg: Record<string, unknown>, reply: MessageType | null): Record<string, unknown> {
    const latitude = String(msg.latitude)
    const longitude = String(msg.longitude)
    const address = String(msg.address)
    const precision = String(msg.precision ?? '高精度')
    const timestamp = String(msg.timestamp ?? Date.now())
    return {
      geo_uri: `geo:${latitude},${longitude};u=${precision === '高精度' ? 10 : 100}`,
      msgtype: 'm.location',
      body: `位置: ${address}`,
      // 本地回显回填 LocationBody（其 latitude/longitude/address/precision/timestamp 均为 string）
      latitude,
      longitude,
      address,
      precision,
      timestamp,
      info: {
        address,
        timestamp
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

  buildMessageType(
    messageId: string,
    messageBody: Record<string, unknown>,
    globalStore: { currentSessionRoomId: string },
    userUid: Ref<string>
  ): MessageType {
    const groupStore = useGroupStore()
    const userInfo = groupStore.getUserInfo(userUid.value)

    return {
      clientKey: messageId,
      fromUser: {
        uid: userUid.value || '',
        username: userInfo?.name || '',
        avatar: userInfo?.avatar || ''
      },
      message: {
        id: messageId,
        roomId: globalStore.currentSessionRoomId,
        sendTime: Date.now(),
        status: MessageStatusEnum.PENDING,
        type: this.msgType,
        body: messageBody,
        messageMarks: {}
      },
      sendTime: Date.now(),
      loading: false
    }
  }
}
