import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk'
import { TimelineWindow, ReceiptType } from 'matrix-js-sdk'
import type { IEventRelation, EventTimeline } from '@/types/matrix-js-sdk'
import matrixClientService from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

const MESSAGE_EVENT_TYPE = 'm.room.message' as const
const REACTION_EVENT_TYPE = 'm.reaction' as const

/**
 * 消息内容接口
 */
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

/**
 * 媒体信息接口
 */
export interface IMediaInfo {
  size?: number
  mimetype?: string
  w?: number
  h?: number
  duration?: number
  thumbnail_url?: string
  thumbnail_info?: IThumbnailInfo
}

/**
 * 缩略图信息接口
 */
export interface IThumbnailInfo {
  size: number
  w: number
  h: number
  mimetype: string
}

/**
 * 发送消息选项
 */
export interface SendMessageOptions {
  roomId: string
  content: IMessageContent
  eventType?: string
  relation?: IEventRelation
  /** 是否为阅后即焚消息 (synapse-rust 扩展) */
  burnAfterRead?: boolean
  /** 阅后即焚的过期时间（秒） */
  burnDuration?: number
  /** 是否为置顶/Sticky 消息 (MSC4354) */
  isSticky?: boolean
}

/**
 * Matrix 事件服务
 *
 * 负责发送、撤回、编辑和查询 Matrix 事件。
 *
 * @example
 * ```typescript
 * const eventService = matrixEventService;
 *
 * // 发送文本消息
 * const eventId = await eventService.sendTextMessage('!roomId:server', 'Hello World');
 *
 * // 发送图片消息
 * await eventService.sendImageMessage('!roomId:server', 'mxc://server/media', { size: 1024, mimetype: 'image/png' });
 * ```
 */
class MatrixEventService {
  /**
   * 发送文本消息
   *
   * @param roomId - 房间 ID
   * @param text - 消息文本
   * @param html - HTML 格式内容 (可选)
   * @returns 事件 ID
   * @throws {Error} 如果客户端未初始化或发送失败
   */
  async sendTextMessage(roomId: string, text: string, html?: string): Promise<string> {
    const client = this.getClient()

    try {
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '发送文本消息失败'
      error(`[MatrixEvent] ${errorMessage}`)
      throw err
    }
  }

  /**
   * 发送图片消息
   *
   * @param roomId - 房间 ID
   * @param fileOrUrl - 文件对象或 MXC URL
   * @param mediaInfo - 媒体信息 (可选)
   * @param filename - 文件名 (可选)
   * @returns 事件 ID
   * @throws {Error} 如果客户端未初始化或发送失败
   */
  async sendImageMessage(
    roomId: string,
    fileOrUrl: File | string,
    mediaInfo?: { size: number; mimetype: string; width?: number; height?: number },
    filename?: string
  ): Promise<string> {
    const client = this.getClient()

    try {
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
        } as any)

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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '发送图片消息失败'
      error(`[MatrixEvent] ${errorMessage}`)
      throw err
    }
  }

  /**
   * 发送文件消息
   *
   * @param roomId - 房间 ID
   * @param fileOrUrl - 文件对象或 MXC URL
   * @param mediaInfo - 媒体信息 (可选)
   * @param filename - 文件名 (可选)
   * @returns 事件 ID
   * @throws {Error} 如果客户端未初始化或发送失败
   */
  async sendFileMessage(
    roomId: string,
    fileOrUrl: File | string,
    mediaInfo?: { size: number; mimetype: string },
    filename?: string
  ): Promise<string> {
    const client = this.getClient()

    try {
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
        } as any)

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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '发送文件消息失败'
      error(`[MatrixEvent] ${errorMessage}`)
      throw err
    }
  }

  /**
   * 发送视频消息
   *
   * @param roomId - 房间 ID
   * @param fileOrUrl - 文件对象或 MXC URL
   * @param mediaInfo - 媒体信息 (可选)
   * @param filename - 文件名 (可选)
   * @param thumbnailUri - 缩略图 URL (可选)
   * @param thumbnailInfo - 缩略图信息 (可选)
   * @returns 事件 ID
   * @throws {Error} 如果客户端未初始化或发送失败
   */
  async sendVideoMessage(
    roomId: string,
    fileOrUrl: File | string,
    mediaInfo?: { size: number; mimetype: string; width?: number; height?: number; duration?: number },
    filename?: string,
    thumbnailUri?: string,
    thumbnailInfo?: { size: number; width: number; height: number }
  ): Promise<string> {
    const client = this.getClient()

    try {
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
        } as any)

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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '发送视频消息失败'
      error(`[MatrixEvent] ${errorMessage}`)
      throw err
    }
  }

  /**
   * 发送音频消息
   *
   * @param roomId - 房间 ID
   * @param fileOrUrl - 文件对象或 MXC URL
   * @param mediaInfo - 媒体信息 (可选)
   * @param filename - 文件名 (可选)
   * @returns 事件 ID
   * @throws {Error} 如果客户端未初始化或发送失败
   */
  async sendAudioMessage(
    roomId: string,
    fileOrUrl: File | string,
    mediaInfo?: { size: number; mimetype: string; duration?: number },
    filename?: string
  ): Promise<string> {
    const client = this.getClient()

    try {
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
        } as any)

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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '发送音频消息失败'
      error(`[MatrixEvent] ${errorMessage}`)
      throw err
    }
  }

  /**
   * 发送语音消息
   *
   * @param roomId - 房间 ID
   * @param contentUri - MXC URL
   * @param voiceInfo - 语音信息
   * @param filename - 文件名 (默认: voice.ogg)
   * @returns 事件 ID
   * @throws {Error} 如果客户端未初始化或发送失败
   */
  async sendVoiceMessage(
    roomId: string,
    contentUri: string,
    voiceInfo: { size: number; duration: number },
    filename = 'voice.ogg'
  ): Promise<string> {
    const client = this.getClient()

    try {
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '发送语音消息失败'
      error(`[MatrixEvent] ${errorMessage}`)
      throw err
    }
  }

  /**
   * 发送位置消息
   *
   * @param roomId - 房间 ID
   * @param geoUri - Geo URI (如 geo:latitude,longitude)
   * @param description - 位置描述
   * @param thumbnailUri - 缩略图 URL (可选)
   * @param thumbnailInfo - 缩略图信息 (可选)
   * @returns 事件 ID
   * @throws {Error} 如果客户端未初始化或发送失败
   */
  async sendLocationMessage(
    roomId: string,
    geoUri: string,
    description: string,
    thumbnailUri?: string,
    thumbnailInfo?: { size: number; width: number; height: number }
  ): Promise<string> {
    const client = this.getClient()

    try {
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '发送位置消息失败'
      error(`[MatrixEvent] ${errorMessage}`)
      throw err
    }
  }

  /**
   * 撤回事件
   *
   * @param roomId - 房间 ID
   * @param eventId - 事件 ID
   * @param reason - 撤回原因 (可选)
   * @throws {Error} 如果客户端未初始化或撤回失败
   */
  async redactEvent(roomId: string, eventId: string, reason?: string): Promise<void> {
    const client = this.getClient()

    try {
      await client.redactEvent(roomId, eventId, undefined, reason ? { reason } : undefined)
      info(`[MatrixEvent] 撤回消息成功: ${eventId}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '撤回消息失败'
      error(`[MatrixEvent] ${errorMessage}`)
      throw err
    }
  }

  /**
   * 发送已读回执
   *
   * @param roomId - 房间 ID
   * @param eventId - 事件 ID
   * @param type - 回执类型 (默认: m.read)
   * @throws {Error} 如果客户端未初始化或发送失败
   */
  async sendMessageReceipt(roomId: string, eventId: string, type: ReceiptType = ReceiptType.Read): Promise<void> {
    const client = this.getClient()

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`房间不存在: ${roomId}`)
      }
      const event = room.findEventById(eventId)
      if (!event) {
        throw new Error(`事件不存在: ${eventId}`)
      }
      await client.sendReadReceipt(event, type)
      info(`[MatrixEvent] 发送已读回执成功: ${eventId}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '发送已读回执失败'
      error(`[MatrixEvent] ${errorMessage}`)
      throw err
    }
  }

  /**
   * 获取事件时间线
   *
   * @param roomId - 房间 ID
   * @param _eventId - 事件 ID (暂未使用)
   * @returns 事件时间线
   * @throws {Error} 如果客户端未初始化或房间不存在
   */
  async getEventTimeline(roomId: string, _eventId: string): Promise<EventTimeline | null> {
    const client = this.getClient()

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`房间不存在: ${roomId}`)
      }

      const timelineSet = room.getUnfilteredTimelineSet()
      const timeline = timelineSet.getLiveTimeline()
      return timeline
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取事件时间线失败'
      error(`[MatrixEvent] ${errorMessage}`)
      throw err
    }
  }

  /**
   * 获取房间时间线
   *
   * @param roomId - 房间 ID
   * @param limit - 返回事件数量限制 (默认: 50)
   * @returns 事件列表
   * @throws {Error} 如果客户端未初始化或房间不存在
   */
  async getRoomTimeline(roomId: string, limit = 50): Promise<MatrixEvent[]> {
    const client = this.getClient()

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`房间不存在: ${roomId}`)
      }

      const timelineSet = room.getUnfilteredTimelineSet()
      const events = timelineSet.getLiveTimeline().getEvents()
      return events.slice(-limit)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取房间时间线失败'
      error(`[MatrixEvent] ${errorMessage}`)
      throw err
    }
  }

  /**
   * 分页获取时间线
   *
   * @param roomId - 房间 ID
   * @param direction - 分页方向 ('b' 向后, 'f' 向前)
   * @param limit - 每页事件数量 (默认: 50)
   * @returns 事件列表
   * @throws {Error} 如果客户端未初始化或分页失败
   */
  async paginateTimeline(roomId: string, direction: 'b' | 'f' = 'b', limit = 50): Promise<MatrixEvent[]> {
    const client = this.getClient()

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`房间不存在: ${roomId}`)
      }

      const timelineSet = room.getUnfilteredTimelineSet()
      const timelineWindow = new (TimelineWindow as any)(client, timelineSet, {
        windowLimit: limit
      })

      await timelineWindow.paginate(direction as any, limit)
      const events = timelineWindow.getEvents()
      return events
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '分页获取时间线失败'
      error(`[MatrixEvent] ${errorMessage}`)
      throw err
    }
  }

  /**
   * 回复事件
   *
   * @param roomId - 房间 ID
   * @param eventId - 要回复的事件 ID
   * @param text - 回复文本
   * @returns 新事件 ID
   * @throws {Error} 如果客户端未初始化或回复失败
   */
  async replyToEvent(roomId: string, eventId: string, text: string): Promise<string> {
    const client = this.getClient()

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`房间不存在: ${roomId}`)
      }

      const event = room.findEventById(eventId)
      if (!event) {
        throw new Error(`事件不存在: ${eventId}`)
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '回复消息失败'
      error(`[MatrixEvent] ${errorMessage}`)
      throw err
    }
  }

  /**
   * 编辑事件
   *
   * @param roomId - 房间 ID
   * @param eventId - 要编辑的事件 ID
   * @param newText - 新文本内容
   * @returns 新事件 ID
   * @throws {Error} 如果客户端未初始化或编辑失败
   */
  async editEvent(roomId: string, eventId: string, newText: string): Promise<string> {
    const client = this.getClient()

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`房间不存在: ${roomId}`)
      }

      const event = room.findEventById(eventId)
      if (!event) {
        throw new Error(`事件不存在: ${eventId}`)
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '编辑消息失败'
      error(`[MatrixEvent] ${errorMessage}`)
      throw err
    }
  }

  /**
   * 对事件添加表情反应
   *
   * @param roomId - 房间 ID
   * @param eventId - 事件 ID
   * @param emoji - 表情符号
   * @returns 反应事件 ID
   * @throws {Error} 如果客户端未初始化或发送失败
   */
  async reactToEvent(roomId: string, eventId: string, emoji: string): Promise<string> {
    const client = this.getClient()

    try {
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '反应消息失败'
      error(`[MatrixEvent] ${errorMessage}`)
      throw err
    }
  }

  /**
   * 发送自定义事件
   *
   * @param roomId - 房间 ID
   * @param eventType - 事件类型
   * @param content - 事件内容
   * @returns 事件 ID
   * @throws {Error} 如果客户端未初始化或发送失败
   */
  async sendEvent(roomId: string, eventType: string, content: Record<string, unknown>): Promise<string> {
    const client = this.getClient()

    try {
      const response = await client.sendEvent(roomId, eventType as any, content)
      info(`[MatrixEvent] 发送事件成功: ${roomId}, ${eventType}`)
      return response.event_id
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '发送事件失败'
      error(`[MatrixEvent] ${errorMessage}`)
      throw err
    }
  }

  /**
   * 发送通用消息
   */
  async sendMessage(options: SendMessageOptions): Promise<MatrixEvent> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Client not initialized')
    }

    const { roomId, content, eventType = 'm.room.message', relation } = options

    const messageContent: any = { ...content }

    if (relation) {
      messageContent['m.relates_to'] = relation
    }

    // 处理阅后即焚
    if (options.burnAfterRead) {
      messageContent['org.matrix.msc_burn_after_read'] = {
        enabled: true,
        duration: options.burnDuration || 60
      }
    }

    // 处理 Sticky Event
    if (options.isSticky) {
      messageContent['org.matrix.msc4354.sticky'] = true
    }

    const response = await client.sendEvent(roomId, eventType as any, messageContent)

    // 记录遥测数据
    const telemetry = matrixClientService.getTelemetry()
    if (telemetry) {
      telemetry.trackMessageSent(roomId, messageContent.msgtype || eventType)
    }

    return response as any
  }

  /**
   * 获取 Matrix 客户端实例
   *
   * @returns Matrix 客户端实例
   * @throws {Error} 如果客户端未初始化
   */
  private getClient(): MatrixClient {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }
    return client
  }
}

export type { ReceiptType }
export type ReceiptTypeValue = ReceiptType

export const matrixEventService = new MatrixEventService()
export default matrixEventService
