import type { MatrixEvent } from 'matrix-js-sdk'
import { MessageStatusEnum, MsgEnum } from '@/enums'
import type { FileBody, ImageBody, MessageBody, TextBody, VideoBody, VoiceBody } from '@/services/types'
import type { MessageType } from '@/types/message'

interface MatrixMessageAdapter {
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
      clientKey: event.getId() || '',
      fromUser: {
        uid: sender,
        username: senderMember?.name || sender.split(':')[0],
        avatar: senderMember?.getMxcAvatarUrl?.() || ''
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
      thumbnail_file?: Record<string, unknown>
      [key: string]: unknown
    }
    const encryptedFile = content.file as Record<string, unknown> | undefined
    const mediaUrl = ((content.url as string | undefined) || (encryptedFile?.url as string | undefined) || '') as string

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
          fileName: (content.body as string) || '',
          url: mediaUrl,
          encryptedFile
        } as ImageBody
      case MsgEnum.VIDEO:
        return {
          size: info.size || 0,
          duration: info.duration || 0,
          thumbWidth: info.thumbnail_info?.w || 0,
          thumbHeight: info.thumbnail_info?.h || 0,
          mimetype: info.mimetype || '',
          url: mediaUrl,
          thumbUrl:
            (typeof info.thumbnail_url === 'string' && info.thumbnail_url) ||
            (typeof info.thumbnail_file?.url === 'string' && info.thumbnail_file.url) ||
            '',
          thumbnailEncryptedFile: info.thumbnail_file,
          filename: (content.body as string) || '',
          encryptedFile
        } as VideoBody
      case MsgEnum.VOICE:
        return {
          size: info.size || 0,
          second: info.duration || 0,
          url: mediaUrl,
          mxcUrl: mediaUrl,
          fileName: (content.body as string) || '',
          mimeType: info.mimetype || '',
          encryptedFile
        } as VoiceBody
      case MsgEnum.FILE:
        return {
          size: info.size || 0,
          fileName: (content.body as string) || '',
          url: mediaUrl,
          encryptedFile
        } as FileBody
      default:
        return {
          content: typeof content.body === 'string' ? content.body : JSON.stringify(content)
        } as TextBody
    }
  }
}

export default matrixMessageAdapter
