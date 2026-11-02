import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatrixClient } from '@/services/matrix/sdk'
import { matrixClientService } from '../../MatrixClientService'
import { DelayedEventError, matrixDelayedEventsService } from '../MatrixDelayedEventsService'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn() })
}))

function createManagerStub() {
  return {
    scheduleDelayedEvent: vi.fn().mockResolvedValue({ delay_id: 7 }),
    listScheduledDelayedEvents: vi.fn().mockResolvedValue([]),
    cancelScheduledDelayedEvent: vi.fn().mockResolvedValue({}),
    sendScheduledDelayedEvent: vi.fn().mockResolvedValue({}),
    getScheduledDelayedEvent: vi.fn().mockResolvedValue({
      delay_id: 7,
      room_id: '!room:example.org',
      type: 'm.room.message',
      delay_ms: 300000,
      delayed_since_ts: 1000,
      content: { msgtype: 'm.text', body: 'later' }
    })
  }
}

function installClient(options: { supported?: boolean; manager?: ReturnType<typeof createManagerStub> }) {
  const manager = options.manager ?? createManagerStub()
  const client = {
    doesServerSupportUnstableFeature: vi.fn().mockResolvedValue(options.supported ?? true),
    getDelayedEventsManager: () => manager
  } as unknown as MatrixClient
  vi.spyOn(matrixClientService, 'getClient').mockReturnValue(client)
  return { client, manager }
}

describe('MatrixDelayedEventsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    matrixDelayedEventsService.resetSupportCache()
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  })

  it('caches a successful MSC4140 capability probe', async () => {
    const { client } = installClient({ supported: true })

    await expect(matrixDelayedEventsService.isSupported()).resolves.toBe(true)
    await expect(matrixDelayedEventsService.isSupported()).resolves.toBe(true)

    expect(client.doesServerSupportUnstableFeature).toHaveBeenCalledTimes(1)
  })

  it('treats probe failures as unsupported', async () => {
    installClient({ supported: true }).client.doesServerSupportUnstableFeature = vi
      .fn()
      .mockRejectedValue(new Error('network down'))

    await expect(matrixDelayedEventsService.isSupported()).resolves.toBe(false)
  })

  it('rejects scheduling while offline without touching the SDK', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const { manager } = installClient({})

    await expect(
      matrixDelayedEventsService.scheduleMessage('!room:example.org', { body: 'hi' }, 300000)
    ).rejects.toMatchObject({ reason: 'offline' })
    expect(manager.scheduleDelayedEvent).not.toHaveBeenCalled()
  })

  it('rejects scheduling when the server lacks MSC4140', async () => {
    installClient({ supported: false })

    await expect(
      matrixDelayedEventsService.scheduleMessage('!room:example.org', { body: 'hi' }, 300000)
    ).rejects.toBeInstanceOf(DelayedEventError)
    await expect(
      matrixDelayedEventsService.scheduleMessage('!room:example.org', { body: 'hi' }, 300000)
    ).rejects.toMatchObject({ reason: 'unsupported' })
  })

  it('rejects non-positive or beyond-24h delays locally', async () => {
    installClient({})

    await expect(matrixDelayedEventsService.scheduleMessage('!room:x', { body: 'hi' }, 0)).rejects.toMatchObject({
      reason: 'invalid_delay'
    })
    await expect(
      matrixDelayedEventsService.scheduleMessage('!room:x', { body: 'hi' }, 24 * 60 * 60 * 1000 + 1)
    ).rejects.toMatchObject({ reason: 'invalid_delay' })
  })

  it('schedules through the SDK manager and returns the server delay_id', async () => {
    const { manager } = installClient({})

    await expect(
      matrixDelayedEventsService.scheduleMessage('!room:example.org', { msgtype: 'm.text', body: 'later' }, 300000)
    ).resolves.toBe(7)

    expect(manager.scheduleDelayedEvent).toHaveBeenCalledWith(
      '!room:example.org',
      'm.room.message',
      expect.stringMatching(/^delayed-/),
      { delay_ms: 300000, content: { msgtype: 'm.text', body: 'later' } }
    )
  })

  it('maps and sorts pending events by planned delivery time', async () => {
    const { manager } = installClient({})
    manager.listScheduledDelayedEvents.mockResolvedValue([
      {
        delay_id: 2,
        room_id: '!b:example.org',
        type: 'm.room.message',
        delay_ms: 60000,
        delayed_since_ts: 200000,
        content: { body: 'second' }
      },
      {
        delay_id: 1,
        room_id: '!a:example.org',
        type: 'm.room.message',
        delay_ms: 60000,
        delayed_since_ts: 100000,
        content: { body: 'first' }
      }
    ])

    const items = await matrixDelayedEventsService.listPending()

    expect(items.map((item) => item.delayId)).toEqual([1, 2])
    expect(items[0]).toMatchObject({ roomId: '!a:example.org', scheduledAt: 100000, delayMs: 60000 })
  })

  it('normalizes a missing task on cancel to not_found', async () => {
    const { manager } = installClient({})
    manager.cancelScheduledDelayedEvent.mockRejectedValue({ errcode: 'M_NOT_FOUND' })

    await expect(matrixDelayedEventsService.cancel(3)).rejects.toMatchObject({ reason: 'not_found' })
  })

  it('reschedules by cancelling then scheduling the original content', async () => {
    const { manager } = installClient({})

    await expect(matrixDelayedEventsService.reschedule(7, 600000)).resolves.toBe(7)

    expect(manager.getScheduledDelayedEvent).toHaveBeenCalledWith(7)
    expect(manager.cancelScheduledDelayedEvent).toHaveBeenCalledWith(7)
    expect(manager.scheduleDelayedEvent).toHaveBeenCalledWith(
      '!room:example.org',
      'm.room.message',
      expect.stringMatching(/^delayed-/),
      { delay_ms: 600000, content: { msgtype: 'm.text', body: 'later' } }
    )
  })

  it('keeps the original task when cancel fails during reschedule', async () => {
    const { manager } = installClient({})
    manager.cancelScheduledDelayedEvent.mockRejectedValue(new Error('boom'))

    await expect(matrixDelayedEventsService.reschedule(7, 600000)).rejects.toMatchObject({ reason: 'unknown' })
    expect(manager.scheduleDelayedEvent).not.toHaveBeenCalled()
  })

  it('forwards send-now through the SDK manager', async () => {
    const { manager } = installClient({})

    await matrixDelayedEventsService.sendNow(7)

    expect(manager.sendScheduledDelayedEvent).toHaveBeenCalledWith(7)
  })
})
