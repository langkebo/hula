import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MessageStatusEnum, MsgEnum } from '@/enums'
import { createI18nMock } from '~/tests/i18n-messages'

vi.mock('vue-i18n', () => createI18nMock())

const { replayFnRef, updateMsgMock } = vi.hoisted(() => ({
  replayFnRef: { current: null as ((op: Record<string, unknown>) => Promise<void>) | null },
  updateMsgMock: vi.fn()
}))

vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: {
    setReplayFn: vi.fn((fn) => {
      replayFnRef.current = fn
    }),
    startNetworkListener: vi.fn(),
    enqueue: vi.fn(),
    getQueue: vi.fn(() => []),
    getPendingCount: vi.fn(() => 0),
    replayAll: vi.fn(async () => ({ succeeded: 0, failed: 0 }))
  }
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => ({ updateMsg: updateMsgMock })
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn()
}))

import { useOfflineQueueReplay } from '@/composables/app/useOfflineQueueReplay'

const createQueueOperation = (payload: Record<string, unknown>) => ({
  id: 'op-1',
  type: 'message',
  roomId: '!room:server',
  payload,
  createdAt: Date.now(),
  retryCount: 0,
  maxRetries: 3,
  status: 'pending'
})

const createHarness = (overrides: {
  sendStructuredMessage?: ReturnType<typeof vi.fn>
  sendEvent?: ReturnType<typeof vi.fn>
}) => {
  const sendStructuredMessage = overrides.sendStructuredMessage ?? vi.fn()
  const sendEvent = overrides.sendEvent ?? vi.fn()
  return useOfflineQueueReplay({
    getMatrixClientService: vi.fn().mockResolvedValue({ getClient: () => ({ sendEvent }) }),
    getMatrixMessageService: vi.fn().mockResolvedValue({
      sendStructuredMessage,
      registerSentMessage: vi.fn()
    }),
    getMatrixReceiptService: vi.fn().mockResolvedValue({}),
    getMatrixReactionService: vi.fn().mockResolvedValue({}),
    getMatrixRoomService: vi.fn().mockResolvedValue({}),
    getMatrixRoomCreationService: vi.fn().mockResolvedValue({}),
    getRoomOperations: vi.fn().mockResolvedValue({})
  })
}

describe('useOfflineQueueReplay — message replay failure', () => {
  beforeEach(() => {
    replayFnRef.current = null
    updateMsgMock.mockReset()
  })

  it('重放抛不可重试错误时，把对应 tempMsgId 消息回写为 FAILED', async () => {
    const sendStructuredMessage = vi.fn().mockRejectedValue(new Error('M_FORBIDDEN: not allowed'))
    const { initOfflineQueue } = createHarness({ sendStructuredMessage })

    await initOfflineQueue()
    expect(replayFnRef.current).not.toBeNull()

    await expect(
      replayFnRef.current!(
        createQueueOperation({
          tempMsgId: 'T1720000000000',
          payload: {
            id: 'T1720000000000',
            roomId: '!room:server',
            msgType: MsgEnum.TEXT,
            body: { text: 'hello' }
          },
          updateSessionActive: true,
          scrollOnUpdate: false
        })
      )
    ).rejects.toThrow('M_FORBIDDEN')

    expect(updateMsgMock).toHaveBeenCalledWith({
      msgId: 'T1720000000000',
      status: MessageStatusEnum.FAILED
    })
  })

  it('服务层兜底形态（无 tempMsgId）重放失败时不崩且不回写消息', async () => {
    const sendEvent = vi.fn().mockRejectedValue(new Error('M_UNKNOWN'))
    const { initOfflineQueue } = createHarness({ sendEvent })

    await initOfflineQueue()

    await expect(
      replayFnRef.current!(
        createQueueOperation({
          roomId: '!room:server',
          eventType: 'm.room.message',
          content: { msgtype: 'm.text', body: 'fallback' }
        })
      )
    ).rejects.toThrow('M_UNKNOWN')

    expect(updateMsgMock).not.toHaveBeenCalled()
  })
})
