import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetStickyEvents, mockSetStickyEvents, mockClearStickyEvent, mockHasCapability, mockEmit, mockResolve } =
  vi.hoisted(() => ({
    mockGetStickyEvents: vi.fn(),
    mockSetStickyEvents: vi.fn(),
    mockClearStickyEvent: vi.fn(),
    mockHasCapability: vi.fn(),
    mockEmit: vi.fn(),
    mockResolve: vi.fn()
  }))

vi.mock('@/services/matrix/room/RoomFacade', () => ({
  matrixRoomActionFacade: {
    getStickyEvents: mockGetStickyEvents,
    setStickyEvents: mockSetStickyEvents,
    clearStickyEvent: mockClearStickyEvent
  }
}))

vi.mock('@/services/matrix/MatrixCapabilityService', () => ({
  matrixCapabilityService: { hasCapability: mockHasCapability }
}))

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: { emit: mockEmit, on: vi.fn(), off: vi.fn() }
}))

vi.mock('../resolveMessageInfo', () => ({
  resolveMessageInfo: mockResolve
}))

import { MittEnum } from '@/enums'
import { parseStickyEventRecords, useStickyEvents } from '../useStickyEvents'

/** 服务端 GET 响应样例 */
const serverPayload = {
  events: [
    {
      room_id: '!r:s',
      user_id: '@alice:s',
      event_id: '$e1:s',
      event_type: 'm.room.message',
      sticky_duration_ms: 60000,
      sticky_expiry_ts: Date.now() + 60_000
    },
    {
      room_id: '!r:s',
      user_id: '@alice:s',
      event_id: '$e2:s',
      event_type: 'org.example.custom',
      sticky_expiry_ts: Date.now() + 60_000
    }
  ]
}

describe('parseStickyEventRecords', () => {
  it('解析协议字段并过滤已过期条目', () => {
    const records = parseStickyEventRecords(
      {
        events: [
          { event_id: '$alive', event_type: 'm.room.message', user_id: '@a:s', sticky_expiry_ts: 2000 },
          { event_id: '$expired', event_type: 'm.room.message', user_id: '@a:s', sticky_expiry_ts: 1000 }
        ]
      },
      1500
    )
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      eventId: '$alive',
      eventType: 'm.room.message',
      userId: '@a:s',
      durationMs: null,
      expiresAt: 2000
    })
  })

  it('缺少 event_type 时回落为 m.room.message', () => {
    const records = parseStickyEventRecords({ events: [{ event_id: '$x', user_id: '@a:s' }] })
    expect(records[0].eventType).toBe('m.room.message')
  })

  it('非法输入返回空数组', () => {
    expect(parseStickyEventRecords(null)).toEqual([])
    expect(parseStickyEventRecords({ events: 'nope' })).toEqual([])
    expect(parseStickyEventRecords({ events: [{ event_type: 'm.room.message' }] })).toEqual([])
  })
})

describe('useStickyEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasCapability.mockReturnValue(true)
    mockGetStickyEvents.mockResolvedValue(serverPayload)
    mockSetStickyEvents.mockResolvedValue(undefined)
    mockClearStickyEvent.mockResolvedValue(undefined)
    mockResolve.mockImplementation(async (_roomId: string, eventId: string) => ({
      eventId,
      sender: '@alice:s',
      body: `body-${eventId}`,
      timestamp: eventId === '$e1:s' ? 1000 : 2000,
      msgtype: 'm.text'
    }))
  })

  it('canSetSticky 跟随 sticky-events 能力', () => {
    mockHasCapability.mockReturnValueOnce(true).mockReturnValueOnce(false)
    expect(useStickyEvents({ roomId: '!r:s' }).canSetSticky.value).toBe(true)
    expect(useStickyEvents({ roomId: '!r:s' }).canSetSticky.value).toBe(false)
  })

  it('load 解析并按时间倒序排列', async () => {
    const flow = useStickyEvents({ roomId: '!r:s' })
    await flow.load()

    expect(mockGetStickyEvents).toHaveBeenCalledWith('!r:s')
    expect(flow.hasLoaded.value).toBe(true)
    expect(flow.events.value.map((item) => item.eventId)).toEqual(['$e2:s', '$e1:s'])
    expect(flow.events.value[1]).toMatchObject({
      eventType: 'm.room.message',
      durationMs: 60000,
      body: 'body-$e1:s'
    })
  })

  it('无房间时 load 清空且不请求服务端', async () => {
    const flow = useStickyEvents({ roomId: null })
    await flow.load()
    expect(mockGetStickyEvents).not.toHaveBeenCalled()
    expect(flow.events.value).toEqual([])
  })

  it('load 失败时不抛错', async () => {
    mockGetStickyEvents.mockRejectedValueOnce(new Error('boom'))
    const flow = useStickyEvents({ roomId: '!r:s' })
    await expect(flow.load()).resolves.toBeUndefined()
    expect(flow.events.value).toEqual([])
  })

  it('setStickyEvent 合并当前表后整表提交并广播', async () => {
    const flow = useStickyEvents({ roomId: '!r:s' })
    await flow.load()

    const ok = await flow.setStickyEvent('$new:s')

    expect(ok).toBe(true)
    expect(mockSetStickyEvents).toHaveBeenCalledWith('!r:s', {
      events: [
        { event_type: 'org.example.custom', event_id: '$e2:s' },
        { event_type: 'm.room.message', event_id: '$new:s' }
      ]
    })
    expect(mockEmit).toHaveBeenCalledWith(MittEnum.STICKY_EVENTS_CHANGED, { roomId: '!r:s' })
  })

  it('setStickyEvent 缺少房间或 eventId 时返回 false', async () => {
    const noRoom = useStickyEvents({ roomId: '' })
    await expect(noRoom.setStickyEvent('$e:s')).resolves.toBe(false)

    const flow = useStickyEvents({ roomId: '!r:s' })
    await expect(flow.setStickyEvent('')).resolves.toBe(false)
    expect(mockSetStickyEvents).not.toHaveBeenCalled()
  })

  it('setStickyEvent 服务失败返回 false', async () => {
    mockSetStickyEvents.mockRejectedValueOnce(new Error('boom'))
    const flow = useStickyEvents({ roomId: '!r:s' })
    await expect(flow.setStickyEvent('$e:s')).resolves.toBe(false)
  })

  it('clearStickyEvent 按 event_type 删除并广播', async () => {
    const flow = useStickyEvents({ roomId: '!r:s' })
    const ok = await flow.clearStickyEvent('m.room.message')

    expect(ok).toBe(true)
    expect(mockClearStickyEvent).toHaveBeenCalledWith('!r:s', 'm.room.message')
    expect(mockEmit).toHaveBeenCalledWith(MittEnum.STICKY_EVENTS_CHANGED, { roomId: '!r:s' })
    expect(mockGetStickyEvents).toHaveBeenCalled()
  })

  it('clearStickyEvent 服务失败返回 false', async () => {
    mockClearStickyEvent.mockRejectedValueOnce(new Error('boom'))
    const flow = useStickyEvents({ roomId: '!r:s' })
    await expect(flow.clearStickyEvent('m.room.message')).resolves.toBe(false)
  })
})
