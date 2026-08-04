import type { UploadOptions, UploadProviderEnum } from '@/composables/common/useUpload'
import { MsgEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat/message'
import { AbstractMessageStrategy, type CallInfo } from './base'

export class AudioCallMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.AUDIO_CALL)
  }

  getMsg(_msgInputValue: string, _replyValue: MessageType | null, _fileList?: File[]): Record<string, unknown> {
    const callInfo = _replyValue as unknown as CallInfo
    return {
      type: this.msgType,
      duration: callInfo.duration,
      reason: callInfo.reason,
      startTime: callInfo.startTime,
      endTime: callInfo.endTime,
      creator: callInfo.creator,
      isGroup: callInfo.isGroup
    }
  }

  buildMessageBody(msg: Record<string, unknown>, _reply?: MessageType | null): Record<string, unknown> {
    return {
      duration: msg.duration,
      reason: msg.reason,
      startTime: msg.startTime,
      endTime: msg.endTime,
      creator: msg.creator,
      isGroup: msg.isGroup
    }
  }

  async uploadFile(
    _path: string,
    _options?: { provider?: UploadProviderEnum }
  ): Promise<{ uploadUrl: string; downloadUrl: string }> {
    return {
      uploadUrl: '',
      downloadUrl: ''
    }
  }

  async doUpload(_path: string, _uploadUrl: string, _options?: UploadOptions): Promise<void> {
    return Promise.resolve()
  }
}
