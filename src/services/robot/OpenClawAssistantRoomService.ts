import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixThreadService } from '@/services/matrix/messaging/MatrixThreadService'
import { openClawClient } from '@/services/openclaw'
import { robotCredentialService } from '@/services/robot/RobotCredentialService'
import { robotDispatchService } from '@/services/robot/RobotDispatchService'
import { robotMessageProtocolService } from '@/services/robot/RobotMessageProtocolService'
import { useRobotCenterStore } from '@/stores/domains/robot/center'
import { createLogger } from '@/utils/Logger'
import type { RobotDispatchMessage, RobotDispatchResult } from './types'

const logger = createLogger('OpenClawAssistantRoomService')

const OPENCLAW_ASSISTANT_BOT_ID = 'openclaw-assistant'
const OPENCLAW_WORKBENCH_MODEL_STORAGE_KEY = 'hula-openclaw-workbench-model'
const OPENCLAW_ASSISTANT_TRIGGER_PATTERN = /@openclaw assistant\b/i
const ROOM_CONTEXT_LIMIT = 8
const THREAD_CONTEXT_LIMIT = 12

type TimelinePayload = {
  event: {
    getId: () => string | null
    getTs: () => number
    getType: () => string
    getSender: () => string | null
    getRoomId: () => string | null
    getContent: () => Record<string, unknown>
    isRelation?: () => boolean
  }
  room?: {
    roomId: string
  }
}

type RoomTimelineEvent = {
  getId: () => string | null
  getTs: () => number
  getType: () => string
  getSender: () => string | null
  getContent: () => Record<string, unknown>
}

type RoomLike = {
  getMember: (userId: string) => { name?: string | null } | null
  getUnfilteredTimelineSet: () => {
    getLiveTimeline: () => {
      getEvents: () => RoomTimelineEvent[]
    }
  }
}

type ContextLine = {
  eventId: string
  sender: string
  senderName: string
  body: string
  timestamp: number
}

type TriggerPayload = {
  roomId: string
  body: string
  sender: string
  eventId: string
  threadRootId?: string
}

function readScopedModel(userId?: string): string {
  if (typeof window === 'undefined') {
    return 'main'
  }

  const scopedKey = `${OPENCLAW_WORKBENCH_MODEL_STORAGE_KEY}::${userId || 'anonymous'}`
  return (
    window.localStorage.getItem(scopedKey) ??
    window.localStorage.getItem(OPENCLAW_WORKBENCH_MODEL_STORAGE_KEY) ??
    'main'
  )
}

function extractUserId(message: RobotDispatchMessage): string | undefined {
  const userId = message.metadata?.userId
  return typeof userId === 'string' && userId.trim() ? userId.trim() : undefined
}

function extractPrompt(message: RobotDispatchMessage): string {
  const prompt = message.metadata?.prompt
  if (typeof prompt === 'string' && prompt.trim()) {
    return prompt.trim()
  }
  return message.body.trim()
}

function extractThreadRootId(content: Record<string, unknown>): string | undefined {
  const relatesTo = content['m.relates_to']
  if (!relatesTo || typeof relatesTo !== 'object') {
    return undefined
  }

  const relation = relatesTo as Record<string, unknown>
  return relation.rel_type === 'm.thread' && typeof relation.event_id === 'string' ? relation.event_id : undefined
}

function buildContextBlock(title: string, lines: ContextLine[]): string {
  if (!lines.length) {
    return ''
  }

  const serializedLines = lines.map((line, index) => `${index + 1}. ${line.senderName}: ${line.body}`).join('\n')
  return `${title}\n${serializedLines}`
}

class OpenClawAssistantRoomService {
  private registered = false
  private listenerStartedAt = 0
  private readonly seenEventIds = new Set<string>()
  private readonly timelineListener = (...args: unknown[]) => {
    const [payload] = args as [TimelinePayload]
    void this.handleTimeline(payload)
  }

  ensureRegistered(): void {
    if (this.registered) {
      return
    }

    robotDispatchService.register(OPENCLAW_ASSISTANT_BOT_ID, async (message) => this.handleDispatch(message))
    this.listenerStartedAt = Date.now()
    matrixClientService.on('timeline', this.timelineListener)
    this.registered = true
  }

  private shouldTriggerFromTimeline(payload: TimelinePayload): TriggerPayload | null {
    const { event, room } = payload
    const eventId = event.getId()
    const roomId = event.getRoomId() || room?.roomId
    const sender = event.getSender()
    const content = event.getContent()
    const body = typeof content.body === 'string' ? content.body.trim() : ''
    const msgtype = typeof content.msgtype === 'string' ? content.msgtype : ''
    const threadRootId = extractThreadRootId(content)
    const currentUserId = matrixClientService.getClient()?.getUserId() || null

    if (!eventId || !roomId || !sender || !body) {
      return null
    }
    if (this.seenEventIds.has(eventId)) {
      return null
    }
    if (event.getTs() < this.listenerStartedAt) {
      return null
    }
    if (event.getType() !== 'm.room.message' || msgtype !== 'm.text') {
      return null
    }
    if (event.isRelation?.() && !threadRootId) {
      return null
    }
    if (content['m.relates_to'] && !threadRootId) {
      return null
    }
    if (sender !== currentUserId) {
      return null
    }
    if (!OPENCLAW_ASSISTANT_TRIGGER_PATTERN.test(body)) {
      return null
    }

    return { roomId, body, sender, eventId, threadRootId }
  }

  private getRoomTimelineContext(roomId: string, sourceEventId?: string): ContextLine[] {
    const room = matrixClientService.getClient()?.getRoom(roomId) as RoomLike | null
    if (!room) {
      return []
    }

    const events = room.getUnfilteredTimelineSet().getLiveTimeline().getEvents()
    const sourceIndex = sourceEventId ? events.findIndex((event) => event.getId() === sourceEventId) : events.length - 1
    const candidateEvents = events.slice(Math.max(0, sourceIndex - ROOM_CONTEXT_LIMIT), sourceIndex + 1)

    return candidateEvents
      .filter((event) => {
        const content = event.getContent()
        const body = typeof content.body === 'string' ? content.body.trim() : ''
        const msgtype = typeof content.msgtype === 'string' ? content.msgtype : ''
        return event.getType() === 'm.room.message' && msgtype === 'm.text' && body.length > 0
      })
      .map((event) => {
        const sender = event.getSender() || ''
        const member = room.getMember(sender)
        const content = event.getContent()
        return {
          eventId: event.getId() || '',
          sender,
          senderName: member?.name || sender,
          body: typeof content.body === 'string' ? content.body.trim() : '',
          timestamp: event.getTs()
        }
      })
  }

  private getThreadContext(roomId: string, threadRootId: string): ContextLine[] {
    const room = matrixClientService.getClient()?.getRoom(roomId) as RoomLike | null
    if (!room) {
      return []
    }

    const threadMessages = matrixThreadService.getThreadMessages(roomId, threadRootId)
    return threadMessages.slice(-THREAD_CONTEXT_LIMIT).map((message) => {
      const member = room.getMember(message.sender)
      const content = message.content as Record<string, unknown>
      return {
        eventId: message.eventId,
        sender: message.sender,
        senderName: member?.name || message.sender,
        body: typeof content.body === 'string' ? content.body.trim() : '',
        timestamp: message.timestamp
      }
    })
  }

  private buildConversationMessages(
    message: RobotDispatchMessage,
    prompt: string
  ): Array<{ role: string; content: string }> {
    const threadRootId = typeof message.metadata?.threadRootId === 'string' ? message.metadata.threadRootId : undefined
    const sourceEventId =
      typeof message.metadata?.sourceEventId === 'string' ? message.metadata.sourceEventId : undefined

    const contextLines = threadRootId
      ? this.getThreadContext(message.roomId, threadRootId)
      : this.getRoomTimelineContext(message.roomId, sourceEventId)

    const contextTitle = threadRootId ? '以下是当前线程最近消息上下文：' : '以下是当前房间最近消息上下文：'
    const contextBlock = buildContextBlock(contextTitle, contextLines)

    return [
      {
        role: 'system',
        content:
          '你是 HuLa 房间中的 OpenClaw Assistant，请以简洁、自然的中文回复用户，不要在回复中再次写出“@OpenClaw Assistant”这个触发词。若提供了上下文，请优先基于上下文回答。'
      },
      {
        role: 'user',
        content: [contextBlock, `用户当前提问：${prompt || '请发送一条简短的测试消息，说明房间机器人链路已打通。'}`]
          .filter(Boolean)
          .join('\n\n')
      }
    ]
  }

  private async deliverRobotReply(
    message: RobotDispatchMessage,
    normalizedReply: string
  ): Promise<RobotDispatchResult> {
    const eventId = await robotMessageProtocolService.sendRobotNotice(message, {
      botName: 'OpenClaw Assistant',
      body: normalizedReply
    })
    return {
      traceId: message.traceId,
      roomId: message.roomId,
      botId: message.botId,
      delivered: true,
      eventId
    }
  }

  private async handleTimeline(payload: TimelinePayload): Promise<void> {
    const trigger = this.shouldTriggerFromTimeline(payload)
    if (!trigger) {
      return
    }

    this.seenEventIds.add(trigger.eventId)
    const robotCenterStore = useRobotCenterStore()
    robotCenterStore.ensureBuiltins()
    const deployedRobot = robotCenterStore.getRoomInstance(trigger.roomId, OPENCLAW_ASSISTANT_BOT_ID)

    if (!deployedRobot || deployedRobot.status === 'paused') {
      return
    }

    const prompt = trigger.body.replace(OPENCLAW_ASSISTANT_TRIGGER_PATTERN, '').trim()

    const result = await robotCenterStore.invokeRobot(
      trigger.roomId,
      OPENCLAW_ASSISTANT_BOT_ID,
      prompt || '请回复我刚刚在房间中对你的提问。',
      {
        prompt: prompt || '请回复我刚刚在房间中对你的提问。',
        source: 'room-timeline',
        sourceEventId: trigger.eventId,
        sender: trigger.sender,
        threadRootId: trigger.threadRootId
      }
    )

    if (!result.delivered) {
      logger.warn(`[OpenClawAssistant] auto trigger failed: ${result.error || 'unknown error'}`)
    }
  }

  private async handleDispatch(message: RobotDispatchMessage): Promise<RobotDispatchResult> {
    const userId = extractUserId(message)
    const prompt = extractPrompt(message)

    try {
      const config = await robotCredentialService.loadOpenClawConfig(
        {
          gatewayUrl: 'http://127.0.0.1:18789',
          token: '',
          autoConnect: false,
          reconnect: true,
          reconnectInterval: 3000,
          maxReconnectAttempts: 5,
          heartbeatInterval: 30000,
          temperature: 0.7,
          maxTokens: 4096,
          topP: 1.0,
          presencePenalty: 0.0,
          frequencyPenalty: 0.0
        },
        { userId }
      )

      if (!config.token.trim()) {
        throw new Error('当前用户尚未配置 OpenClaw API Key')
      }

      openClawClient.configure({
        gatewayUrl: config.gatewayUrl,
        token: config.token
      })

      const conversationMessages = this.buildConversationMessages(message, prompt)
      let reply = ''
      for await (const chunk of openClawClient.sendChatCompletion(conversationMessages, {
        model: readScopedModel(userId),
        temperature: config.temperature,
        maxTokens: config.maxTokens
      })) {
        if (chunk.content) {
          reply += chunk.content
        }
      }

      const normalizedReply = reply.trim() || 'OpenClaw Assistant 已连接成功，房间机器人发消息链路可用。'
      return await this.deliverRobotReply(message, normalizedReply)
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'OpenClaw Assistant 发送失败'
      logger.error(`[OpenClawAssistant] dispatch failed: ${messageText}`, error)
      return {
        traceId: message.traceId,
        roomId: message.roomId,
        botId: message.botId,
        delivered: false,
        error: messageText
      }
    }
  }
}

export const openClawAssistantRoomService = new OpenClawAssistantRoomService()
