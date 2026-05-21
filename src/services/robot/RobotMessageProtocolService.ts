import {
  MatrixContentField,
  MatrixEventType,
  MatrixFormat,
  MatrixMsgType,
  MatrixRelType
} from '@/common/matrixConstants'
import { matrixEventService } from '@/services/matrix/MatrixEventService'
import { matrixMessageService } from '@/services/matrix/messaging/MatrixMessageService'
import { createLogger } from '@/utils/Logger'
import type { RobotDeliveryMode, RobotDispatchMessage, RobotMessageKind, RobotProtocolEnvelope } from './types'

const logger = createLogger('RobotMessageProtocolService')

export interface RobotDeliveryRecord {
  traceId: string
  roomId: string
  botId: string
  eventId: string
  deliveryMode: RobotDeliveryMode
  messageType: RobotMessageKind
  sourceEventId?: string
  threadRootId?: string
  createdAt: number
  recalledAt?: number
}

type RecallFallback = {
  roomId: string
  eventId: string
  botId?: string
  deliveryMode?: RobotDeliveryMode
  messageType?: RobotMessageKind
}

type BotUiMeta = {
  name: string
  shortLabel: string
  tone: 'purple' | 'blue' | 'green'
}

const BOT_UI_MAP: Record<string, BotUiMeta> = {
  'openclaw-assistant': {
    name: 'OpenClaw Assistant',
    shortLabel: 'AI',
    tone: 'purple'
  },
  'trendradar-briefing': {
    name: 'TrendRadar Briefing',
    shortLabel: 'TR',
    tone: 'blue'
  },
  'hula-notifier': {
    name: 'HuLa Notifier',
    shortLabel: 'HN',
    tone: 'green'
  }
}

class RobotMessageProtocolService {
  private readonly deliveries = new Map<string, RobotDeliveryRecord>()
  private readonly deliveriesByEventId = new Map<string, string>()

  isRobotMessage(content: Record<string, unknown> | null | undefined): boolean {
    return !!this.extractEnvelope(content)
  }

  extractEnvelope(content: Record<string, unknown> | null | undefined): RobotProtocolEnvelope | null {
    if (!content || typeof content !== 'object') {
      return null
    }
    const value = content['org.hula.bot']
    if (!value || typeof value !== 'object') {
      return null
    }

    const envelope = value as Record<string, unknown>
    if (
      envelope.version !== '1.0' ||
      typeof envelope.botId !== 'string' ||
      typeof envelope.botName !== 'string' ||
      typeof envelope.messageType !== 'string' ||
      typeof envelope.traceId !== 'string' ||
      typeof envelope.deliveryMode !== 'string' ||
      typeof envelope.securityLevel !== 'string'
    ) {
      return null
    }

    return envelope as unknown as RobotProtocolEnvelope
  }

  buildEnvelope(
    message: Pick<RobotDispatchMessage, 'traceId' | 'botId' | 'kind' | 'metadata'>,
    options: {
      botName: string
      deliveryMode: RobotDeliveryMode
      securityLevel?: RobotProtocolEnvelope['securityLevel']
    }
  ): RobotProtocolEnvelope {
    return {
      version: '1.0',
      botId: message.botId,
      botName: options.botName,
      messageType: message.kind,
      traceId: message.traceId,
      deliveryMode: options.deliveryMode,
      securityLevel: options.securityLevel ?? 'private',
      sourceEventId: typeof message.metadata?.sourceEventId === 'string' ? message.metadata.sourceEventId : undefined,
      threadRootId: typeof message.metadata?.threadRootId === 'string' ? message.metadata.threadRootId : undefined,
      source: typeof message.metadata?.source === 'string' ? message.metadata.source : undefined
    }
  }

  wrapContent(envelope: RobotProtocolEnvelope, content: Record<string, unknown>): Record<string, unknown> {
    return {
      ...content,
      'org.hula.bot': envelope
    }
  }

  trackDelivery(envelope: RobotProtocolEnvelope, roomId: string, eventId: string): RobotDeliveryRecord {
    const record: RobotDeliveryRecord = {
      traceId: envelope.traceId,
      roomId,
      botId: envelope.botId,
      eventId,
      deliveryMode: envelope.deliveryMode,
      messageType: envelope.messageType,
      sourceEventId: envelope.sourceEventId,
      threadRootId: envelope.threadRootId,
      createdAt: Date.now()
    }
    this.deliveries.set(envelope.traceId, record)
    this.deliveriesByEventId.set(eventId, envelope.traceId)
    return record
  }

  hydrateDelivery(
    roomId: string,
    eventId: string,
    content: Record<string, unknown> | null | undefined
  ): RobotDeliveryRecord | null {
    const envelope = this.extractEnvelope(content)
    if (!envelope) {
      return null
    }

    const existing = this.deliveries.get(envelope.traceId)
    if (existing) {
      if (existing.eventId !== eventId || existing.roomId !== roomId) {
        existing.eventId = eventId
        existing.roomId = roomId
        this.deliveries.set(envelope.traceId, existing)
      }
      this.deliveriesByEventId.set(eventId, envelope.traceId)
      return existing
    }

    return this.trackDelivery(envelope, roomId, eventId)
  }

  getDelivery(traceId: string): RobotDeliveryRecord | null {
    return this.deliveries.get(traceId) ?? null
  }

  getDeliveryByEventId(eventId: string): RobotDeliveryRecord | null {
    const traceId = this.deliveriesByEventId.get(eventId)
    return traceId ? this.getDelivery(traceId) : null
  }

  async recallByTraceId(traceId: string, fallback?: RecallFallback): Promise<boolean> {
    const record = this.deliveries.get(traceId)
    const roomId = record?.roomId || fallback?.roomId
    const eventId = record?.eventId || fallback?.eventId

    if (!roomId || !eventId) {
      logger.warn(`[RobotProtocol] missing delivery target for traceId ${traceId}`)
      return false
    }

    await matrixMessageService.recallMessage(roomId, eventId)

    const recalledAt = Date.now()
    if (record) {
      record.recalledAt = recalledAt
      this.deliveries.set(traceId, record)
    } else {
      this.deliveries.set(traceId, {
        traceId,
        roomId,
        eventId,
        botId: fallback?.botId || 'unknown-bot',
        deliveryMode: fallback?.deliveryMode || 'room',
        messageType: fallback?.messageType || 'text',
        createdAt: recalledAt,
        recalledAt
      })
    }

    return true
  }

  async sendRobotNotice(
    message: RobotDispatchMessage,
    options: {
      botName: string
      body: string
      formattedBody?: string
      securityLevel?: RobotProtocolEnvelope['securityLevel']
    }
  ): Promise<string> {
    const threadRootId = typeof message.metadata?.threadRootId === 'string' ? message.metadata.threadRootId : undefined
    const sourceEventId =
      typeof message.metadata?.sourceEventId === 'string' ? message.metadata.sourceEventId : undefined
    const envelope = this.buildEnvelope(message, {
      botName: options.botName,
      deliveryMode: threadRootId ? 'thread_reply' : sourceEventId ? 'reply' : 'room',
      securityLevel: options.securityLevel
    })
    const messageContent = this.wrapContent(envelope, {
      msgtype: MatrixMsgType.NOTICE,
      body: options.body,
      ...(options.formattedBody
        ? {
            [MatrixContentField.FORMAT]: MatrixFormat.HTML,
            [MatrixContentField.FORMATTED_BODY]: options.formattedBody
          }
        : {})
    })

    if (threadRootId) {
      messageContent[MatrixContentField.RELATES_TO] = {
        rel_type: MatrixRelType.THREAD,
        event_id: threadRootId,
        'm.in_reply_to': {
          event_id: sourceEventId || threadRootId
        }
      }
      const eventId = await matrixEventService.sendEvent(message.roomId, MatrixEventType.ROOM_MESSAGE, messageContent)
      this.trackDelivery(envelope, message.roomId, eventId)
      return eventId
    }

    if (sourceEventId) {
      messageContent[MatrixContentField.RELATES_TO] = {
        'm.in_reply_to': {
          event_id: sourceEventId
        }
      }
      const eventId = await matrixEventService.sendEvent(message.roomId, MatrixEventType.ROOM_MESSAGE, messageContent)
      this.trackDelivery(envelope, message.roomId, eventId)
      return eventId
    }

    return this.sendRoomNotice(message.roomId, envelope, options.body, options.formattedBody)
  }

  async sendRoomNotice(
    roomId: string,
    envelope: RobotProtocolEnvelope,
    body: string,
    formattedBody?: string
  ): Promise<string> {
    const eventId = await matrixEventService.sendEvent(
      roomId,
      MatrixEventType.ROOM_MESSAGE,
      this.wrapContent(envelope, {
        msgtype: MatrixMsgType.NOTICE,
        body,
        ...(formattedBody
          ? {
              format: 'org.matrix.custom.html',
              formatted_body: formattedBody
            }
          : {})
      })
    )
    this.trackDelivery(envelope, roomId, eventId)
    return eventId
  }

  getBotUiMeta(botId: string, fallbackName?: string): BotUiMeta {
    const matched = BOT_UI_MAP[botId]
    if (matched) {
      return matched
    }
    return {
      name: fallbackName || botId,
      shortLabel: (fallbackName || botId).slice(0, 2).toUpperCase(),
      tone: 'purple'
    }
  }
}

export const robotMessageProtocolService = new RobotMessageProtocolService()
