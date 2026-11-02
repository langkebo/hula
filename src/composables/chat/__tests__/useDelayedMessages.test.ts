import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MsgEnum } from '@/enums'
import { DelayedEventError } from '@/services/matrix/messaging/MatrixDelayedEventsService'
import { useDelayedMessages } from '../useDelayedMessages'

const { showFeedbackMock, serviceMock, loggerErrorMock } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  serviceMock: {
    isSupported: vi.fn(),
    listPending: vi.fn(),
    scheduleMessagePayload: vi.fn(),
    cancel: vi.fn(),
    sendNow: vi.fn(),
    reschedule: vi.fn()
  }
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/services/matrix/messaging/MatrixDelayedEventsService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/matrix/messaging/MatrixDelayedEventsService')>()),
  matrixDelayedEventsService: serviceMock
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: loggerErrorMock, info: vi.fn() })
}))

const pendingItems = [
  {
    delayId: 7,
    roomId: '!room:example.org',
    type: 'm.room.message',
    delayMs: 300000,
    scheduledAt: 1000,
    content: { body: 'later' }
  }
]

describe('useDelayedMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serviceMock.isSupported.mockResolvedValue(true)
    serviceMock.listPending.mockResolvedValue(pendingItems)
    serviceMock.cancel.mockResolvedValue(undefined)
    serviceMock.sendNow.mockResolvedValue(undefined)
    serviceMock.reschedule.mockResolvedValue(8)
    serviceMock.scheduleMessagePayload.mockResolvedValue(9)
  })

  it('probes support and refreshes the pending list', async () => {
    const delayed = useDelayedMessages()

    await expect(delayed.probeSupport()).resolves.toBe(true)
    await delayed.refresh()

    expect(serviceMock.isSupported).toHaveBeenCalledWith(false)
    expect(delayed.supported.value).toBe(true)
    expect(delayed.items.value).toEqual(pendingItems)
  })

  it('keeps the task and reports a clear reason when cancel fails', async () => {
    const delayed = useDelayedMessages()
    delayed.supported.value = true
    await delayed.refresh()
    serviceMock.cancel.mockRejectedValue(new DelayedEventError('offline'))

    await expect(delayed.cancel(7)).resolves.toBe(false)

    expect(serviceMock.listPending).toHaveBeenCalledTimes(1)
    expect(delayed.items.value).toEqual(pendingItems)
    expect(showFeedbackMock).toHaveBeenCalledWith(
      expect.stringContaining('delayed_events.feedback.cancel_failed'),
      'error'
    )
    expect(showFeedbackMock.mock.calls[0][0]).toContain('delayed_events.errors.offline')
  })

  it('removes the task after a successful cancel by reloading the list', async () => {
    const delayed = useDelayedMessages()
    delayed.supported.value = true
    await delayed.refresh()
    serviceMock.listPending.mockResolvedValue([])

    await expect(delayed.cancel(7)).resolves.toBe(true)

    expect(delayed.items.value).toEqual([])
    expect(showFeedbackMock).toHaveBeenCalledWith('delayed_events.feedback.cancelled', 'success')
  })

  it('reports the server reason when scheduling fails', async () => {
    const delayed = useDelayedMessages()
    serviceMock.scheduleMessagePayload.mockRejectedValue(new DelayedEventError('unsupported'))

    await expect(
      delayed.schedule({ roomId: '!room:example.org', msgType: MsgEnum.TEXT, body: {} }, 300000)
    ).resolves.toBe(false)

    expect(showFeedbackMock.mock.calls[0][0]).toContain('delayed_events.feedback.schedule_failed')
    expect(showFeedbackMock.mock.calls[0][0]).toContain('delayed_events.errors.unsupported')
  })

  it('reloads after a reschedule failure so the server-side state stays visible', async () => {
    const delayed = useDelayedMessages()
    delayed.supported.value = true
    await delayed.refresh()
    serviceMock.reschedule.mockRejectedValue(new Error('boom'))

    await expect(delayed.reschedule(7, 600000)).resolves.toBe(false)

    expect(serviceMock.listPending).toHaveBeenCalledTimes(2)
    expect(delayed.items.value).toEqual(pendingItems)
    expect(showFeedbackMock.mock.calls[0][0]).toContain('delayed_events.errors.unknown')
  })
})
