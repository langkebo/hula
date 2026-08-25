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

// scrollback / 反向分页的超时保护：避免 SlidingSync 下 scrollback 挂起导致 UI 永久卡在骨架屏。
const SCROLLBACK_TIMEOUT_MS = 15000
const PAGINATE_TIMEOUT_MS = 15000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`操作超时(${ms}ms)`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

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
    const isBadEncrypted = content?.msgtype === 'm.bad.encrypted'
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
        body: { content: isBadEncrypted ? '[无法解密的消息]' : (content.body as string) },
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

    const timeline = room.getLiveTimeline()
    const client = this.getClient()
    let events = timeline.getEvents()

    // 本客户端使用 SlidingSync，live timeline 仅含 1~10 条窗口
    // （MatrixSyncManager.timelineLimit 按网络 1/3/5/10）。历史消息不能依赖该窗口，
    // 必须用 /messages 反向分页拉取：
    //   - 初始加载（cursor 为空）：live 窗口为空或不足一页时，scrollback 从服务端补齐最近历史；
    //   - 上拉加载更早（cursor 非空）：client.paginateEventTimeline 反向翻页（/messages），
    //     仅返回本次新加载的更早事件，游标前移至新的最旧一条。
    let pageEvents: MatrixEvent[]
    let isLast = false

    if (cursor) {
      // 上拉加载更早历史：用 /messages 反向分页，兼容 SlidingSync，不依赖 live timeline 窗口。
      try {
        const before = events.length
        const hasMore = await withTimeout(
          client.paginateEventTimeline(timeline, { backwards: true, limit: pageSize }),
          PAGINATE_TIMEOUT_MS
        )
        events = room.getLiveTimeline().getEvents()
        const added = events.length - before
        // 仅返回本次新加载的更早事件（已 prepend 到时间线起点）。
        pageEvents = added > 0 ? events.slice(0, added) : []
        // 反向分页无新增 或 已无更早历史 => 终止上拉，避免死循环。
        isLast = !hasMore || added === 0
      } catch (err) {
        logger.error(`加载更早消息失败: ${roomId}`, err)
        return { messages: [], isLast: true, cursor: '' }
      }
    } else {
      // 初始加载：live 窗口不足一页时，从服务端补齐最近 pageSize 条，避免“只显示最后一条”。
      if (events.length < pageSize) {
        try {
          await withTimeout(client.scrollback(room, Math.max(pageSize, 30)), SCROLLBACK_TIMEOUT_MS)
          events = room.getLiveTimeline().getEvents()
        } catch (err) {
          logger.error(`scrollback 补齐初始历史失败: ${roomId}`, err)
          // 即使失败也返回已有时窗内容，不阻塞 UI
        }
      }
      // 返回当前时间线中的全部消息（已含 scrollback 补齐的最近历史）。
      pageEvents = events
      // 不足一页 => 已无更多历史（全部拉取完毕）。
      isLast = events.length < pageSize
    }

    const messages: MessageType[] = []
    for (const event of pageEvents) {
      if (isMessageEventType(event.getType())) {
        const msg = this.convertEventToMessage(event, room)
        if (msg) {
          messages.push(msg)
        }
      }
    }

    // 游标锚定本页最旧消息 id，供后续 loadMore 继续向前翻页。
    const anchor = pageEvents[0]?.getId() || ''
    return {
      messages,
      isLast,
      cursor: anchor
    }
  }
}

export const matrixEventService = new MatrixEventService()
export default matrixEventService
