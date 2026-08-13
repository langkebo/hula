import { MatrixBurnDuration, MatrixContentField, MatrixMsgType } from '@/common/matrixConstants'
import { MsgEnum } from '@/enums'

/**
 * 消息内容构建器 — 从 MatrixMessageService 抽离的纯函数模块。
 *
 * 负责将业务层 SendMessagePayload.body 转换为 Matrix 协议要求的 content 对象，
 * 涵盖文本/图片/视频/语音/文件/位置等消息类型。
 */

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function convertMsgTypeToMatrix(msgType: MsgEnum): string {
  switch (msgType) {
    case MsgEnum.TEXT:
      return MatrixMsgType.TEXT
    case MsgEnum.IMAGE:
    case MsgEnum.EMOJI:
      return MatrixMsgType.IMAGE
    case MsgEnum.VIDEO:
      return MatrixMsgType.VIDEO
    case MsgEnum.AUDIO:
    case MsgEnum.VOICE:
      return MatrixMsgType.AUDIO
    case MsgEnum.FILE:
      return MatrixMsgType.FILE
    case MsgEnum.LOCATION:
      return MatrixMsgType.LOCATION
    case MsgEnum.NOTICE:
      return MatrixMsgType.NOTICE
    default:
      return MatrixMsgType.TEXT
  }
}

/** 构建 Matrix 消息内容体
 */
export function buildMatrixContent(msgType: MsgEnum, body: unknown): Record<string, unknown> {
  const bodyRecord = asRecord(body)
  const reply = asRecord(bodyRecord.reply)
  const encryptedFile = asRecord(bodyRecord.encryptedFile)
  const hasEncryptedFile = typeof encryptedFile.url === 'string' && typeof encryptedFile.v === 'string'

  const content: Record<string, unknown> = {
    msgtype: convertMsgTypeToMatrix(msgType),
    body: ''
  }

  switch (msgType) {
    case MsgEnum.TEXT:
    case MsgEnum.NOTICE: {
      content.body = (bodyRecord.content as string | undefined) || (typeof body === 'string' ? body : '') || ''
      if (typeof reply.id === 'string') {
        content[MatrixContentField.RELATES_TO] = {
          'm.in_reply_to': {
            event_id: reply.id
          }
        }
      }
      break
    }
    case MsgEnum.IMAGE:
    case MsgEnum.EMOJI: {
      content.body = (bodyRecord.fileName as string | undefined) || 'image'
      if (hasEncryptedFile) {
        content.file = encryptedFile
      } else {
        content.url = bodyRecord.url
      }
      content.info = {
        size: (bodyRecord.size as number | undefined) || 0,
        w: (bodyRecord.width as number | undefined) || 0,
        h: (bodyRecord.height as number | undefined) || 0,
        mimetype: (bodyRecord.mimetype as string | undefined) || 'image/png'
      }
      break
    }
    case MsgEnum.VIDEO: {
      const thumbnailEncryptedFile = asRecord(bodyRecord.thumbnailEncryptedFile)
      const hasEncryptedThumbnail =
        typeof thumbnailEncryptedFile.url === 'string' && typeof thumbnailEncryptedFile.v === 'string'
      content.body = (bodyRecord.fileName as string | undefined) || 'video'
      if (hasEncryptedFile) {
        content.file = encryptedFile
      } else {
        content.url = bodyRecord.url
      }
      content.info = {
        size: (bodyRecord.size as number | undefined) || 0,
        duration: (bodyRecord.duration as number | undefined) || 0,
        w: (bodyRecord.thumbWidth as number | undefined) || 0,
        h: (bodyRecord.thumbHeight as number | undefined) || 0,
        mimetype: (bodyRecord.mimetype as string | undefined) || 'video/mp4',
        thumbnail_info: {
          size: (bodyRecord.thumbSize as number | undefined) || 0,
          w: (bodyRecord.thumbWidth as number | undefined) || 0,
          h: (bodyRecord.thumbHeight as number | undefined) || 0
        }
      }
      if (hasEncryptedThumbnail) {
        ;(content.info as Record<string, unknown>).thumbnail_file = thumbnailEncryptedFile
      } else {
        ;(content.info as Record<string, unknown>).thumbnail_url = bodyRecord.thumbUrl
      }
      break
    }
    case MsgEnum.VOICE: {
      content.body = (bodyRecord.fileName as string | undefined) || 'voice'
      if (hasEncryptedFile) {
        content.file = encryptedFile
      } else {
        content.url = bodyRecord.mxcUrl || bodyRecord.url
      }
      content.info = {
        size: (bodyRecord.size as number | undefined) || 0,
        duration: (bodyRecord.second as number | undefined) || 0,
        mimetype:
          (bodyRecord.mimeType as string | undefined) || (bodyRecord.mimetype as string | undefined) || 'audio/ogg'
      }
      break
    }
    case MsgEnum.FILE: {
      content.body = (bodyRecord.fileName as string | undefined) || 'file'
      if (hasEncryptedFile) {
        content.file = encryptedFile
      } else {
        content.url = bodyRecord.url
      }
      content.info = {
        size: (bodyRecord.size as number | undefined) || 0,
        mimetype: (bodyRecord.mimetype as string | undefined) || 'application/octet-stream'
      }
      break
    }
    case MsgEnum.LOCATION: {
      content.body = (bodyRecord.description as string | undefined) || ''
      content.geo_uri = (bodyRecord.geoUri as string | undefined) || ''
      break
    }
    default: {
      content.body = typeof body === 'string' ? body : JSON.stringify(body)
    }
  }

  return content
}

export { MatrixBurnDuration }
