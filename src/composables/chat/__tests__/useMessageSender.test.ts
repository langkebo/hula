import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MessageStatusEnum, MsgEnum } from '@/enums'
import type { SendMessagePayload } from '@/services/matrix/messaging/MatrixMessageService'
import { useMessageSender } from '../useMessageSender'

const mocks = vi.hoisted(() => ({
  updateMsg: vi.fn(),
  updateSessionLastActiveTime: vi.fn(),
  sendStructuredMessage: vi.fn(),
  enqueue: vi.fn(),
  getConnectionState: vi.fn()
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => ({
    updateMsg: mocks.updateMsg,
    updateSessionLastActiveTime: mocks.updateSessionLastActiveTime
  })
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getConnectionState: mocks.getConnectionState
  }
}))

vi.mock('@/services/matrix/messaging/MatrixMessageService', () => ({
  matrixMessageService: {
    sendStructuredMessage: mocks.sendStructuredMessage
  }
}))

vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: {
    enqueue: mocks.enqueue
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

const payload: SendMessagePayload = {
  id: 'temp-1',
  roomId: '!room:test',
  msgType: MsgEnum.TEXT,
  body: 'hello'
}

describe('useMessageSender', () => {
  beforeEach(() => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
    mocks.updateMsg.mockReset()
    mocks.updateSessionLastActiveTime.mockReset()
    mocks.sendStructuredMessage.mockReset()
    mocks.enqueue.mockReset()
    mocks.getConnectionState.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('CONNECTED 时直接发送', async () => {
    mocks.getConnectionState.mockReturnValue('CONNECTED')
    mocks.sendStructuredMessage.mockResolvedValue({ event_id: '$event:1' })

    await useMessageSender().sendWithTracking({ tempMsgId: 'temp-1', payload })

    expect(mocks.sendStructuredMessage).toHaveBeenCalledWith(payload)
    expect(mocks.enqueue).not.toHaveBeenCalled()
    expect(mocks.updateMsg).toHaveBeenCalledWith(
      expect.objectContaining({ msgId: 'temp-1', status: MessageStatusEnum.SUCCESS, newMsgId: '$event:1' })
    )
  })

  it('CATCHUP 时仍直接发送，不再静默入队', async () => {
    mocks.getConnectionState.mockReturnValue('CATCHUP')
    mocks.sendStructuredMessage.mockResolvedValue({ event_id: '$event:2' })

    await useMessageSender().sendWithTracking({ tempMsgId: 'temp-2', payload })

    expect(mocks.enqueue).not.toHaveBeenCalled()
    expect(mocks.sendStructuredMessage).toHaveBeenCalledTimes(1)
  })

  it('传输未就绪时入队并保持 SENDING', async () => {
    mocks.getConnectionState.mockReturnValue('RECONNECTING')

    await useMessageSender().sendWithTracking({ tempMsgId: 'temp-3', payload })

    expect(mocks.sendStructuredMessage).not.toHaveBeenCalled()
    expect(mocks.enqueue).toHaveBeenCalledWith(
      'message',
      payload.roomId,
      expect.objectContaining({ tempMsgId: 'temp-3', payload })
    )
    expect(mocks.updateMsg).toHaveBeenCalledWith({ msgId: 'temp-3', status: MessageStatusEnum.SENDING })
  })

  it('物理离线时入队', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    mocks.getConnectionState.mockReturnValue('CONNECTED')

    await useMessageSender().sendWithTracking({ tempMsgId: 'temp-4', payload })

    expect(mocks.sendStructuredMessage).not.toHaveBeenCalled()
    expect(mocks.enqueue).toHaveBeenCalledTimes(1)
  })

  it('发送抛错时标记 FAILED 并回调 onError', async () => {
    mocks.getConnectionState.mockReturnValue('CONNECTED')
    mocks.sendStructuredMessage.mockRejectedValue(new Error('boom'))
    const onError = vi.fn()

    await useMessageSender().sendWithTracking({ tempMsgId: 'temp-5', payload, onError })

    expect(mocks.updateMsg).toHaveBeenCalledWith({ msgId: 'temp-5', status: MessageStatusEnum.FAILED })
    expect(onError).toHaveBeenCalledWith('temp-5')
  })
})
