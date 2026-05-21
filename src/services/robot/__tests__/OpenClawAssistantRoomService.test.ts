import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openClawAssistantRoomService } from '../OpenClawAssistantRoomService'
import { robotDispatchService } from '../RobotDispatchService'

const { sendEventMock } = vi.hoisted(() => ({
  sendEventMock: vi.fn()
}))

const { loadOpenClawConfigMock } = vi.hoisted(() => ({
  loadOpenClawConfigMock: vi.fn()
}))

const { configureMock, sendChatCompletionMock } = vi.hoisted(() => ({
  configureMock: vi.fn(),
  sendChatCompletionMock: vi.fn()
}))

const { replyToMessageMock, replyInThreadMock, getThreadMessagesMock } = vi.hoisted(() => ({
  replyToMessageMock: vi.fn(),
  replyInThreadMock: vi.fn(),
  getThreadMessagesMock: vi.fn()
}))

const { onMock, getClientMock, timelineListenerState } = vi.hoisted(() => ({
  onMock: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
    if (event === 'timeline') {
      timelineListenerState.listener = callback
    }
  }),
  getClientMock: vi.fn(),
  timelineListenerState: {
    listener: null as null | ((payload: unknown) => void)
  }
}))

const { ensureBuiltinsMock, getRoomInstanceMock, invokeRobotMock } = vi.hoisted(() => ({
  ensureBuiltinsMock: vi.fn(),
  getRoomInstanceMock: vi.fn(),
  invokeRobotMock: vi.fn()
}))

vi.mock('@/services/matrix/MatrixEventService', () => ({
  matrixEventService: {
    sendEvent: sendEventMock
  }
}))

vi.mock('@/services/robot/RobotCredentialService', () => ({
  robotCredentialService: {
    loadOpenClawConfig: loadOpenClawConfigMock
  }
}))

vi.mock('@/services/openclaw', () => ({
  openClawClient: {
    configure: configureMock,
    sendChatCompletion: sendChatCompletionMock
  }
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    on: onMock,
    getClient: getClientMock
  }
}))

vi.mock('@/services/matrix/messaging/MatrixThreadService', () => ({
  matrixThreadService: {
    getThreadMessages: getThreadMessagesMock
  }
}))

vi.mock('@/services/matrix/messaging/MatrixMessageRelationService', () => ({
  matrixMessageRelationService: {
    replyToMessage: replyToMessageMock,
    replyInThread: replyInThreadMock
  }
}))

vi.mock('@/stores/domains/robot/center', () => ({
  useRobotCenterStore: () => ({
    ensureBuiltins: ensureBuiltinsMock,
    getRoomInstance: getRoomInstanceMock,
    invokeRobot: invokeRobotMock
  })
}))

async function* createCompletion(content: string) {
  yield {
    content
  }
}

function createRoomEvent(
  eventId: string,
  sender: string,
  body: string,
  timestamp: number,
  content?: Record<string, unknown>
) {
  return {
    getId: () => eventId,
    getTs: () => timestamp,
    getType: () => 'm.room.message',
    getSender: () => sender,
    getContent: () => ({
      msgtype: 'm.text',
      body,
      ...(content || {})
    })
  }
}

function createRoom(events: ReturnType<typeof createRoomEvent>[]) {
  return {
    getMember: (userId: string) => ({
      name: userId === '@alice:hula.im' ? 'Alice' : userId === '@bob:hula.im' ? 'Bob' : userId
    }),
    getUnfilteredTimelineSet: () => ({
      getLiveTimeline: () => ({
        getEvents: () => events
      })
    })
  }
}

describe('OpenClawAssistantRoomService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getClientMock.mockReturnValue({
      getUserId: () => '@alice:hula.im',
      getRoom: () =>
        createRoom([
          createRoomEvent('$event-1', '@bob:hula.im', '今天需要整理版本说明', 1000),
          createRoomEvent('$event-2', '@alice:hula.im', '我来写初稿', 2000),
          createRoomEvent('$event-3', '@alice:hula.im', '@OpenClaw Assistant 帮我总结一下今天的讨论', 3000)
        ])
    })
    getRoomInstanceMock.mockReturnValue({
      id: '!room:hula:openclaw-assistant',
      roomId: '!room:hula',
      botId: 'openclaw-assistant',
      status: 'idle',
      createdAt: Date.now(),
      updatedAt: Date.now()
    })
    invokeRobotMock.mockResolvedValue({
      traceId: 'trace-auto',
      roomId: '!room:hula',
      botId: 'openclaw-assistant',
      delivered: true,
      eventId: '$auto'
    })
    loadOpenClawConfigMock.mockResolvedValue({
      gatewayUrl: 'http://127.0.0.1:18789',
      token: 'openclaw-secret',
      autoConnect: false,
      reconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000,
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1,
      presencePenalty: 0,
      frequencyPenalty: 0
    })
    sendChatCompletionMock.mockReturnValue(createCompletion('房间机器人链路已打通。'))
    sendEventMock.mockResolvedValue('$robot-event')
    replyToMessageMock.mockResolvedValue('$reply-event')
    replyInThreadMock.mockResolvedValue('$thread-reply-event')
    getThreadMessagesMock.mockReturnValue([
      {
        eventId: '$root-thread',
        sender: '@bob:hula.im',
        content: { body: '请帮我总结今天讨论的重点' },
        timestamp: 1000
      },
      {
        eventId: '$reply-thread',
        sender: '@alice:hula.im',
        content: { body: '@OpenClaw Assistant 请给我一版简洁总结' },
        timestamp: 2000
      }
    ])
    openClawAssistantRoomService.ensureRegistered()
  })

  it('dispatches an OpenClaw-generated text reply into the room', async () => {
    const result = await robotDispatchService.dispatch({
      traceId: 'trace-openclaw',
      roomId: '!room:hula',
      botId: 'openclaw-assistant',
      kind: 'text',
      body: '请发送测试回复',
      metadata: {
        userId: '@alice:hula.im'
      }
    })

    expect(loadOpenClawConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({
        gatewayUrl: 'http://127.0.0.1:18789'
      }),
      { userId: '@alice:hula.im' }
    )
    expect(configureMock).toHaveBeenCalledWith({
      gatewayUrl: 'http://127.0.0.1:18789',
      token: 'openclaw-secret'
    })
    expect(sendChatCompletionMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('以下是当前房间最近消息上下文：')
        })
      ]),
      expect.any(Object)
    )
    expect(sendChatCompletionMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('Bob: 今天需要整理版本说明')
        }),
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('Alice: 我来写初稿')
        })
      ]),
      expect.any(Object)
    )
    expect(sendEventMock).toHaveBeenCalledWith(
      '!room:hula',
      'm.room.message',
      expect.objectContaining({
        msgtype: 'm.notice',
        body: '房间机器人链路已打通。',
        'org.hula.bot': expect.objectContaining({
          botId: 'openclaw-assistant',
          deliveryMode: 'room',
          traceId: 'trace-openclaw'
        })
      })
    )
    expect(result).toEqual({
      traceId: 'trace-openclaw',
      roomId: '!room:hula',
      botId: 'openclaw-assistant',
      delivered: true,
      eventId: '$robot-event'
    })
  })

  it('returns a readable error when the current user has no OpenClaw key', async () => {
    loadOpenClawConfigMock.mockResolvedValueOnce({
      gatewayUrl: 'http://127.0.0.1:18789',
      token: '',
      autoConnect: false,
      reconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000,
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1,
      presencePenalty: 0,
      frequencyPenalty: 0
    })

    const result = await robotDispatchService.dispatch({
      traceId: 'trace-no-token',
      roomId: '!room:hula',
      botId: 'openclaw-assistant',
      kind: 'text',
      body: '请发送测试回复',
      metadata: {
        userId: '@alice:hula.im'
      }
    })

    expect(sendEventMock).not.toHaveBeenCalled()
    expect(replyToMessageMock).not.toHaveBeenCalled()
    expect(replyInThreadMock).not.toHaveBeenCalled()
    expect(result).toEqual({
      traceId: 'trace-no-token',
      roomId: '!room:hula',
      botId: 'openclaw-assistant',
      delivered: false,
      error: '当前用户尚未配置 OpenClaw API Key'
    })
  })

  it('replies in the same thread and includes thread context when triggered from a thread', async () => {
    const result = await robotDispatchService.dispatch({
      traceId: 'trace-thread',
      roomId: '!room:hula',
      botId: 'openclaw-assistant',
      kind: 'text',
      body: '请给我一版简洁总结',
      metadata: {
        userId: '@alice:hula.im',
        sourceEventId: '$reply-thread',
        threadRootId: '$root-thread'
      }
    })

    expect(getThreadMessagesMock).toHaveBeenCalledWith('!room:hula', '$root-thread')
    expect(sendChatCompletionMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('以下是当前线程最近消息上下文：')
        }),
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('Bob: 请帮我总结今天讨论的重点')
        }),
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('Alice: @OpenClaw Assistant 请给我一版简洁总结')
        })
      ]),
      expect.any(Object)
    )
    expect(sendEventMock).toHaveBeenCalledWith(
      '!room:hula',
      'm.room.message',
      expect.objectContaining({
        msgtype: 'm.notice',
        body: '房间机器人链路已打通。',
        'm.relates_to': {
          rel_type: 'm.thread',
          event_id: '$root-thread',
          'm.in_reply_to': {
            event_id: '$reply-thread'
          }
        },
        'org.hula.bot': expect.objectContaining({
          deliveryMode: 'thread_reply',
          sourceEventId: '$reply-thread',
          threadRootId: '$root-thread'
        })
      })
    )
    expect(replyToMessageMock).not.toHaveBeenCalled()
    expect(replyInThreadMock).not.toHaveBeenCalled()
    expect(result).toEqual({
      traceId: 'trace-thread',
      roomId: '!room:hula',
      botId: 'openclaw-assistant',
      delivered: true,
      eventId: '$robot-event'
    })
  })

  it('uses precise reply-to for non-thread robot replies when sourceEventId is present', async () => {
    const result = await robotDispatchService.dispatch({
      traceId: 'trace-reply',
      roomId: '!room:hula',
      botId: 'openclaw-assistant',
      kind: 'text',
      body: '请跟进这条消息',
      metadata: {
        userId: '@alice:hula.im',
        sourceEventId: '$event-3'
      }
    })

    expect(sendEventMock).toHaveBeenCalledWith(
      '!room:hula',
      'm.room.message',
      expect.objectContaining({
        msgtype: 'm.notice',
        body: '房间机器人链路已打通。',
        'm.relates_to': {
          'm.in_reply_to': {
            event_id: '$event-3'
          }
        },
        'org.hula.bot': expect.objectContaining({
          deliveryMode: 'reply',
          sourceEventId: '$event-3',
          traceId: 'trace-reply'
        })
      })
    )
    expect(replyInThreadMock).not.toHaveBeenCalled()
    expect(replyToMessageMock).not.toHaveBeenCalled()
    expect(result).toEqual({
      traceId: 'trace-reply',
      roomId: '!room:hula',
      botId: 'openclaw-assistant',
      delivered: true,
      eventId: '$robot-event'
    })
  })

  it('auto-invokes the deployed assistant when the current user mentions @OpenClaw Assistant in a room', async () => {
    const timelineListener = timelineListenerState.listener
    expect(timelineListener).toBeTypeOf('function')

    timelineListener?.({
      event: {
        getId: () => '$event-auto',
        getTs: () => Date.now(),
        getType: () => 'm.room.message',
        getSender: () => '@alice:hula.im',
        getRoomId: () => '!room:hula',
        getContent: () => ({
          msgtype: 'm.text',
          body: '@OpenClaw Assistant 帮我总结一下今天的讨论'
        }),
        isRelation: () => false
      },
      room: {
        roomId: '!room:hula'
      }
    })

    await Promise.resolve()
    await Promise.resolve()

    expect(ensureBuiltinsMock).toHaveBeenCalled()
    expect(getRoomInstanceMock).toHaveBeenCalledWith('!room:hula', 'openclaw-assistant')
    expect(invokeRobotMock).toHaveBeenCalledWith(
      '!room:hula',
      'openclaw-assistant',
      '帮我总结一下今天的讨论',
      expect.objectContaining({
        source: 'room-timeline',
        sourceEventId: '$event-auto',
        sender: '@alice:hula.im'
      })
    )
  })

  it('auto-invokes the deployed assistant inside the same thread when mentioned in a thread reply', async () => {
    const timelineListener = timelineListenerState.listener
    expect(timelineListener).toBeTypeOf('function')

    timelineListener?.({
      event: {
        getId: () => '$event-thread-auto',
        getTs: () => Date.now(),
        getType: () => 'm.room.message',
        getSender: () => '@alice:hula.im',
        getRoomId: () => '!room:hula',
        getContent: () => ({
          msgtype: 'm.text',
          body: '@OpenClaw Assistant 继续在线程里补充一下风险点',
          'm.relates_to': {
            rel_type: 'm.thread',
            event_id: '$root-thread'
          }
        }),
        isRelation: () => true
      },
      room: {
        roomId: '!room:hula'
      }
    })

    await Promise.resolve()
    await Promise.resolve()

    expect(invokeRobotMock).toHaveBeenCalledWith(
      '!room:hula',
      'openclaw-assistant',
      '继续在线程里补充一下风险点',
      expect.objectContaining({
        source: 'room-timeline',
        sourceEventId: '$event-thread-auto',
        threadRootId: '$root-thread'
      })
    )
  })
})
