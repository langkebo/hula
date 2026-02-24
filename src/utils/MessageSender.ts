import { invoke } from '@tauri-apps/api/core'
import { MsgEnum, TauriCommand } from '@/enums'
import { matrixEventService } from '@/services/matrix'
import { useMatrixStore } from '@/stores/matrix'
import { info, error } from '@tauri-apps/plugin-log'

export type SendMessagePayload = {
  id: string
  roomId: string
  msgType: MsgEnum
  body: unknown
}

export type SendMessageOptions = {
  data: SendMessagePayload
  onSuccess?: (payload: any) => void
  onError?: (msgId: string) => void
}

function convertMsgTypeToMatrix(msgType: MsgEnum): string {
  switch (msgType) {
    case MsgEnum.TEXT:
      return 'm.text'
    case MsgEnum.IMAGE:
      return 'm.image'
    case MsgEnum.VIDEO:
      return 'm.video'
    case MsgEnum.AUDIO:
    case MsgEnum.VOICE:
      return 'm.audio'
    case MsgEnum.FILE:
      return 'm.file'
    case MsgEnum.LOCATION:
      return 'm.location'
    case MsgEnum.NOTICE:
      return 'm.notice'
    default:
      return 'm.text'
  }
}

function buildMatrixContent(msgType: MsgEnum, body: any): Record<string, any> {
  const content: Record<string, any> = {
    msgtype: convertMsgTypeToMatrix(msgType),
    body: ''
  }

  switch (msgType) {
    case MsgEnum.TEXT: {
      content.body = body.content || body || ''
      if (body.reply) {
        content['m.relates_to'] = {
          'm.in_reply_to': {
            event_id: body.reply.id
          }
        }
      }
      break
    }
    case MsgEnum.IMAGE: {
      content.body = body.fileName || 'image'
      content.url = body.url
      content.info = {
        size: body.size || 0,
        w: body.width || 0,
        h: body.height || 0,
        mimetype: body.mimetype || 'image/png'
      }
      break
    }
    case MsgEnum.VIDEO: {
      content.body = body.fileName || 'video'
      content.url = body.url
      content.info = {
        size: body.size || 0,
        duration: body.duration || 0,
        w: body.thumbWidth || 0,
        h: body.thumbHeight || 0,
        mimetype: body.mimetype || 'video/mp4',
        thumbnail_url: body.thumbUrl,
        thumbnail_info: {
          size: body.thumbSize || 0,
          w: body.thumbWidth || 0,
          h: body.thumbHeight || 0
        }
      }
      break
    }
    case MsgEnum.VOICE: {
      content.body = body.fileName || 'voice'
      content.url = body.url
      content.info = {
        size: body.size || 0,
        duration: body.second || 0,
        mimetype: body.mimetype || 'audio/ogg'
      }
      break
    }
    case MsgEnum.FILE: {
      content.body = body.fileName || 'file'
      content.url = body.url
      content.info = {
        size: body.size || 0,
        mimetype: body.mimetype || 'application/octet-stream'
      }
      break
    }
    case MsgEnum.LOCATION: {
      content.body = body.description || ''
      content.geo_uri = body.geoUri || ''
      break
    }
    default: {
      content.body = typeof body === 'string' ? body : JSON.stringify(body)
    }
  }

  return content
}

export const sendMessageWithChannel = async (options: SendMessageOptions) => {
  const { data, onSuccess, onError } = options
  const noop = () => {}

  const matrixStore = useMatrixStore()

  if (!matrixStore.isLoggedIn) {
    try {
      await invoke(TauriCommand.SEND_MSG, {
        data,
        successChannel: { onmessage: noop },
        errorChannel: { onmessage: noop }
      })
    } catch (err) {
      error(`[MessageSender] Matrix 未登录，无法发送消息: ${err}`)
      onError?.(data.id)
    }
    return
  }

  try {
    const matrixContent = buildMatrixContent(data.msgType, data.body)
    const eventType = data.msgType === MsgEnum.NOTICE ? 'm.room.notice' : 'm.room.message'

    const eventId = await matrixEventService.sendEvent(data.roomId, eventType, matrixContent)

    await info(`[MessageSender] 消息发送成功: ${eventId}`)

    onSuccess?.({
      oldMsgId: data.id,
      message: {
        id: eventId,
        body: data.body
      },
      timeBlock: Date.now()
    })
  } catch (err) {
    await error(`[MessageSender] 消息发送失败: ${err}`)
    onError?.(data.id)
  }
}
