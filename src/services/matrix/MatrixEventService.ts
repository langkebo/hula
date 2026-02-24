import type {
  MatrixEvent,
  IEventRelation
} from 'matrix-js-sdk'
import { EventTimeline } from 'matrix-js-sdk'
import matrixClientService from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

export const ReceiptType = {
  Read: 'm.read' as const,
  ReadPrivate: 'm.read.private' as const
}

export type ReceiptTypeValue = typeof ReceiptType[keyof typeof ReceiptType]

export interface SendMessageOptions {
  roomId: string
  content: any
  eventType?: string
  relation?: IEventRelation
}

class MatrixEventService {
  async sendTextMessage(roomId: string, text: string, html?: string): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const content: any = {
        msgtype: 'm.text',
        body: text
      }

      if (html) {
        content.format = 'org.matrix.custom.html'
        content.formatted_body = html
      }

      const eventId = await client.sendEvent(roomId, 'm.room.message' as any, content)
      info(`[MatrixEvent] 发送文本消息成功: ${roomId}`)
      return eventId.event_id
    } catch (err) {
      error(`[MatrixEvent] 发送文本消息失败: ${err}`)
      throw err
    }
  }

  async sendImageMessage(
    roomId: string,
    fileOrUrl: File | string,
    mediaInfo?: { size: number; mimetype: string; width?: number; height?: number },
    filename?: string
  ): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      let content: any

      if (typeof fileOrUrl === 'string') {
        content = {
          msgtype: 'm.image',
          url: fileOrUrl,
          body: filename || 'image',
          info: {
            size: mediaInfo?.size || 0,
            mimetype: mediaInfo?.mimetype || 'image/png',
            w: mediaInfo?.width,
            h: mediaInfo?.height
          }
        }
      } else {
        const uploadResponse = await client.uploadContent(fileOrUrl, {
          name: filename || fileOrUrl.name,
          type: fileOrUrl.type
        })

        content = {
          msgtype: 'm.image',
          body: filename || fileOrUrl.name,
          info: {
            size: fileOrUrl.size,
            mimetype: fileOrUrl.type
          },
          url: uploadResponse.content_uri
        }
      }

      const response = await client.sendEvent(roomId, 'm.room.message' as any, content)
      info(`[MatrixEvent] 发送图片消息成功: ${roomId}`)
      return response.event_id
    } catch (err) {
      error(`[MatrixEvent] 发送图片消息失败: ${err}`)
      throw err
    }
  }

  async sendFileMessage(
    roomId: string,
    fileOrUrl: File | string,
    mediaInfo?: { size: number; mimetype: string },
    filename?: string
  ): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      let content: any

      if (typeof fileOrUrl === 'string') {
        content = {
          msgtype: 'm.file',
          url: fileOrUrl,
          body: filename || 'file',
          filename: filename || 'file',
          info: {
            size: mediaInfo?.size || 0,
            mimetype: mediaInfo?.mimetype || 'application/octet-stream'
          }
        }
      } else {
        const uploadResponse = await client.uploadContent(fileOrUrl, {
          name: filename || fileOrUrl.name,
          type: fileOrUrl.type
        })

        content = {
          msgtype: 'm.file',
          body: filename || fileOrUrl.name,
          filename: filename || fileOrUrl.name,
          info: {
            size: fileOrUrl.size,
            mimetype: fileOrUrl.type
          },
          url: uploadResponse.content_uri
        }
      }

      const response = await client.sendEvent(roomId, 'm.room.message' as any, content)
      info(`[MatrixEvent] 发送文件消息成功: ${roomId}`)
      return response.event_id
    } catch (err) {
      error(`[MatrixEvent] 发送文件消息失败: ${err}`)
      throw err
    }
  }

  async sendVideoMessage(
    roomId: string,
    fileOrUrl: File | string,
    mediaInfo?: { size: number; mimetype: string; width?: number; height?: number; duration?: number },
    filename?: string,
    thumbnailUri?: string,
    thumbnailInfo?: { size: number; width: number; height: number }
  ): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      let content: any

      if (typeof fileOrUrl === 'string') {
        content = {
          msgtype: 'm.video',
          url: fileOrUrl,
          body: filename || 'video',
          info: {
            size: mediaInfo?.size || 0,
            mimetype: mediaInfo?.mimetype || 'video/mp4',
            w: mediaInfo?.width,
            h: mediaInfo?.height,
            duration: mediaInfo?.duration
          }
        }

        if (thumbnailUri && thumbnailInfo) {
          content.info.thumbnail_url = thumbnailUri
          content.info.thumbnail_info = {
            size: thumbnailInfo.size,
            w: thumbnailInfo.width,
            h: thumbnailInfo.height,
            mimetype: 'image/jpeg'
          }
        }
      } else {
        const uploadResponse = await client.uploadContent(fileOrUrl, {
          name: filename || fileOrUrl.name,
          type: fileOrUrl.type
        })

        content = {
          msgtype: 'm.video',
          body: filename || fileOrUrl.name,
          info: {
            size: fileOrUrl.size,
            mimetype: fileOrUrl.type
          },
          url: uploadResponse.content_uri
        }
      }

      const response = await client.sendEvent(roomId, 'm.room.message' as any, content)
      info(`[MatrixEvent] 发送视频消息成功: ${roomId}`)
      return response.event_id
    } catch (err) {
      error(`[MatrixEvent] 发送视频消息失败: ${err}`)
      throw err
    }
  }

  async sendAudioMessage(
    roomId: string,
    fileOrUrl: File | string,
    mediaInfo?: { size: number; mimetype: string; duration?: number },
    filename?: string
  ): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      let content: any

      if (typeof fileOrUrl === 'string') {
        content = {
          msgtype: 'm.audio',
          url: fileOrUrl,
          body: filename || 'audio',
          info: {
            size: mediaInfo?.size || 0,
            mimetype: mediaInfo?.mimetype || 'audio/ogg',
            duration: mediaInfo?.duration
          }
        }
      } else {
        const uploadResponse = await client.uploadContent(fileOrUrl, {
          name: filename || fileOrUrl.name,
          type: fileOrUrl.type
        })

        content = {
          msgtype: 'm.audio',
          body: filename || fileOrUrl.name,
          info: {
            size: fileOrUrl.size,
            mimetype: fileOrUrl.type
          },
          url: uploadResponse.content_uri
        }
      }

      const response = await client.sendEvent(roomId, 'm.room.message' as any, content)
      info(`[MatrixEvent] 发送音频消息成功: ${roomId}`)
      return response.event_id
    } catch (err) {
      error(`[MatrixEvent] 发送音频消息失败: ${err}`)
      throw err
    }
  }

  async sendVoiceMessage(
    roomId: string,
    contentUri: string,
    voiceInfo: { size: number; duration: number },
    filename: string = 'voice.ogg'
  ): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const content = {
        msgtype: 'm.audio',
        url: contentUri,
        body: filename,
        info: {
          size: voiceInfo.size,
          mimetype: 'audio/ogg',
          duration: voiceInfo.duration
        }
      }

      const response = await client.sendEvent(roomId, 'm.room.message' as any, content)
      info(`[MatrixEvent] 发送语音消息成功: ${roomId}`)
      return response.event_id
    } catch (err) {
      error(`[MatrixEvent] 发送语音消息失败: ${err}`)
      throw err
    }
  }

  async sendLocationMessage(
    roomId: string,
    geoUri: string,
    description: string,
    thumbnailUri?: string,
    thumbnailInfo?: { size: number; width: number; height: number }
  ): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const content: any = {
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

      const response = await client.sendEvent(roomId, 'm.room.message' as any, content)
      info(`[MatrixEvent] 发送位置消息成功: ${roomId}`)
      return response.event_id
    } catch (err) {
      error(`[MatrixEvent] 发送位置消息失败: ${err}`)
      throw err
    }
  }

  async redactEvent(roomId: string, eventId: string, reason?: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      await client.redactEvent(roomId, eventId, undefined as any, { reason } as any)
      info(`[MatrixEvent] 撤回消息成功: ${eventId}`)
    } catch (err) {
      error(`[MatrixEvent] 撤回消息失败: ${err}`)
      throw err
    }
  }

  async sendMessageReceipt(roomId: string, eventId: string, type: ReceiptTypeValue = ReceiptType.Read): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`房间不存在: ${roomId}`)
      }
      const event = room.findEventById(eventId)
      if (!event) {
        throw new Error(`事件不存在: ${eventId}`)
      }
      await client.sendReadReceipt(event, type as any)
      info(`[MatrixEvent] 发送已读回执成功: ${eventId}`)
    } catch (err) {
      error(`[MatrixEvent] 发送已读回执失败: ${err}`)
      throw err
    }
  }

  async getEventTimeline(roomId: string, _eventId: string): Promise<EventTimeline | null> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`房间不存在: ${roomId}`)
      }

      const timelineSet = room.getUnfilteredTimelineSet()
      const timeline = timelineSet.getLiveTimeline()
      return timeline
    } catch (err) {
      error(`[MatrixEvent] 获取事件时间线失败: ${err}`)
      throw err
    }
  }

  async getRoomTimeline(roomId: string, limit: number = 50): Promise<MatrixEvent[]> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`房间不存在: ${roomId}`)
      }

      const timelineSet = room.getUnfilteredTimelineSet()
      const events = timelineSet.getLiveTimeline().getEvents()
      return events.slice(-limit)
    } catch (err) {
      error(`[MatrixEvent] 获取房间时间线失败: ${err}`)
      throw err
    }
  }

  async paginateTimeline(roomId: string, direction: 'b' | 'f' = 'b', limit: number = 50): Promise<MatrixEvent[]> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`房间不存在: ${roomId}`)
      }

      const timelineSet = room.getUnfilteredTimelineSet()
      const timelineWindow = new (client as any).TimelineWindow(client, timelineSet, {
        windowLimit: limit
      })

      await timelineWindow.paginate(direction, limit)
      const events = timelineWindow.getEvents()
      return events
    } catch (err) {
      error(`[MatrixEvent] 分页获取时间线失败: ${err}`)
      throw err
    }
  }

  async replyToEvent(roomId: string, eventId: string, text: string): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`房间不存在: ${roomId}`)
      }

      const event = room.findEventById(eventId)
      if (!event) {
        throw new Error(`事件不存在: ${eventId}`)
      }

      const content = {
        msgtype: 'm.text',
        body: text,
        'm.relates_to': {
          'm.in_reply_to': {
            event_id: eventId
          }
        }
      }

      const response = await client.sendEvent(roomId, 'm.room.message' as any, content)
      info(`[MatrixEvent] 回复消息成功: ${eventId}`)
      return response.event_id
    } catch (err) {
      error(`[MatrixEvent] 回复消息失败: ${err}`)
      throw err
    }
  }

  async editEvent(roomId: string, eventId: string, newText: string): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`房间不存在: ${roomId}`)
      }

      const event = room.findEventById(eventId)
      if (!event) {
        throw new Error(`事件不存在: ${eventId}`)
      }

      const content = {
        ...event.getContent(),
        msgtype: 'm.text',
        body: `* ${newText}`,
        'm.new_content': {
          msgtype: 'm.text',
          body: newText
        },
        'm.relates_to': {
          rel_type: 'm.replace',
          event_id: eventId
        }
      }

      const response = await client.sendEvent(roomId, 'm.room.message' as any, content)
      info(`[MatrixEvent] 编辑消息成功: ${eventId}`)
      return response.event_id
    } catch (err) {
      error(`[MatrixEvent] 编辑消息失败: ${err}`)
      throw err
    }
  }

  async reactToEvent(roomId: string, eventId: string, emoji: string): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const content = {
        'm.relates_to': {
          rel_type: 'm.annotation',
          event_id: eventId,
          key: emoji
        }
      }

      const response = await client.sendEvent(roomId, 'm.reaction' as any, content)
      info(`[MatrixEvent] 反应消息成功: ${eventId} -> ${emoji}`)
      return response.event_id
    } catch (err) {
      error(`[MatrixEvent] 反应消息失败: ${err}`)
      throw err
    }
  }

  async sendEvent(roomId: string, eventType: string, content: any): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const response = await client.sendEvent(roomId, eventType as any, content)
      info(`[MatrixEvent] 发送事件成功: ${roomId}, ${eventType}`)
      return response.event_id
    } catch (err) {
      error(`[MatrixEvent] 发送事件失败: ${err}`)
      throw err
    }
  }
}

export const matrixEventService = new MatrixEventService()
export default matrixEventService
