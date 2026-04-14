import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk'
import { TimelineWindow, ReceiptType } from 'matrix-js-sdk'
import type { IEventRelation, EventTimeline } from '@/types/matrix-js-sdk'
import type { UploadContentOptions, TimelineWindowOptions, TimelineDirection } from '@/types/matrix-api'
import matrixClientService from './MatrixClientService'
import { BaseManager, NotFoundError } from './BaseManager'
import { info } from '@tauri-apps/plugin-log'

const MESSAGE_EVENT_TYPE = 'm.room.message' as const
const REACTION_EVENT_TYPE = 'm.reaction' as const

export interface IMessageContent {
  msgtype: string
  body: string
  format?: string
  formatted_body?: string
  url?: string
  filename?: string
  info?: IMediaInfo
  geo_uri?: string
  'm.relates_to'?: IEventRelation
  'm.new_content'?: Partial<IMessageContent>
}

export interface IMediaInfo {
  size?: number
  mimetype?: string
  w?: number
  h?: number
  duration?: number
  thumbnail_url?: string
  thumbnail_info?: IThumbnailInfo
}

export interface IThumbnailInfo {
  size: number
  w: number
  h: number
  mimetype: string
}

export interface SendMessageOptions {
  roomId: string
  content: IMessageContent
  eventType?: string
  relation?: IEventRelation
  burnAfterRead?: boolean
  burnDuration?: number
  isSticky?: boolean
}

class MatrixEventService extends BaseManager {
  private getClient(): MatrixClient {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('客户端未初始化')
    return client
  }

  async sendTextMessage(roomId: string, text: string, html?: string, throwOnError = true): Promise<string> {
    try {
      const client = this.getClient()
      const content: IMessageContent = {
        msgtype: 'm.text',
        body: text
      }

      if (html) {
        content.format = 'org.matrix.custom.html'
        content.formatted_body = html
      }

      const eventId = await client.sendEvent(roomId, MESSAGE_EVENT_TYPE, content)
      info(`[MatrixEvent] 发送文本消息成功: ${roomId}`)
      return eventId.event_id
    } catch (error) {
      return this.handleError(error, 'sendTextMessage', '', throwOnError)
    }
  }

  async sendImageMessage(
    roomId: string,
    fileOrUrl: File | string,
    mediaInfo?: { size: number; mimetype: string; width?: number; height?: number },
    filename?: string,
    throwOnError = true
  ): Promise<string> {
    try {
      const client = this.getClient()
      let content: IMessageContent

      if (typeof fileOrUrl === 'string') {
        content = {
          msgtype: 'm.image',
          url: fileOrUrl,
          body: filename || 'image',
          info: {
            size: mediaInfo?.size ?? 0,
            mimetype: mediaInfo?.mimetype ?? 'image/png',
            w: mediaInfo?.width,
            h: mediaInfo?.height
          }
        }
      } else {
        const uploadResponse = await client.uploadContent(fileOrUrl, {
          type: fileOrUrl.type
        } as UploadContentOptions)

        content = {
          msgtype: 'm.image',
          body: filename ?? fileOrUrl.name,
          info: {
            size: fileOrUrl.size,
            mimetype: fileOrUrl.type
          },
          url: uploadResponse.content_uri
        }
      }

      const response = await client.sendEvent(roomId, MESSAGE_EVENT_TYPE, content)
      info(`[MatrixEvent] 发送图片消息成功: ${roomId}`)
      return response.event_id
    } catch (error) {
      return this.handleError(error, 'sendImageMessage', '', throwOnError)
    }
  }

  async sendFileMessage(
    roomId: string,
    fileOrUrl: File | string,
    mediaInfo?: { size: number; mimetype: string },
    filename?: string,
    throwOnError = true
  ): Promise<string> {
    try {
      const client = this.getClient()
      let content: IMessageContent

      if (typeof fileOrUrl === 'string') {
        content = {
          msgtype: 'm.file',
          url: fileOrUrl,
          body: filename ?? 'file',
          filename: filename ?? 'file',
          info: {
            size: mediaInfo?.size ?? 0,
            mimetype: mediaInfo?.mimetype ?? 'application/octet-stream'
          }
        }
      } else {
        const uploadResponse = await client.uploadContent(fileOrUrl, {
          type: fileOrUrl.type
        } as UploadContentOptions)

        content = {
          msgtype: 'm.file',
          body: filename ?? fileOrUrl.name,
          filename: filename ?? fileOrUrl.name,
          info: {
            size: fileOrUrl.size,
            mimetype: fileOrUrl.type
          },
          url: uploadResponse.content_uri
        }
      }

      const response = await client.sendEvent(roomId, MESSAGE_EVENT_TYPE, content)
      info(`[MatrixEvent] 发送文件消息成功: ${roomId}`)
      return response.event_id
    } catch (error) {
      return this.handleError(error, 'sendFileMessage', '', throwOnError)
    }
  }

  async sendVideoMessage(
    roomId: string,
    fileOrUrl: File | string,
    mediaInfo?: { size: number; mimetype: string; width?: number; height?: number; duration?: number },
    filename?: string,
    thumbnailUri?: string,
    thumbnailInfo?: { size: number; width: number; height: number },
    throwOnError = true
  ): Promise<string> {
    try {
      const client = this.getClient()
      let content: IMessageContent

      if (typeof fileOrUrl === 'string') {
        content = {
          msgtype: 'm.video',
          url: fileOrUrl,
          body: filename ?? 'video',
          info: {
            size: mediaInfo?.size ?? 0,
            mimetype: mediaInfo?.mimetype ?? 'video/mp4',
            w: mediaInfo?.width,
            h: mediaInfo?.height,
            duration: mediaInfo?.duration
          }
        }

        if (thumbnailUri && thumbnailInfo) {
          content.info = {
            ...content.info,
            thumbnail_url: thumbnailUri,
            thumbnail_info: {
              size: thumbnailInfo.size,
              w: thumbnailInfo.width,
              h: thumbnailInfo.height,
              mimetype: 'image/jpeg'
            }
          }
        }
      } else {
        const uploadResponse = await client.uploadContent(fileOrUrl, {
          type: fileOrUrl.type
        } as UploadContentOptions)

        content = {
          msgtype: 'm.video',
          body: filename ?? fileOrUrl.name,
          info: {
            size: fileOrUrl.size,
            mimetype: fileOrUrl.type
          },
          url: uploadResponse.content_uri
        }
      }

      const response = await client.sendEvent(roomId, MESSAGE_EVENT_TYPE, content)
      info(`[MatrixEvent] 发送视频消息成功: ${roomId}`)
      return response.event_id
    } catch (error) {
      return this.handleError(error, 'sendVideoMessage', '', throwOnError)
    }
  }

  async sendAudioMessage(
    roomId: string,
    fileOrUrl: File | string,
    mediaInfo?: { size: number; mimetype: string; duration?: number },
    filename?: string,
    throwOnError = true
  ): Promise<string> {
    try {
      const client = this.getClient()
      let content: IMessageContent

      if (typeof fileOrUrl === 'string') {
        content = {
          msgtype: 'm.audio',
          url: fileOrUrl,
          body: filename ?? 'audio',
          info: {
            size: mediaInfo?.size ?? 0,
            mimetype: mediaInfo?.mimetype ?? 'audio/ogg',
            duration: mediaInfo?.duration
          }
        }
      } else {
        const uploadResponse = await client.uploadContent(fileOrUrl, {
          type: fileOrUrl.type
        } as UploadContentOptions)

        content = {
          msgtype: 'm.audio',
          body: filename ?? fileOrUrl.name,
          info: {
            size: fileOrUrl.size,
            mimetype: fileOrUrl.type
          },
          url: uploadResponse.content_uri
        }
      }

      const response = await client.sendEvent(roomId, MESSAGE_EVENT_TYPE, content)
      info(`[MatrixEvent] 发送音频消息成功: ${roomId}`)
      return response.event_id
    } catch (error) {
      return this.handleError(error, 'sendAudioMessage', '', throwOnError)
    }
  }

  async sendVoiceMessage(
    roomId: string,
    contentUri: string,
    voiceInfo: { size: number; duration: number },
    filename = 'voice.ogg',
    throwOnError = true
  ): Promise<string> {
    try {
      const client = this.getClient()
      const content: IMessageContent = {
        msgtype: 'm.audio',
        url: contentUri,
        body: filename,
        info: {
          size: voiceInfo.size,
          mimetype: 'audio/ogg',
          duration: voiceInfo.duration
        }
      }

      const response = await client.sendEvent(roomId, MESSAGE_EVENT_TYPE, content)
      info(`[MatrixEvent] 发送语音消息成功: ${roomId}`)
      return response.event_id
    } catch (error) {
      return this.handleError(error, 'sendVoiceMessage', '', throwOnError)
    }
  }

  async sendLocationMessage(
    roomId: string,
    geoUri: string,
    description: string,
    thumbnailUri?: string,
    thumbnailInfo?: { size: number; width: number; height: number },
    throwOnError = true
  ): Promise<string> {
    try {
      const client = this.getClient()
      const content: IMessageContent = {
        msgtype: 'm.location',
        body: description,
        geo_uri: geoUri
      }

      if (thumbnailUri && thumbnailInfo) {
        content.info = {
          thumbnail_url: thumbnailUri,
          thumbnail_info: {
            size: thumbnailInfo.size,
            w: thumbnailInfo.width,
            h: thumbnailInfo.height,
            mimetype: 'image/jpeg'
          }
        }
      }

      const response = await client.sendEvent(roomId, MESSAGE_EVENT_TYPE, content)
      info(`[MatrixEvent] 发送位置消息成功: ${roomId}`)
      return response.event_id
    } catch (error) {
      return this.handleError(error, 'sendLocationMessage', '', throwOnError)
    }
  }

  async redactEvent(roomId: string, eventId: string, reason?: string, throwOnError = true): Promise<void> {
    try {
      const client = this.getClient()
      await client.redactEvent(roomId, eventId, undefined, reason ? { reason } : undefined)
      info(`[MatrixEvent] 撤回消息成功: ${eventId}`)
    } catch (error) {
      this.handleError(error, 'redactEvent', undefined, throwOnError)
    }
  }

  async sendMessageReceipt(
    roomId: string,
    eventId: string,
    type: ReceiptType = ReceiptType.Read,
    throwOnError = true
  ): Promise<void> {
    try {
      const client = this.getClient()
      const room = client.getRoom(roomId)
      if (!room) {
        throw new NotFoundError(`房间不存在: ${roomId}`)
      }
      const event = room.findEventById(eventId)
      if (!event) {
        throw new NotFoundError(`事件不存在: ${eventId}`)
      }
      await client.sendReadReceipt(event, type)
      info(`[MatrixEvent] 发送已读回执成功: ${eventId}`)
    } catch (error) {
      this.handleError(error, 'sendMessageReceipt', undefined, throwOnError)
    }
  }

  async getEventTimeline(roomId: string, _eventId: string, throwOnError = true): Promise<EventTimeline | null> {
    try {
      const client = this.getClient()
      const room = client.getRoom(roomId)
      if (!room) {
        throw new NotFoundError(`房间不存在: ${roomId}`)
      }

      const timelineSet = room.getUnfilteredTimelineSet()
      const timeline = timelineSet.getLiveTimeline()
      return timeline
    } catch (error) {
      return this.handleError(error, 'getEventTimeline', null, throwOnError)
    }
  }

  async getRoomTimeline(roomId: string, limit = 50, throwOnError = true): Promise<MatrixEvent[]> {
    try {
      const client = this.getClient()
      const room = client.getRoom(roomId)
      if (!room) {
        throw new NotFoundError(`房间不存在: ${roomId}`)
      }

      const timelineSet = room.getUnfilteredTimelineSet()
      const events = timelineSet.getLiveTimeline().getEvents()
      return events.slice(-limit)
    } catch (error) {
      return this.handleError(error, 'getRoomTimeline', [] as MatrixEvent[], throwOnError)
    }
  }

  async paginateTimeline(
    roomId: string,
    direction: 'b' | 'f' = 'b',
    limit = 50,
    throwOnError = true
  ): Promise<MatrixEvent[]> {
    try {
      const client = this.getClient()
      const room = client.getRoom(roomId)
      if (!room) {
        throw new NotFoundError(`房间不存在: ${roomId}`)
      }

      const timelineSet = room.getUnfilteredTimelineSet()
      const timelineWindow = new TimelineWindow(client, timelineSet, {
        windowLimit: limit
      } as TimelineWindowOptions)

      await timelineWindow.paginate(direction as TimelineDirection, limit)
      const events = timelineWindow.getEvents()
      return events
    } catch (error) {
      return this.handleError(error, 'paginateTimeline', [] as MatrixEvent[], throwOnError)
    }
  }

  async replyToEvent(roomId: string, eventId: string, text: string, throwOnError = true): Promise<string> {
    try {
      const client = this.getClient()
      const room = client.getRoom(roomId)
      if (!room) {
        throw new NotFoundError(`房间不存在: ${roomId}`)
      }

      const event = room.findEventById(eventId)
      if (!event) {
        throw new NotFoundError(`事件不存在: ${eventId}`)
      }

      const content: IMessageContent = {
        msgtype: 'm.text',
        body: text,
        'm.relates_to': {
          'm.in_reply_to': {
            event_id: eventId
          }
        } as unknown as IEventRelation
      }

      const response = await client.sendEvent(roomId, MESSAGE_EVENT_TYPE, content)
      info(`[MatrixEvent] 回复消息成功: ${eventId}`)
      return response.event_id
    } catch (error) {
      return this.handleError(error, 'replyToEvent', '', throwOnError)
    }
  }

  async editEvent(roomId: string, eventId: string, newText: string, throwOnError = true): Promise<string> {
    try {
      const client = this.getClient()
      const room = client.getRoom(roomId)
      if (!room) {
        throw new NotFoundError(`房间不存在: ${roomId}`)
      }

      const event = room.findEventById(eventId)
      if (!event) {
        throw new NotFoundError(`事件不存在: ${eventId}`)
      }

      const originalContent = event.getContent() as Partial<IMessageContent>
      const content: IMessageContent = {
        ...originalContent,
        msgtype: 'm.text',
        body: `* ${newText}`,
        'm.new_content': {
          msgtype: 'm.text',
          body: newText
        },
        'm.relates_to': {
          rel_type: 'm.replace',
          event_id: eventId
        } as IEventRelation
      }

      const response = await client.sendEvent(roomId, MESSAGE_EVENT_TYPE, content)
      info(`[MatrixEvent] 编辑消息成功: ${eventId}`)
      return response.event_id
    } catch (error) {
      return this.handleError(error, 'editEvent', '', throwOnError)
    }
  }

  async reactToEvent(roomId: string, eventId: string, emoji: string, throwOnError = true): Promise<string> {
    try {
      const client = this.getClient()
      const content = {
        'm.relates_to': {
          rel_type: 'm.annotation',
          event_id: eventId,
          key: emoji
        }
      }

      const response = await client.sendEvent(roomId, REACTION_EVENT_TYPE, content)
      info(`[MatrixEvent] 反应消息成功: ${eventId} -> ${emoji}`)
      return response.event_id
    } catch (error) {
      return this.handleError(error, 'reactToEvent', '', throwOnError)
    }
  }

  async sendEvent(
    roomId: string,
    eventType: string,
    content: Record<string, unknown>,
    throwOnError = true
  ): Promise<string> {
    try {
      const client = this.getClient()
      const response = await client.sendEvent(roomId, eventType, content)
      info(`[MatrixEvent] 发送事件成功: ${roomId}, ${eventType}`)
      return response.event_id
    } catch (error) {
      return this.handleError(error, 'sendEvent', '', throwOnError)
    }
  }

  async sendMessage(options: SendMessageOptions, throwOnError = true): Promise<MatrixEvent | null> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Client not initialized')
      }

      const { roomId, content, eventType = 'm.room.message', relation } = options

      const messageContent: Record<string, unknown> = { ...content }

      if (relation) {
        messageContent['m.relates_to'] = relation
      }

      if (options.burnAfterRead) {
        messageContent['org.matrix.msc_burn_after_read'] = {
          enabled: true,
          duration: options.burnDuration || 60
        }
      }

      if (options.isSticky) {
        messageContent['org.matrix.msc4354.sticky'] = true
      }

      const response = await client.sendEvent(roomId, eventType, messageContent)

      const telemetry = matrixClientService.getTelemetry()
      if (telemetry) {
        telemetry.trackMessageSent(roomId, (messageContent.msgtype as string) || eventType)
      }

      return response as unknown as MatrixEvent
    } catch (error) {
      return this.handleError(error, 'sendMessage', null, throwOnError)
    }
  }
}

export type { ReceiptType }
export type ReceiptTypeValue = ReceiptType

export const matrixEventService = new MatrixEventService()
export default matrixEventService
