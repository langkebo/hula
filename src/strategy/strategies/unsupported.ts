import type { Ref } from 'vue'
import { AppException } from '@/common/exception.ts'
import { MsgEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat/message'
import { AbstractMessageStrategy } from './base'

export class UnsupportedMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.UNKNOWN)
  }

  getMsg(_msgInputValue: string, _replyValue: MessageType | null, _fileList?: File[]): Record<string, unknown> {
    throw new AppException('暂不支持该类型消息')
  }

  buildMessageBody(_msg: Record<string, unknown>, _reply: MessageType | null): Record<string, unknown> {
    throw new AppException('方法暂未实现')
  }

  buildMessageType(
    _messageId: string,
    _messageBody: Record<string, unknown>,
    _globalStore: { currentSessionRoomId: string },
    _userUid: Ref<string>
  ): MessageType {
    throw new AppException('方法暂未实现')
  }
}
