import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MatrixEventRouter } from '@/services/matrix/MatrixEventRouter'
import { SlidingSyncState } from '../sdk'

// ---- 依赖 mock（白盒：不依赖真实 SDK / 网络）-----------------------------------

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), trace: vi.fn() })
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

vi.mock('matrix-js-sdk', () => ({
  SlidingSyncState: {
    Established: 'established',
    RequestFinished: 'request-finished',
    Complete: 'complete',
    RecatchUp: 'recatch-up'
  }
}))

const workerHostMock = vi.hoisted(() => ({
  upsertSearchRooms: vi.fn(async () => undefined),
  upsertSearchEvents: vi.fn(async () => undefined),
  redactSearchEvent: vi.fn(async () => undefined)
}))
vi.mock('@/services/matrix/MatrixWorkerHost', () => ({
  matrixWorkerHost: workerHostMock
}))

const mittMock = vi.hoisted(() => ({
  emit: vi.fn(),
  on: vi.fn(() => () => {}),
  off: vi.fn()
}))
vi.mock('@/composables/common/useMitt', () => ({
  useMitt: mittMock
}))

vi.mock('@/enums', () => ({
  MittEnum: {
    ROOM_TYPING_CHANGED: 'roomTypingChanged',
    ROOM_RECEIPT_CHANGED: 'roomReceiptChanged'
  }
}))

// ---- 测试工具 ----------------------------------------------------------------

type Handler = (...args: unknown[]) => void

function makeClient() {
  const handlers = new Map<string, Handler>()
  return {
    handlers,
    setMaxListeners: vi.fn(),
    getRooms: vi.fn(),
    getRoom: vi.fn(),
    getHomeserverUrl: vi.fn(() => 'https://hs.example.com'),
    on: vi.fn((evt: string, handler: Handler) => {
      handlers.set(evt, handler)
    }),
    off: vi.fn((evt: string, handler: Handler) => {
      if (handlers.get(evt) === handler) handlers.delete(evt)
    })
  }
}

function makeSyncManager() {
  const syncManager: {
    onLifecycleEvent: ReturnType<typeof vi.fn>
    offLifecycleEvent: ReturnType<typeof vi.fn>
    lifecycleHandler: Handler | null
  } = {
    onLifecycleEvent: vi.fn(),
    offLifecycleEvent: vi.fn(),
    lifecycleHandler: null
  }
  syncManager.onLifecycleEvent.mockImplementation((handler: Handler) => {
    syncManager.lifecycleHandler = handler
  })
  return syncManager
}

function makeRoom(overrides: Record<string, unknown> = {}) {
  const room = {
    roomId: '!room:hs',
    name: 'Test Room',
    on: vi.fn(),
    off: vi.fn(),
    setMaxListeners: vi.fn(),
    getLiveState: () => ({ setMaxListeners: vi.fn() }),
    getAvatarUrl: vi.fn(() => 'http://avatar/48'),
    getJoinedMemberCount: vi.fn(() => 5),
    ...overrides
  }
  return room
}

function makeMatrixEvent(overrides: Record<string, unknown> = {}) {
  return {
    getType: vi.fn(() => 'm.room.message'),
    getContent: vi.fn(() => ({ msgtype: 'm.text', body: 'hello' })),
    getId: vi.fn(() => '$event1'),
    getRoomId: vi.fn(() => '!room:hs'),
    getSender: vi.fn(() => '@alice:hs'),
    getTs: vi.fn(() => 1700000000000),
    getAssociatedId: vi.fn(() => undefined),
    ...overrides
  }
}

describe('MatrixEventRouter', () => {
  let router: MatrixEventRouter
  let client: ReturnType<typeof makeClient>
  let syncManager: ReturnType<typeof makeSyncManager>

  beforeEach(() => {
    vi.clearAllMocks()
    router = new MatrixEventRouter()
    client = makeClient()
    syncManager = makeSyncManager()
  })

  describe('setup', () => {
    it('注册 7 个 SDK 事件监听器并提升 maxListeners 至 50', () => {
      router.setup(client as never, syncManager as never)

      expect(client.setMaxListeners).toHaveBeenCalledWith(50)
      expect(client.on).toHaveBeenCalledTimes(7)

      const events = client.on.mock.calls.map((call) => call[0])
      expect(events).toEqual(
        expect.arrayContaining([
          'sync',
          'room',
          'room_timeline',
          'Event.redaction',
          'Event.decrypted',
          'Room.typing',
          'Room.receipt'
        ])
      )
      expect(syncManager.onLifecycleEvent).toHaveBeenCalledTimes(1)
      expect(router.getObservedClient()).toBe(client as never)
    })

    it('同一 client 重复 setup 时去重，不再重复注册', () => {
      router.setup(client as never, syncManager as never)
      router.setup(client as never, syncManager as never)

      expect(client.on).toHaveBeenCalledTimes(7)
      expect(syncManager.onLifecycleEvent).toHaveBeenCalledTimes(1)
    })

    it('setup 新 client 时先 detach 旧 client', () => {
      const client2 = makeClient()
      router.setup(client as never, syncManager as never)
      router.setup(client2 as never, syncManager as never)

      expect(client.off).toHaveBeenCalledTimes(7)
      expect(syncManager.offLifecycleEvent).toHaveBeenCalledTimes(1)
      expect(client2.on).toHaveBeenCalledTimes(7)
      expect(router.getObservedClient()).toBe(client2 as never)
    })
  })

  describe('detach', () => {
    it('注销全部 7 个监听器、取消 Lifecycle 订阅并清空 observedClient', () => {
      router.setup(client as never, syncManager as never)
      router.detach(client as never, syncManager as never)

      expect(client.off).toHaveBeenCalledTimes(7)
      expect(syncManager.offLifecycleEvent).toHaveBeenCalledTimes(1)
      expect(router.getObservedClient()).toBeNull()
    })
  })

  describe('外部事件系统 (on/off/emit)', () => {
    it('on/emit 传递数据给订阅者', () => {
      const cb = vi.fn()
      router.on('my-event', cb)
      router.emit('my-event', 1, 'two')
      expect(cb).toHaveBeenCalledWith(1, 'two')
    })

    it('off 之后不再通知', () => {
      const cb = vi.fn()
      router.on('my-event', cb)
      router.off('my-event', cb)
      router.emit('my-event', 1)
      expect(cb).not.toHaveBeenCalled()
    })

    it('clearExternalListeners 清空全部订阅', () => {
      const cb = vi.fn()
      router.on('my-event', cb)
      router.clearExternalListeners()
      router.emit('my-event', 1)
      expect(cb).not.toHaveBeenCalled()
    })
  })

  describe('roomListener', () => {
    it('注册 Room.name / RoomState.events 监听器并调用 worker upsertSearchRooms', () => {
      router.setup(client as never, syncManager as never)
      const room = makeRoom()

      const roomHandler = client.handlers.get('room')
      expect(roomHandler).toBeDefined()
      roomHandler?.(room as never)

      // worker 转发
      expect(workerHostMock.upsertSearchRooms).toHaveBeenCalledWith([
        {
          roomId: '!room:hs',
          name: 'Test Room',
          avatarUrl: 'http://avatar/48',
          memberCount: 5
        }
      ])
      // Room 级监听器注册 + maxListeners
      expect(room.setMaxListeners).toHaveBeenCalledWith(30)
      expect(room.on).toHaveBeenCalledWith('Room.name', expect.any(Function))
      expect(room.on).toHaveBeenCalledWith('RoomState.events', expect.any(Function))
    })

    it('RoomState.events 中 m.room.name 事件触发 updateRoom', () => {
      router.setup(client as never, syncManager as never)
      const room = makeRoom()
      client.handlers.get('room')?.(room as never)

      expect(workerHostMock.upsertSearchRooms).toHaveBeenCalledTimes(1)

      const eventsHandler = room.on.mock.calls.find((call) => call[0] === 'RoomState.events')?.[1]
      const matrixEvent = makeMatrixEvent({ getType: vi.fn(() => 'm.room.name') })
      ;(eventsHandler as Handler)?.(matrixEvent as never)

      expect(workerHostMock.upsertSearchRooms).toHaveBeenCalledTimes(2)
    })

    it('RoomState.events 中非相关类型不触发 updateRoom', () => {
      router.setup(client as never, syncManager as never)
      const room = makeRoom()
      client.handlers.get('room')?.(room as never)

      const eventsHandler = room.on.mock.calls.find((call) => call[0] === 'RoomState.events')?.[1]
      const matrixEvent = makeMatrixEvent({ getType: vi.fn(() => 'm.room.topic') })
      ;(eventsHandler as Handler)?.(matrixEvent as never)

      expect(workerHostMock.upsertSearchRooms).toHaveBeenCalledTimes(1)
    })

    it('detachRoomListeners 注销 Room 级监听器并清理', () => {
      router.setup(client as never, syncManager as never)
      const room = makeRoom()
      client.handlers.get('room')?.(room as never)

      router.detachRoomListeners()

      expect(room.off).toHaveBeenCalledTimes(2)
      expect(room.off).toHaveBeenCalledWith('Room.name', expect.any(Function))
      expect(room.off).toHaveBeenCalledWith('RoomState.events', expect.any(Function))

      // 再次触发 room 事件应重新注册（roomListeners 已被清空）
      client.handlers.get('room')?.(room as never)
      expect(room.on).toHaveBeenCalledTimes(4)
    })
  })

  describe('syncListener', () => {
    it('转发 sync 事件到外部事件系统并调用 syncStateHandler', () => {
      const syncStateHandler = vi.fn()
      router.setSyncStateHandler(syncStateHandler)
      const syncCb = vi.fn()
      router.on('sync', syncCb)

      router.setup(client as never, syncManager as never)
      const syncHandler = client.handlers.get('sync')
      syncHandler?.('SYNCING', 'PREPARED', { foo: 1 })

      expect(syncCb).toHaveBeenCalledWith({ state: 'SYNCING', prevState: 'PREPARED', data: { foo: 1 } })
      expect(syncStateHandler).toHaveBeenCalledWith('SYNCING', 'PREPARED', { foo: 1 })
    })
  })

  describe('syncLifecycle 事件处理', () => {
    it('RequestFinished + err 触发 errorHandler 并 emit sync-request-error', () => {
      const errorHandler = vi.fn()
      const resetHandler = vi.fn()
      router.setLifecycleErrorHandler(errorHandler)
      router.setLifecycleResetHandler(resetHandler)
      const errCb = vi.fn()
      router.on('sync-request-error', errCb)

      router.setup(client as never, syncManager as never)
      const handler = syncManager.lifecycleHandler as Handler
      const err = new Error('sliding sync failed')
      handler?.call(router, SlidingSyncState.RequestFinished, {}, err)

      expect(errorHandler).toHaveBeenCalledWith(err)
      expect(errCb).toHaveBeenCalledWith(err)
      expect(resetHandler).not.toHaveBeenCalled()
    })

    it('RequestFinished 无 err 时不触发任何处理器', () => {
      const errorHandler = vi.fn()
      const resetHandler = vi.fn()
      router.setLifecycleErrorHandler(errorHandler)
      router.setLifecycleResetHandler(resetHandler)

      router.setup(client as never, syncManager as never)
      const handler = syncManager.lifecycleHandler as Handler
      handler?.call(router, SlidingSyncState.RequestFinished, {}, undefined)

      expect(errorHandler).not.toHaveBeenCalled()
      expect(resetHandler).not.toHaveBeenCalled()
    })

    it('Complete 触发 resetHandler', () => {
      const errorHandler = vi.fn()
      const resetHandler = vi.fn()
      router.setLifecycleErrorHandler(errorHandler)
      router.setLifecycleResetHandler(resetHandler)

      router.setup(client as never, syncManager as never)
      const handler = syncManager.lifecycleHandler as Handler
      handler?.call(router, SlidingSyncState.Complete, {}, undefined)

      expect(resetHandler).toHaveBeenCalledTimes(1)
      expect(errorHandler).not.toHaveBeenCalled()
    })
  })

  describe('typing / receipt / redaction / decrypted / timeline', () => {
    it('Room.typing 触发 useMitt.emit(ROOM_TYPING_CHANGED)', () => {
      router.setup(client as never, syncManager as never)
      const room = makeRoom()
      client.handlers.get('Room.typing')?.(undefined, room as never)

      expect(mittMock.emit).toHaveBeenCalledWith('roomTypingChanged', { roomId: '!room:hs' })
    })

    it('Room.typing 无 room 时不触发 useMitt', () => {
      router.setup(client as never, syncManager as never)
      client.handlers.get('Room.typing')?.('@typer:hs', undefined)

      expect(mittMock.emit).not.toHaveBeenCalled()
    })

    it('Room.receipt 触发 useMitt.emit(ROOM_RECEIPT_CHANGED)', () => {
      router.setup(client as never, syncManager as never)
      const room = makeRoom()
      client.handlers.get('Room.receipt')?.(undefined, room as never)

      expect(mittMock.emit).toHaveBeenCalledWith('roomReceiptChanged', { roomId: '!room:hs' })
    })

    it('Event.redaction 有关联 id 时调用 worker redactSearchEvent', () => {
      router.setup(client as never, syncManager as never)
      const event = makeMatrixEvent({ getAssociatedId: vi.fn(() => '$redacted1') })
      client.handlers.get('Event.redaction')?.(event as never)

      expect(workerHostMock.redactSearchEvent).toHaveBeenCalledWith('$redacted1')
    })

    it('Event.redaction 无关联 id 时不调用 worker', () => {
      router.setup(client as never, syncManager as never)
      const event = makeMatrixEvent({ getAssociatedId: vi.fn(() => undefined) })
      client.handlers.get('Event.redaction')?.(event as never)

      expect(workerHostMock.redactSearchEvent).not.toHaveBeenCalled()
    })

    it('Event.decrypted 调用 eventDecryptedHandler 并 emit eventDecrypted', () => {
      const decryptedHandler = vi.fn()
      router.setEventDecryptedHandler(decryptedHandler)
      const decryptedCb = vi.fn()
      router.on('eventDecrypted', decryptedCb)
      const rooms = makeRoom()
      client.getRoom.mockReturnValue(rooms)

      router.setup(client as never, syncManager as never)
      const event = makeMatrixEvent({ getRoomId: vi.fn(() => '!room:hs') })
      const err = new Error('decrypt failed')
      client.handlers.get('Event.decrypted')?.(event as never, err)

      expect(decryptedHandler).toHaveBeenCalledWith(event, err)
      expect(decryptedCb).toHaveBeenCalledWith({ event, err, room: rooms })
    })

    it('room_timeline 中 m.text 消息调用 worker upsertSearchEvents', () => {
      router.setup(client as never, syncManager as never)
      const event = makeMatrixEvent()
      const room = makeRoom()
      client.handlers.get('room_timeline')?.(event as never, room as never)

      expect(workerHostMock.upsertSearchEvents).toHaveBeenCalledWith([
        {
          eventId: '$event1',
          roomId: '!room:hs',
          sender: '@alice:hs',
          timestamp: 1700000000000,
          msgtype: 'm.text',
          body: 'hello'
        }
      ])
    })

    it('room_timeline 中非 m.text 消息不调用 worker upsertSearchEvents', () => {
      router.setup(client as never, syncManager as never)
      const event = makeMatrixEvent({
        getType: vi.fn(() => 'm.room.message'),
        getContent: vi.fn(() => ({ msgtype: 'm.image' }))
      })
      client.handlers.get('room_timeline')?.(event as never, makeRoom() as never)

      expect(workerHostMock.upsertSearchEvents).not.toHaveBeenCalled()
    })
  })
})
