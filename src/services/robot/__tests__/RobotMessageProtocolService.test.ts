import { beforeEach, describe, expect, it, vi } from 'vitest'
import { robotMessageProtocolService } from '../RobotMessageProtocolService'

const { sendEventMock } = vi.hoisted(() => ({
  sendEventMock: vi.fn()
}))

const { recallMessageMock } = vi.hoisted(() => ({
  recallMessageMock: vi.fn()
}))

vi.mock('@/services/matrix/MatrixEventService', () => ({
  matrixEventService: {
    sendEvent: sendEventMock
  }
}))

vi.mock('@/services/matrix/messaging/MatrixMessageService', () => ({
  matrixMessageService: {
    recallMessage: recallMessageMock
  }
}))

describe('RobotMessageProtocolService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendEventMock.mockResolvedValue('$robot-message')
  })

  it('tracks a sent room notice and extracts the protocol envelope', async () => {
    const envelope = robotMessageProtocolService.buildEnvelope(
      {
        traceId: 'trace-001',
        botId: 'hula-notifier',
        kind: 'text',
        metadata: {
          source: 'slash-command'
        }
      },
      {
        botName: 'HuLa Notifier',
        deliveryMode: 'room',
        securityLevel: 'room'
      }
    )

    const eventId = await robotMessageProtocolService.sendRoomNotice('!room:hula', envelope, '机器人已上线')

    expect(eventId).toBe('$robot-message')
    expect(sendEventMock).toHaveBeenCalledWith(
      '!room:hula',
      'm.room.message',
      expect.objectContaining({
        msgtype: 'm.notice',
        body: '机器人已上线',
        'org.hula.bot': expect.objectContaining({
          traceId: 'trace-001',
          botId: 'hula-notifier'
        })
      })
    )
    expect(robotMessageProtocolService.getDelivery('trace-001')).toEqual(
      expect.objectContaining({
        roomId: '!room:hula',
        eventId: '$robot-message',
        botId: 'hula-notifier'
      })
    )
    expect(
      robotMessageProtocolService.extractEnvelope({
        'org.hula.bot': envelope
      })
    ).toEqual(envelope)
  })

  it('recalls a robot message by traceId', async () => {
    const envelope = robotMessageProtocolService.buildEnvelope(
      {
        traceId: 'trace-002',
        botId: 'openclaw-assistant',
        kind: 'text',
        metadata: {}
      },
      {
        botName: 'OpenClaw Assistant',
        deliveryMode: 'reply'
      }
    )

    robotMessageProtocolService.trackDelivery(envelope, '!room:hula', '$event-2')
    const recalled = await robotMessageProtocolService.recallByTraceId('trace-002')

    expect(recalled).toBe(true)
    expect(recallMessageMock).toHaveBeenCalledWith('!room:hula', '$event-2')
    expect(robotMessageProtocolService.getDelivery('trace-002')).toEqual(
      expect.objectContaining({
        recalledAt: expect.any(Number)
      })
    )
  })
})
