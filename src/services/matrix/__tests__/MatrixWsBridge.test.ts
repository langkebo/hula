import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WsResponseMessageType } from '@/services/legacy/wsType'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { ClientEvent, RoomEvent, RoomStateEvent } from '@/services/matrix/sdk'

const mockEmit = vi.fn()
vi.mock('@/composables/common/useMitt', () => ({
  useMitt: {
    emit: (...args: unknown[]) => mockEmit(...args),
    on: vi.fn(),
    off: vi.fn()
  }
}))

const handlers = new Map<unknown, Array<(...args: unknown[]) => void>>()
const fakeClient = {
  getUserId: vi.fn(() => '@alice:matrix.test'),
  getDeviceId: vi.fn(() => 'DEV1'),
  getRoom: vi.fn(),
  on: vi.fn((event: unknown, cb: (...args: unknown[]) => void) => {
    const list = handlers.get(event) ?? []
    list.push(cb)
    handlers.set(event, list)
  }),
  off: vi.fn((event: unknown, cb: (...args: unknown[]) => void) => {
    const list = handlers.get(event) ?? []
    handlers.set(
      event,
      list.filter((h) => h !== cb)
    )
  })
}

const fire = (event: unknown, ...args: unknown[]) => {
  for (const cb of handlers.get(event) ?? []) cb(...args)
}

describe('MatrixWsBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    handlers.clear()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(fakeClient as never)
  })

  it('registers listeners on start and removes them on stop', async () => {
    const { matrixWsBridge } = await import('../MatrixWsBridge')
    matrixWsBridge.start()
    expect(fakeClient.on).toHaveBeenCalledWith(ClientEvent.Sync, expect.any(Function))
    expect(fakeClient.on).toHaveBeenCalledWith(RoomEvent.Redaction, expect.any(Function))
    expect(fakeClient.on).toHaveBeenCalledWith(RoomStateEvent.Events, expect.any(Function))

    matrixWsBridge.stop()
    expect(fakeClient.off).toHaveBeenCalledTimes(3)
  })

  it('emits TOKEN_EXPIRED on sync error with M_UNKNOWN_TOKEN', async () => {
    const { matrixWsBridge } = await import('../MatrixWsBridge')
    matrixWsBridge.start()

    fire(ClientEvent.Sync, 'ERROR', 'SYNCING', { errcode: 'M_UNKNOWN_TOKEN' })

    expect(mockEmit).toHaveBeenCalledWith(WsResponseMessageType.TOKEN_EXPIRED, {
      uid: '@alice:matrix.test',
      ip: '',
      client: 'DEV1'
    })
    matrixWsBridge.stop()
  })

  it('ignores sync errors without M_UNKNOWN_TOKEN/M_MISSING_TOKEN', async () => {
    const { matrixWsBridge } = await import('../MatrixWsBridge')
    matrixWsBridge.start()

    fire(ClientEvent.Sync, 'ERROR', 'SYNCING', { errcode: 'M_LIMIT_EXCEEDED' })
    fire(ClientEvent.Sync, 'PREPARED', 'SYNCING', undefined)

    expect(mockEmit).not.toHaveBeenCalled()
    matrixWsBridge.stop()
  })

  it('emits MSG_RECALL on Room.Redaction', async () => {
    const { matrixWsBridge } = await import('../MatrixWsBridge')
    matrixWsBridge.start()

    const event = {
      event: { redacts: '$evt:matrix.test' },
      getContent: () => ({}),
      getSender: () => '@bob:matrix.test'
    }
    const room = { roomId: '!room:matrix.test' }
    fire(RoomEvent.Redaction, event, room)

    expect(mockEmit).toHaveBeenCalledWith(WsResponseMessageType.MSG_RECALL, {
      msgId: '$evt:matrix.test',
      roomId: '!room:matrix.test',
      recallUid: '@bob:matrix.test'
    })
    matrixWsBridge.stop()
  })

  it('emits ROOM_INFO_CHANGE on m.room.name state event', async () => {
    const { matrixWsBridge } = await import('../MatrixWsBridge')
    fakeClient.getRoom.mockReturnValueOnce({
      name: 'Alpha',
      getMxcAvatarUrl: () => 'mxc://matrix.test/abc'
    })
    matrixWsBridge.start()

    const event = {
      getType: () => 'm.room.name',
      getContent: () => ({ name: 'Alpha' })
    }
    const state = { roomId: '!room:matrix.test' }
    fire(RoomStateEvent.Events, event, state)

    expect(mockEmit).toHaveBeenCalledWith(WsResponseMessageType.ROOM_INFO_CHANGE, {
      roomId: '!room:matrix.test',
      name: 'Alpha',
      avatar: 'mxc://matrix.test/abc'
    })
    matrixWsBridge.stop()
  })

  it('ignores unrelated state event types', async () => {
    const { matrixWsBridge } = await import('../MatrixWsBridge')
    matrixWsBridge.start()

    const event = { getType: () => 'm.room.topic', getContent: () => ({ topic: 'x' }) }
    const state = { roomId: '!room:matrix.test' }
    fire(RoomStateEvent.Events, event, state)

    expect(mockEmit).not.toHaveBeenCalled()
    matrixWsBridge.stop()
  })
})
