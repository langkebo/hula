import type { MatrixEvent } from 'matrix-js-sdk'
import { MsgEnum, MessageStatusEnum } from '@/enums'
import type { MessageType, MsgType, TextBody, ImageBody, VideoBody, FileBody, VoiceBody } from '@/services/types'

export interface MatrixMessageAdapter {
  convertMatrixEventToMessageType(event: MatrixEvent, roomId: string): MessageType
  getMsgTypeFromMatrixEvent(event: MatrixEvent): MsgEnum
  convertMatrixContent(content: any, msgType: MsgEnum): MsgType
}

export const matrixMessageAdapter: MatrixMessageAdapter = {
  convertMatrixEventToMessageType(event: MatrixEvent, _roomId: string): MessageType {
    const sender = event.getSender() ?? ''
    const senderMember = event.sender as any
    const content = event.getContent()
    const msgType = this.getMsgTypeFromMatrixEvent(event)

    return {
      fromUser: {
        uid: sender,
        username: senderMember?.name || sender.split(':')[0],
        avatar: senderMember?.getMxcAvatarUrl?.() || '',
        locPlace: '',
        badge: undefined
      },
      message: this.convertMatrixContent(content, msgType),
      sendTime: event.getTs(),
      loading: false
    }
  },

  getMsgTypeFromMatrixEvent(event: MatrixEvent): MsgEnum {
    const eventType = event.getType()
    const content = event.getContent()

    if (eventType === 'm.room.redaction') {
      return MsgEnum.RECALL
    }

    if (eventType === 'm.room.member') {
      return MsgEnum.SYSTEM
    }

    if (eventType === 'm.room.message' || eventType === 'm.room.encrypted') {
      const msgtype = content.msgtype

      switch (msgtype) {
        case 'm.text':
        case 'm.notice':
          return MsgEnum.TEXT
        case 'm.image':
          return MsgEnum.IMAGE
        case 'm.video':
          return MsgEnum.VIDEO
        case 'm.audio':
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

  convertMatrixContent(content: any, msgType: MsgEnum): MsgType {
    const baseMsgType = {
      id: content.event_id || '',
      status: MessageStatusEnum.SUCCESS,
      roomId: content.room_id || '',
      sendTime: Date.now(),
      messageMarks: {}
    }

    switch (msgType) {
      case MsgEnum.TEXT: {
        const textBody: TextBody = {
          content: content.body || '',
          reply: content['m.relates_to']
            ? {
                id: content['m.relates_to']['m.in_reply_to']?.event_id || '',
                username: '',
                type: MsgEnum.TEXT,
                body: '',
                canCallback: 1,
                gapCount: 0
              }
            : undefined,
          atUidList: [],
          urlContentMap: {}
        }
        return { ...baseMsgType, type: MsgEnum.TEXT, body: textBody }
      }

      case MsgEnum.IMAGE: {
        const imageBody: ImageBody = {
          url: content.url || content.file?.url || '',
          size: content.info?.size || 0,
          width: content.info?.w || content.info?.width || 0,
          height: content.info?.h || content.info?.height || 0,
          thumbnailPath: ''
        }
        return { ...baseMsgType, type: MsgEnum.IMAGE, body: imageBody }
      }

      case MsgEnum.VIDEO: {
        const videoBody: VideoBody = {
          url: content.url || content.file?.url || '',
          size: content.info?.size || 0,
          filename: content.body || '',
          thumbUrl: content.info?.thumbnail_url || '',
          thumbSize: content.info?.thumbnail_info?.size || 0,
          thumbWidth: content.info?.thumbnail_info?.w || 0,
          thumbHeight: content.info?.thumbnail_info?.h || 0,
          thumbnailPath: ''
        }
        return { ...baseMsgType, type: MsgEnum.VIDEO, body: videoBody }
      }

      case MsgEnum.VOICE: {
        const voiceBody: VoiceBody = {
          url: content.url || content.file?.url || '',
          size: content.info?.size || 0,
          second: content.info?.duration || 0
        }
        return { ...baseMsgType, type: MsgEnum.VOICE, body: voiceBody }
      }

      case MsgEnum.FILE: {
        const fileBody: FileBody = {
          url: content.url || content.file?.url || '',
          size: content.info?.size || 0,
          fileName: content.body || content.filename || ''
        }
        return { ...baseMsgType, type: MsgEnum.FILE, body: fileBody }
      }

      case MsgEnum.LOCATION: {
        const locationBody: any = {
          geoUri: content.geo_uri || '',
          description: content.body || ''
        }
        return { ...baseMsgType, type: MsgEnum.LOCATION, body: locationBody }
      }

      case MsgEnum.RECALL: {
        return { ...baseMsgType, type: MsgEnum.RECALL, body: { reason: content.reason || '' } }
      }

      case MsgEnum.SYSTEM: {
        const systemBody: any = {
          content: content.body || '',
          membership: content.membership || '',
          prevContent: content.prev_content || null
        }
        return { ...baseMsgType, type: MsgEnum.SYSTEM, body: systemBody }
      }

      default:
        return { ...baseMsgType, type: MsgEnum.UNKNOWN, body: {} }
    }
  }
}

export default matrixMessageAdapter
