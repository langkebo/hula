import { error, info } from '@tauri-apps/plugin-log'
import type { MatrixEvent, Room } from 'matrix-js-sdk'
import { isMessageEventType, MatrixBurnDuration, MatrixEventType, MatrixFormat } from '@/common/matrixConstants'
import { MessageStatusEnum, MsgEnum } from '@/enums'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import type { MessageType } from '@/stores/domains/chat/chat/types'
import { ReceiptType } from '@/types/matrix-js-sdk'
import { BaseMatrixService } from './BaseMatrixService'
import matrixMessageAdapter from './messaging/MatrixMessageAdapter'
import { matrixMessageRelationService } from './messaging/MatrixMessageRelationService'
import { matrixReactionService } from './messaging/MatrixReactionService'
import { matrixReceiptService } from './messaging/MatrixReceiptService'
import matrixRoomService from './room/MatrixRoomService'

interface UploadResponse {
  content_uri?: string
  contentUri?: string
}

interface MediaInfo {
  size?: number
  mimetype?: string
  width?: number
  height?: number
  duration?: number
}

interface ThumbnailInfo {
  width?: number
  height?: number
  size?: number
  mimetype?: string
}

interface VoiceInfo {
  size?: number
  duration?: number
}

type EventContent = Record<string, unknown>
type MessageSendSource = File | string

class MatrixEventService extends BaseMatrixService {
  private extractEventId(response: unknown): string {
    if (
      typeof response === 'object' &&
      response !== null &&
      'event_id' in response &&
      typeof response.event_id === 'string'
    ) {
      return response.event_id
    }
    throw new Error(this.t('matrix_error.messaging.event_id_missing'))
  }

  private extractContentUri(response: unknown): string {
    if (typeof response === 'string') {
      return response
    }

    const uploadResponse = response as UploadResponse | null
    if (uploadResponse?.content_uri) {
      return uploadResponse.content_uri
    }
    if (uploadResponse?.contentUri) {
      return uploadResponse.contentUri
    }

    throw new Error(this.t('matrix_error.messaging.media_uri_missing'))
  }

  private async resolveContentUri(source: MessageSendSource, mimetype?: string): Promise<string> {
    if (typeof source === 'string') {
      return source
    }

    const client = this.getClient()
    const uploadOptions = source.type || mimetype ? { type: source.type || mimetype } : undefined
    const response = await client.uploadContent(source, uploadOptions)
    return this.extractContentUri(response)
  }

  async sendEvent(roomId: string, eventType: string, content: EventContent): Promise<string> {
    if (!navigator.onLine) {
      const id = offlineQueueService.enqueue('message', roomId, {
        roomId,
        eventType,
        content
      })
      info(`[MatrixEvent] 离线状态，已将事件发送操作入队: ${roomId}/${eventType} (queueId: ${id})`)
      // 返回一个带有前缀的临时 ID，以便前端识别
      return `local-${id}`
    }

    const client = this.getClient()

    try {
      const response = await client.sendEvent(roomId, eventType, content)
      const eventId = this.extractEventId(response)
      info(`[MatrixEvent] 发送事件成功: ${roomId}/${eventType}/${eventId}`)
      return eventId
    } catch (err) {
      error(`[MatrixEvent] 发送事件失败: ${err}`)
      throw err
    }
  }

  async sendTextMessage(roomId: string, body: string, html?: string): Promise<string> {
    try {
      const content: EventContent = {
        msgtype: 'm.text',
        body
      }

      if (html) {
        content.format = MatrixFormat.HTML
        content.formatted_body = html
      }

      return this.sendEvent(roomId, MatrixEventType.ROOM_MESSAGE, content)
    } catch (err) {
      error(`[MatrixEvent] 发送文本消息失败: ${roomId} ${err}`)
      throw err
    }
  }

  async sendImageMessage(
    roomId: string,
    source: MessageSendSource,
    infoContent?: MediaInfo,
    filename?: string
  ): Promise<string> {
    try {
      const contentUri = await this.resolveContentUri(source, infoContent?.mimetype)
      const content: EventContent = {
        msgtype: 'm.image',
        body: filename ?? (typeof source === 'string' ? 'image' : source.name),
        info: {
          size: typeof source === 'string' ? infoContent?.size : source.size,
          mimetype: infoContent?.mimetype ?? (typeof source === 'string' ? undefined : source.type),
          w: infoContent?.width,
          h: infoContent?.height
        },
        url: contentUri
      }

      return this.sendEvent(roomId, MatrixEventType.ROOM_MESSAGE, content)
    } catch (err) {
      error(`[MatrixEvent] 发送图片消息失败: ${roomId} ${err}`)
      throw err
    }
  }

  async sendFileMessage(
    roomId: string,
    source: MessageSendSource,
    infoContent?: MediaInfo,
    filename?: string
  ): Promise<string> {
    try {
      const contentUri = await this.resolveContentUri(source, infoContent?.mimetype)
      const content: EventContent = {
        msgtype: 'm.file',
        body: filename ?? (typeof source === 'string' ? 'file' : source.name),
        info: {
          size: typeof source === 'string' ? infoContent?.size : source.size,
          mimetype: infoContent?.mimetype ?? (typeof source === 'string' ? undefined : source.type)
        },
        url: contentUri
      }

      return this.sendEvent(roomId, MatrixEventType.ROOM_MESSAGE, content)
    } catch (err) {
      error(`[MatrixEvent] 发送文件消息失败: ${roomId} ${err}`)
      throw err
    }
  }

  async sendVideoMessage(
    roomId: string,
    source: MessageSendSource,
    infoContent?: MediaInfo,
    filename?: string,
    thumbnailUrl?: string,
    thumbnailInfo?: ThumbnailInfo
  ): Promise<string> {
    try {
      const contentUri = await this.resolveContentUri(source, infoContent?.mimetype)
      const content: EventContent = {
        msgtype: 'm.video',
        body: filename ?? (typeof source === 'string' ? 'video' : source.name),
        info: {
          size: typeof source === 'string' ? infoContent?.size : source.size,
          mimetype: infoContent?.mimetype ?? (typeof source === 'string' ? undefined : source.type),
          duration: infoContent?.duration,
          w: infoContent?.width,
          h: infoContent?.height,
          thumbnail_url: thumbnailUrl,
          thumbnail_info: thumbnailInfo
            ? {
                w: thumbnailInfo.width,
                h: thumbnailInfo.height,
                size: thumbnailInfo.size,
                mimetype: thumbnailInfo.mimetype
              }
            : undefined
        },
        url: contentUri
      }

      return this.sendEvent(roomId, MatrixEventType.ROOM_MESSAGE, content)
    } catch (err) {
      error(`[MatrixEvent] 发送视频消息失败: ${roomId} ${err}`)
      throw err
    }
  }

  async sendAudioMessage(
    roomId: string,
    source: MessageSendSource,
    infoContent?: MediaInfo,
    filename?: string
  ): Promise<string> {
    try {
      const contentUri = await this.resolveContentUri(source, infoContent?.mimetype)
      const content: EventContent = {
        msgtype: 'm.audio',
        body: filename ?? (typeof source === 'string' ? 'audio' : source.name),
        info: {
          size: typeof source === 'string' ? infoContent?.size : source.size,
          mimetype: infoContent?.mimetype ?? (typeof source === 'string' ? undefined : source.type),
          duration: infoContent?.duration
        },
        url: contentUri
      }

      return this.sendEvent(roomId, MatrixEventType.ROOM_MESSAGE, content)
    } catch (err) {
      error(`[MatrixEvent] 发送音频消息失败: ${roomId} ${err}`)
      throw err
    }
  }

  async sendVoiceMessage(
    roomId: string,
    source: MessageSendSource,
    voiceInfo: VoiceInfo,
    filename = 'voice.ogg'
  ): Promise<string> {
    try {
      const contentUri = await this.resolveContentUri(source, 'audio/ogg')
      const content: EventContent = {
        msgtype: 'm.audio',
        body: filename,
        info: {
          size: typeof source === 'string' ? voiceInfo.size : source.size,
          duration: voiceInfo.duration,
          mimetype: typeof source === 'string' ? 'audio/ogg' : source.type || 'audio/ogg'
        },
        url: contentUri,
        'm.voice': {},
        'org.matrix.msc1767.audio': {
          duration: voiceInfo.duration
        }
      }

      return this.sendEvent(roomId, MatrixEventType.ROOM_MESSAGE, content)
    } catch (err) {
      error(`[MatrixEvent] 发送语音消息失败: ${roomId} ${err}`)
      throw err
    }
  }

  async sendLocationMessage(roomId: string, geoUri: string, description: string): Promise<string> {
    try {
      const content: EventContent = {
        msgtype: 'm.location',
        body: description,
        geo_uri: geoUri
      }

      return this.sendEvent(roomId, MatrixEventType.ROOM_MESSAGE, content)
    } catch (err) {
      error(`[MatrixEvent] 发送位置消息失败: ${roomId} ${err}`)
      throw err
    }
  }

  async redactEvent(roomId: string, eventId: string, reason?: string): Promise<void> {
    const client = this.getClient()

    try {
      await client.redactEvent(roomId, eventId, undefined, reason ? { reason } : undefined)
      info(`[MatrixEvent] 撤回事件成功: ${roomId}/${eventId}`)
    } catch (err) {
      error(`[MatrixEvent] 撤回事件失败: ${err}`)
      throw err
    }
  }

  async sendMessageReceipt(roomId: string, eventId: string, receiptType: string = ReceiptType.Read): Promise<void> {
    const client = this.getClient()

    if (receiptType === ReceiptType.Read) {
      await matrixReceiptService.sendReadReceiptByEventId(roomId, eventId)
      return
    }

    const room = client.getRoom(roomId)
    if (!room) {
      throw new Error(this.t('matrix_error.common.room_not_found', { roomId }))
    }

    const targetEvent = room.findEventById(eventId)
    if (!targetEvent) {
      throw new Error(this.t('matrix_error.messaging.event_not_found', { eventId }))
    }

    try {
      await client.sendReadReceipt(targetEvent, receiptType as ReceiptType)
      info(`[MatrixEvent] 发送回执成功: ${roomId}/${eventId}/${receiptType}`)
    } catch (err) {
      error(`[MatrixEvent] 发送回执失败: ${err}`)
      throw err
    }
  }

  async getRoomTimeline(roomId: string, limit = 50): Promise<MatrixEvent[]> {
    try {
      const client = this.getClient()
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(this.t('matrix_error.common.room_not_found', { roomId }))
      }

      const events = room.getLiveTimeline().getEvents()
      return events.slice(Math.max(events.length - limit, 0))
    } catch (err) {
      error(`[MatrixEvent] 获取房间时间线失败: ${roomId} ${err}`)
      throw err
    }
  }

  async paginateTimeline(roomId: string, direction: 'b' | 'f' = 'b', limit = 50): Promise<MatrixEvent[]> {
    const client = this.getClient()
    const room = client.getRoom(roomId)
    if (!room) {
      throw new Error(this.t('matrix_error.common.room_not_found', { roomId }))
    }

    const beforeEvents = room.getLiveTimeline().getEvents()
    const beforeLength = beforeEvents.length

    try {
      if (direction === 'b') {
        await client.scrollback(room, limit)
      }

      const events = room.getLiveTimeline().getEvents()
      const addedCount = Math.max(events.length - beforeLength, 0)

      if (addedCount > 0) {
        return direction === 'b' ? events.slice(0, addedCount) : events.slice(events.length - addedCount)
      }

      return direction === 'b' ? events.slice(0, limit) : events.slice(Math.max(events.length - limit, 0))
    } catch (err) {
      error(`[MatrixEvent] 分页时间线失败: ${err}`)
      throw err
    }
  }

  async replyToEvent(roomId: string, eventId: string, body: string, html?: string): Promise<string> {
    try {
      this.getClient()
      return await matrixMessageRelationService.replyToMessage(roomId, eventId, { body, html })
    } catch (err) {
      error(`[MatrixEvent] 回复消息失败: ${roomId}/${eventId} ${err}`)
      throw err
    }
  }

  async editEvent(roomId: string, eventId: string, body: string, html?: string): Promise<string> {
    try {
      this.getClient()
      return await matrixMessageRelationService.editMessage(roomId, eventId, { body, html })
    } catch (err) {
      error(`[MatrixEvent] 编辑消息失败: ${roomId}/${eventId} ${err}`)
      throw err
    }
  }

  async reactToEvent(roomId: string, eventId: string, emoji: string): Promise<string> {
    try {
      this.getClient()
      return await matrixReactionService.addReaction(roomId, eventId, emoji)
    } catch (err) {
      error(`[MatrixEvent] 添加反应失败: ${roomId}/${eventId} ${err}`)
      throw err
    }
  }

  convertEventToMessageType(event: MatrixEvent): MessageType {
    const content = event.getContent()
    return {
      fromUser: {
        uid: event.getSender() ?? '',
        username: event.getSender() ?? '',
        avatar: ''
      },
      message: {
        id: event.getId() ?? '',
        roomId: event.getRoomId() ?? '',
        type: MsgEnum.TEXT,
        body: { content: content.body as string },
        sendTime: event.getTs(),
        messageMarks: {},
        status: MessageStatusEnum.SUCCESS
      },
      sendTime: event.getTs()
    }
  }

  convertEventToMessage(event: MatrixEvent, room: Room): MessageType | null {
    const content = event.getContent()
    const sender = event.getSender()
    const member = room.getMember(sender || '')
    const resolvedMsgType = matrixMessageAdapter.getMsgTypeFromMatrixEvent(event)
    const msgType = resolvedMsgType === MsgEnum.UNKNOWN ? MsgEnum.TEXT : resolvedMsgType

    const burnAfterReadMeta = content?.['m.burn_after_read'] as { expires_in?: number } | undefined
    const burnAfterRead = !!burnAfterReadMeta
    const burnExpiresIn = burnAfterReadMeta?.expires_in || MatrixBurnDuration.DEFAULT_MS
    const burnRemainingSeconds = burnAfterRead ? Math.round(burnExpiresIn / 1000) : undefined

    return {
      message: {
        id: event.getId() || '',
        roomId: room.roomId,
        sendTime: event.getTs?.() || Date.now(),
        type: msgType,
        body: content,
        status: MessageStatusEnum.SUCCESS,
        burnAfterRead,
        burnRemainingSeconds,
        isBurning: false,
        isBurned: false
      },
      fromUser: {
        uid: sender || '',
        username: member?.name || sender || '',
        avatar: member?.getMxcAvatarUrl?.() ?? undefined
      }
    }
  }

  async getRoomMessages(roomId: string, limit = 50): Promise<MessageType[]> {
    const rawEvents = await this.getRoomTimeline(roomId, limit)
    return rawEvents
      .filter((event) => isMessageEventType(event.getType()))
      .map((event) => this.convertEventToMessageType(event))
  }

  async getMoreRoomMessages(
    roomId: string,
    direction: 'f' | 'b' = 'b',
    limit = 50
  ): Promise<{ messages: MessageType[]; hasMore: boolean }> {
    const rawEvents = await this.paginateTimeline(roomId, direction, limit)
    const messages = rawEvents
      .filter((event) => isMessageEventType(event.getType()))
      .map((event) => this.convertEventToMessageType(event))
    return { messages, hasMore: rawEvents.length >= limit }
  }

  async getPagedRoomMessages(
    roomId: string,
    pageSize: number,
    cursor: string = ''
  ): Promise<{
    messages: MessageType[]
    isLast: boolean
    cursor: string
  }> {
    const room = await matrixRoomService.getRoom(roomId, false)
    if (!room) {
      return { messages: [], isLast: true, cursor: '' }
    }

    const timeline = room.getLiveTimeline()
    const events = timeline.getEvents()

    const startIndex = cursor ? events.findIndex((e: MatrixEvent) => e.getId() === cursor) : 0
    const endIndex = Math.min(startIndex + pageSize, events.length)
    const pageEvents = events.slice(startIndex, endIndex)

    const messages: MessageType[] = []
    for (const event of pageEvents) {
      if (isMessageEventType(event.getType())) {
        const msg = this.convertEventToMessage(event, room)
        if (msg) {
          messages.push(msg)
        }
      }
    }

    return {
      messages,
      isLast: endIndex >= events.length,
      cursor: pageEvents[pageEvents.length - 1]?.getId() || ''
    }
  }
}

export const matrixEventService = new MatrixEventService()
export default matrixEventService
