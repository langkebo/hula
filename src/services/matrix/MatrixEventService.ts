import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk'
import { isMessageEventType, MatrixBurnDuration, MatrixEventType, MatrixFormat } from '@/common/matrixConstants'
import { MessageStatusEnum, MsgEnum } from '@/enums'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import type { MessageType } from '@/types/message'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from './BaseMatrixService'
import matrixMessageAdapter from './messaging/MatrixMessageAdapter'
import { matrixRoomQueryService } from './room/QueryService'

const logger = createLogger('MatrixEvent')

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
      logger.info(`离线状态，已将事件发送操作入队: ${roomId}/${eventType} (queueId: ${id})`)
      // 返回一个带有前缀的临时 ID，以便前端识别
      return `local-${id}`
    }

    const client = this.getClient()

    // 预检查：加密房间但 crypto 未初始化时提前失败，避免触发 SDK 发送队列阻塞
    // （SDK 内部队列被失败事件阻塞后，后续所有发送都会报 "Event blocked by other events not yet sent"）
    if (typeof client.isRoomEncrypted === 'function' && client.isRoomEncrypted(roomId)) {
      const cryptoClient = client as MatrixClient & { getCrypto?: () => unknown }
      if (typeof cryptoClient.getCrypto !== 'function' || !cryptoClient.getCrypto()) {
        logger.error(`发送事件失败（加密房间但 crypto 未初始化）: ${roomId}/${eventType}`)
        throw new Error('This room is configured to use encryption, but your client does not support encryption.')
      }
    }

    try {
      const response = await client.sendEvent(roomId, eventType, content)
      const eventId = this.extractEventId(response)
      logger.info(`发送事件成功: ${roomId}/${eventType}/${eventId}`)
      return eventId
    } catch (err) {
      logger.error(`发送事件失败: ${err}`)
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
      logger.error(`发送文本消息失败: ${roomId} ${err}`)
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
      logger.error(`发送图片消息失败: ${roomId} ${err}`)
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
      logger.error(`发送文件消息失败: ${roomId} ${err}`)
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
      logger.error(`发送视频消息失败: ${roomId} ${err}`)
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
      logger.error(`发送音频消息失败: ${roomId} ${err}`)
      throw err
    }
  }

  async redactEvent(roomId: string, eventId: string, reason?: string): Promise<void> {
    const client = this.getClient()

    try {
      await client.redactEvent(roomId, eventId, undefined, reason ? { reason } : undefined)
      logger.info(`撤回事件成功: ${roomId}/${eventId}`)
    } catch (err) {
      logger.error(`撤回事件失败: ${err}`)
      throw err
    }
  }

  convertEventToMessageType(event: MatrixEvent): MessageType {
    const content = event.getContent()
    return {
      clientKey: event.getId() ?? '',
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

    // 位置/信标消息复用 C6 的 MatrixMessageAdapter 解析为 LocationBody/BeaconBody，
    // 其余类型保持原始 content 透传，兼容现有渲染路径。
    const body: MessageType['message']['body'] =
      msgType === MsgEnum.LOCATION || msgType === MsgEnum.BEACON
        ? (matrixMessageAdapter.convertMatrixContent(
            content as Record<string, unknown>,
            msgType
          ) as MessageType['message']['body'])
        : content

    return {
      clientKey: event.getId() || '',
      message: {
        id: event.getId() || '',
        roomId: room.roomId,
        sendTime: event.getTs?.() || Date.now(),
        type: msgType,
        body,
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

  async getPagedRoomMessages(
    roomId: string,
    pageSize: number,
    cursor: string = ''
  ): Promise<{
    messages: MessageType[]
    isLast: boolean
    cursor: string
  }> {
    const room = await matrixRoomQueryService.getRoom(roomId, false)
    if (!room) {
      return { messages: [], isLast: true, cursor: '' }
    }

    let timeline = room.getLiveTimeline()
    let events = timeline.getEvents()

    // SlidingSync 的 timeline_limit 较小（10-50），如果 timeline 为空或事件不足，
    // 通过 /messages API（client.scrollback）从服务端拉取历史消息。
    // 场景：client 重建后 room store 被清空，SlidingSync 尚未填充 timeline，
    // 或房间长时间无活动导致 SlidingSync 未返回 timeline 事件。
    if (events.length === 0) {
      try {
        const client = this.getClient()
        await client.scrollback(room, Math.max(pageSize, 30))
        // scrollback 会将历史事件插入到 timeline 中，重新获取
        timeline = room.getLiveTimeline()
        events = timeline.getEvents()
      } catch (err) {
        logger.error(`scrollback 获取历史消息失败: ${roomId}`, err)
        // scrollback 失败时返回空结果，不阻塞 UI
        return { messages: [], isLast: true, cursor: '' }
      }
    }

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
