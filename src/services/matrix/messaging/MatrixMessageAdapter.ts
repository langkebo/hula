import type { MatrixEvent } from 'matrix-js-sdk'
import { MsgEnum, MessageStatusEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat'
import type { MessageBody, TextBody, ImageBody, VideoBody, FileBody, VoiceBody } from '@/services/types'

export interface MatrixMessageAdapter {
  convertMatrixEventToMessageType(event: MatrixEvent, roomId: string): MessageType
  getMsgTypeFromMatrixEvent(event: MatrixEvent): MsgEnum
  getMsgTypeFromEventLike(eventType: string, content: Record<string, unknown>): MsgEnum
  convertMatrixContent(content: Record<string, unknown>, msgType: MsgEnum): MessageBody
}

export const matrixMessageAdapter: MatrixMessageAdapter = {
  convertMatrixEventToMessageType(event: MatrixEvent, roomId: string): MessageType {
    const sender = event.getSender() ?? ''
    const senderMember = event.sender
    const content = event.getContent() as Record<string, unknown>
    const msgType = this.getMsgTypeFromMatrixEvent(event)

    return {
      fromUser: {
        uid: sender,
        username: senderMember?.name || sender.split(':')[0],
        avatar: senderMember?.getMxcAvatarUrl?.() || '',
        locPlace: ''
      },
      message: {
        id: event.getId() || '',
        roomId,
        type: msgType,
        body: this.convertMatrixContent(content, msgType) as MessageType['message']['body'],
        sendTime: event.getTs(),
        messageMarks: {}, // Matrix SDK handles marks differently, initializing empty
        status: MessageStatusEnum.SUCCESS // Assuming success for received events
      },
      sendTime: event.getTs(),
      loading: false
    }
  },

  getMsgTypeFromMatrixEvent(event: MatrixEvent): MsgEnum {
    return this.getMsgTypeFromEventLike(event.getType(), event.getContent() as Record<string, unknown>)
  },

  getMsgTypeFromEventLike(eventType: string, content: Record<string, unknown>): MsgEnum {
    if (eventType === 'm.room.redaction') {
      return MsgEnum.RECALL
    }

    if (eventType === 'm.room.member') {
      return MsgEnum.SYSTEM
    }

    if (eventType === 'm.beacon_info' || eventType === 'm.beacon') {
      return MsgEnum.BEACON
    }

    if (eventType === 'm.room.message' || eventType === 'm.room.encrypted') {
      const msgtype = content.msgtype

      if (content['org.matrix.msc2788.room.message']) {
        return MsgEnum.LINK_PREVIEW
      }

      switch (msgtype) {
        case 'm.text':
        case 'm.notice':
          return MsgEnum.TEXT
        case 'm.image':
          return MsgEnum.IMAGE
        case 'm.video':
          return MsgEnum.VIDEO
        case 'm.audio':
        case 'm.voice':
          return MsgEnum.VOICE
        case 'm.file':
          return MsgEnum.FILE
        case 'm.location':
          return MsgEnum.LOCATION
        default:
          return MsgEnum.UNKNOWN
      }
    }

    return MsgEnum.UNKNOWN
  },

  convertMatrixContent(content: Record<string, unknown>, msgType: MsgEnum): MessageBody {
    const info = (content.info || {}) as {
      size?: number
      w?: number
      h?: number
      mimetype?: string
      duration?: number
      thumbnail_info?: { w?: number; h?: number }
      thumbnail_url?: string
      [key: string]: unknown
    }

    switch (msgType) {
      case MsgEnum.TEXT:
        return {
          content: (content.body as string) || ''
        } as TextBody
      case MsgEnum.IMAGE:
        return {
          size: info.size || 0,
          width: info.w || 0,
          height: info.h || 0,
          mimetype: info.mimetype || '',
          url: (content.url as string) || ''
        } as ImageBody
      case MsgEnum.VIDEO:
        return {
          size: info.size || 0,
          duration: info.duration || 0,
          thumbWidth: info.thumbnail_info?.w || 0,
          thumbHeight: info.thumbnail_info?.h || 0,
          mimetype: info.mimetype || '',
          url: (content.url as string) || '',
          thumbUrl: info.thumbnail_url || '',
          filename: (content.body as string) || ''
        } as VideoBody
      case MsgEnum.VOICE:
        return {
          size: info.size || 0,
          second: info.duration || 0,
          url: (content.url as string) || ''
        } as VoiceBody
      case MsgEnum.FILE:
        return {
          size: info.size || 0,
          fileName: (content.body as string) || '',
          url: (content.url as string) || ''
        } as FileBody
      default:
        return {
          content: typeof content.body === 'string' ? content.body : JSON.stringify(content)
        } as TextBody
    }
  }
}

export default matrixMessageAdapter
