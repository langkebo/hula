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
  },
  RoomMemberEvent: { Typing: 'RoomMember.typing' }
}))

const workerHostMock = vi.hoisted(() => ({
  isStarted: true,
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
    ROOM_RECEIPT_CHANGED: 'roomReceiptChanged',
    BURN_MESSAGE_READ: 'burnMessageRead'
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
    getUserId: vi.fn(() => '@me:hs'),
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
    it('注册 8 个 SDK 事件监听器并提升 maxListeners 至 50', () => {
      router.setup(client as never, syncManager as never)

      expect(client.setMaxListeners).toHaveBeenCalledWith(50)
      expect(client.on).toHaveBeenCalledTimes(8)

      const events = client.on.mock.calls.map((call) => call[0])
      expect(events).toEqual(
        expect.arrayContaining([
          'sync',
          'Room',
          'Room.timeline',
          'Room.redaction',
          'Event.decrypted',
          'RoomMember.typing',
          'Room.receipt',
          'toDeviceEvent'
        ])
      )
      expect(syncManager.onLifecycleEvent).toHaveBeenCalledTimes(1)
      expect(router.getObservedClient()).toBe(client as never)
    })

    it('同一 client 重复 setup 时去重，不再重复注册', () => {
      router.setup(client as never, syncManager as never)
      router.setup(client as never, syncManager as never)

      expect(client.on).toHaveBeenCalledTimes(8)
      expect(syncManager.onLifecycleEvent).toHaveBeenCalledTimes(1)
    })

    it('setup 新 client 时先 detach 旧 client', () => {
      const client2 = makeClient()
      router.setup(client as never, syncManager as never)
      router.setup(client2 as never, syncManager as never)

      expect(client.off).toHaveBeenCalledTimes(8)
      expect(syncManager.offLifecycleEvent).toHaveBeenCalledTimes(1)
      expect(client2.on).toHaveBeenCalledTimes(8)
      expect(router.getObservedClient()).toBe(client2 as never)
    })
  })

  describe('detach', () => {
    it('注销全部 8 个监听器、取消 Lifecycle 订阅并清空 observedClient', () => {
      router.setup(client as never, syncManager as never)
      router.detach(client as never, syncManager as never)

      expect(client.off).toHaveBeenCalledTimes(8)
      expect(syncManager.offLifecycleEvent).toHaveBeenCalledTimes(1)
      expect(router.getObservedClient()).toBeNull()
    })

    it('worker 已 terminate 时收尾落批静默跳过，不再向 worker 发请求', () => {
      try {
        router.setup(client as never, syncManager as never)
        client.handlers.get('Room.timeline')?.(makeMatrixEvent() as never, makeRoom() as never)

        // 登出流程先 terminate 再 detach：索引已随 worker 销毁，收尾路径必须静默丢弃
        workerHostMock.isStarted = false
        expect(() => router.detach(client as never, syncManager as never)).not.toThrow()
        expect(workerHostMock.upsertSearchEvents).not.toHaveBeenCalled()
      } finally {
        workerHostMock.isStarted = true
      }
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

      const roomHandler = client.handlers.get('Room')
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
      client.handlers.get('Room')?.(room as never)

      expect(workerHostMock.upsertSearchRooms).toHaveBeenCalledTimes(1)

      const eventsHandler = room.on.mock.calls.find((call) => call[0] === 'RoomState.events')?.[1]
      const matrixEvent = makeMatrixEvent({ getType: vi.fn(() => 'm.room.name') })
      ;(eventsHandler as Handler)?.(matrixEvent as never)

      expect(workerHostMock.upsertSearchRooms).toHaveBeenCalledTimes(2)
    })

    it('RoomState.events 中非相关类型不触发 updateRoom', () => {
      router.setup(client as never, syncManager as never)
      const room = makeRoom()
      client.handlers.get('Room')?.(room as never)

      const eventsHandler = room.on.mock.calls.find((call) => call[0] === 'RoomState.events')?.[1]
      const matrixEvent = makeMatrixEvent({ getType: vi.fn(() => 'm.room.topic') })
      ;(eventsHandler as Handler)?.(matrixEvent as never)

      expect(workerHostMock.upsertSearchRooms).toHaveBeenCalledTimes(1)
    })

    it('detachRoomListeners 注销 Room 级监听器并清理', () => {
      router.setup(client as never, syncManager as never)
      const room = makeRoom()
      client.handlers.get('Room')?.(room as never)

      router.detachRoomListeners()

      expect(room.off).toHaveBeenCalledTimes(2)
      expect(room.off).toHaveBeenCalledWith('Room.name', expect.any(Function))
      expect(room.off).toHaveBeenCalledWith('RoomState.events', expect.any(Function))

      // 再次触发 room 事件应重新注册（roomListeners 已被清空）
      client.handlers.get('Room')?.(room as never)
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
    it('RoomMember.typing 触发 useMitt.emit(ROOM_TYPING_CHANGED)', () => {
      router.setup(client as never, syncManager as never)
      const room = makeRoom()
      client.handlers.get('RoomMember.typing')?.(undefined, room as never)

      expect(mittMock.emit).toHaveBeenCalledWith('roomTypingChanged', { roomId: '!room:hs' })
    })

    it('RoomMember.typing 无 room 时不触发 useMitt', () => {
      router.setup(client as never, syncManager as never)
      client.handlers.get('RoomMember.typing')?.('@typer:hs', undefined)

      expect(mittMock.emit).not.toHaveBeenCalled()
    })

    it('Room.receipt 触发 useMitt.emit(ROOM_RECEIPT_CHANGED)', () => {
      router.setup(client as never, syncManager as never)
      const room = makeRoom()
      client.handlers.get('Room.receipt')?.(undefined, room as never)

      expect(mittMock.emit).toHaveBeenCalledWith('roomReceiptChanged', { roomId: '!room:hs' })
    })

    /**
     * 双端闭环的发送端一半：接收方阅读焚毁消息后会补发 m.read 回执，
     * 服务端把回执经 Sliding Sync 广播回房间；这里要把它翻译成
     * BURN_MESSAGE_READ，发送端才能启动倒计时并最终本地焚毁。
     */
    describe('焚毁回执桥接（接收端已读 → 发送端倒计时）', () => {
      function makeBurnEvent(eventId: string, sender = '@me:hs', burn = true) {
        return makeMatrixEvent({
          getId: vi.fn(() => eventId),
          getSender: vi.fn(() => sender),
          getContent: vi.fn(() =>
            burn
              ? { msgtype: 'm.text', body: 'secret', 'm.burn_after_read': { expires_in: 60000 } }
              : { msgtype: 'm.text', body: 'plain' }
          )
        })
      }

      function makeReceiptEvent(content: Record<string, unknown> | undefined) {
        return makeMatrixEvent({
          getType: vi.fn(() => 'm.receipt'),
          getContent: vi.fn(() => content)
        })
      }

      it('对端 m.read 回执命中本人焚毁事件时 emit BURN_MESSAGE_READ', () => {
        router.setup(client as never, syncManager as never)
        const burnEvent = makeBurnEvent('$burn1')
        const room = makeRoom({ findEventById: vi.fn(() => burnEvent) })
        const receipt = makeReceiptEvent({ $burn1: { 'm.read': { '@peer:hs': { ts: 1 } } } })

        client.handlers.get('Room.receipt')?.(receipt as never, room as never)

        expect(mittMock.emit).toHaveBeenCalledWith('burnMessageRead', {
          eventId: '$burn1',
          readAt: expect.any(Number)
        })
      })

      it('自身回执不触发 BURN_MESSAGE_READ', () => {
        router.setup(client as never, syncManager as never)
        const burnEvent = makeBurnEvent('$burn1')
        const room = makeRoom({ findEventById: vi.fn(() => burnEvent) })
        const receipt = makeReceiptEvent({ $burn1: { 'm.read': { '@me:hs': { ts: 1 } } } })

        client.handlers.get('Room.receipt')?.(receipt as never, room as never)

        expect(mittMock.emit).not.toHaveBeenCalledWith('burnMessageRead', expect.anything())
      })

      it('对端回执命中他人发送的焚毁事件时不触发（只关心自己发出的消息）', () => {
        router.setup(client as never, syncManager as never)
        const burnEvent = makeBurnEvent('$burn1', '@peer:hs')
        const room = makeRoom({ findEventById: vi.fn(() => burnEvent) })
        const receipt = makeReceiptEvent({ $burn1: { 'm.read': { '@other:hs': { ts: 1 } } } })

        client.handlers.get('Room.receipt')?.(receipt as never, room as never)

        expect(mittMock.emit).not.toHaveBeenCalledWith('burnMessageRead', expect.anything())
      })

      it('对端回执命中普通消息时不触发', () => {
        router.setup(client as never, syncManager as never)
        const plainEvent = makeBurnEvent('$plain1', '@me:hs', false)
        const room = makeRoom({ findEventById: vi.fn(() => plainEvent) })
        const receipt = makeReceiptEvent({ $plain1: { 'm.read': { '@peer:hs': { ts: 1 } } } })

        client.handlers.get('Room.receipt')?.(receipt as never, room as never)

        expect(mittMock.emit).not.toHaveBeenCalledWith('burnMessageRead', expect.anything())
      })

      it('回执内容不含 m.read 类型时不触发', () => {
        router.setup(client as never, syncManager as never)
        const burnEvent = makeBurnEvent('$burn1')
        const room = makeRoom({ findEventById: vi.fn(() => burnEvent) })
        const receipt = makeReceiptEvent({ $burn1: { 'm.fully_read': { '@peer:hs': { ts: 1 } } } })

        client.handlers.get('Room.receipt')?.(receipt as never, room as never)

        expect(mittMock.emit).not.toHaveBeenCalledWith('burnMessageRead', expect.anything())
      })

      it('事件不在本地时间线（findEventById 未命中）时不触发且不抛错', () => {
        router.setup(client as never, syncManager as never)
        const room = makeRoom({ findEventById: vi.fn(() => undefined) })
        const receipt = makeReceiptEvent({ $missing: { 'm.read': { '@peer:hs': { ts: 1 } } } })

        expect(() => client.handlers.get('Room.receipt')?.(receipt as never, room as never)).not.toThrow()
        expect(mittMock.emit).not.toHaveBeenCalledWith('burnMessageRead', expect.anything())
      })

      it('回执事件内容为空时不触发且不抛错', () => {
        router.setup(client as never, syncManager as never)
        const room = makeRoom({ findEventById: vi.fn(() => undefined) })
        const receipt = makeReceiptEvent(undefined)

        expect(() => client.handlers.get('Room.receipt')?.(receipt as never, room as never)).not.toThrow()
        expect(mittMock.emit).not.toHaveBeenCalledWith('burnMessageRead', expect.anything())
      })
    })

    describe('焚毁已读定向信号桥接（接收端关闭回执 → to-device 兜底）', () => {
      function makeBurnEvent(eventId: string, sender = '@me:hs', burn = true) {
        return makeMatrixEvent({
          getId: vi.fn(() => eventId),
          getSender: vi.fn(() => sender),
          getContent: vi.fn(() =>
            burn
              ? { msgtype: 'm.text', body: 'secret', 'm.burn_after_read': { expires_in: 60000 } }
              : { msgtype: 'm.text', body: 'plain' }
          )
        })
      }

      function makeToDeviceEvent(type: string, content: unknown, sender = '@peer:hs') {
        return makeMatrixEvent({
          getType: vi.fn(() => type),
          getSender: vi.fn(() => sender),
          getContent: vi.fn(() => content)
        })
      }

      it('对端 to-device 焚毁信号命中本人焚毁事件时 emit BURN_MESSAGE_READ', () => {
        router.setup(client as never, syncManager as never)
        const burnEvent = makeBurnEvent('$burn1')
        const room = makeRoom({ findEventById: vi.fn(() => burnEvent) })
        client.getRoom.mockReturnValue(room)
        const signal = makeToDeviceEvent('com.tjg.burn_read', {
          room_id: '!room:hs',
          event_id: '$burn1',
          read_ts: 1
        })

        client.handlers.get('toDeviceEvent')?.(signal as never)

        expect(client.getRoom).toHaveBeenCalledWith('!room:hs')
        expect(mittMock.emit).toHaveBeenCalledWith('burnMessageRead', {
          eventId: '$burn1',
          readAt: expect.any(Number)
        })
      })

      it('本人发出的 to-device 信号被忽略', () => {
        router.setup(client as never, syncManager as never)
        const burnEvent = makeBurnEvent('$burn1')
        const room = makeRoom({ findEventById: vi.fn(() => burnEvent) })
        client.getRoom.mockReturnValue(room)
        const signal = makeToDeviceEvent(
          'com.tjg.burn_read',
          { room_id: '!room:hs', event_id: '$burn1', read_ts: 1 },
          '@me:hs'
        )

        client.handlers.get('toDeviceEvent')?.(signal as never)

        expect(client.getRoom).not.toHaveBeenCalled()
        expect(mittMock.emit).not.toHaveBeenCalledWith('burnMessageRead', expect.anything())
      })

      it('非 com.tjg.burn_read 的 to-device 事件被忽略', () => {
        router.setup(client as never, syncManager as never)
        const room = makeRoom({ findEventById: vi.fn(() => makeBurnEvent('$burn1')) })
        client.getRoom.mockReturnValue(room)
        const signal = makeToDeviceEvent('com.tjg.other', { room_id: '!room:hs', event_id: '$burn1' })

        client.handlers.get('toDeviceEvent')?.(signal as never)

        expect(client.getRoom).not.toHaveBeenCalled()
        expect(mittMock.emit).not.toHaveBeenCalledWith('burnMessageRead', expect.anything())
      })

      it('信号缺少 room_id / event_id 时不触发', () => {
        router.setup(client as never, syncManager as never)
        const signal = makeToDeviceEvent('com.tjg.burn_read', { read_ts: 1 })

        expect(() => client.handlers.get('toDeviceEvent')?.(signal as never)).not.toThrow()
        expect(client.getRoom).not.toHaveBeenCalled()
        expect(mittMock.emit).not.toHaveBeenCalledWith('burnMessageRead', expect.anything())
      })

      it('房间不在本地客户端时不触发', () => {
        router.setup(client as never, syncManager as never)
        client.getRoom.mockReturnValue(undefined)
        const signal = makeToDeviceEvent('com.tjg.burn_read', { room_id: '!unknown:hs', event_id: '$burn1' })

        client.handlers.get('toDeviceEvent')?.(signal as never)

        expect(mittMock.emit).not.toHaveBeenCalledWith('burnMessageRead', expect.anything())
      })

      it('目标事件不在本地时间线时不触发', () => {
        router.setup(client as never, syncManager as never)
        client.getRoom.mockReturnValue(makeRoom({ findEventById: vi.fn(() => undefined) }))
        const signal = makeToDeviceEvent('com.tjg.burn_read', { room_id: '!room:hs', event_id: '$missing' })

        client.handlers.get('toDeviceEvent')?.(signal as never)

        expect(mittMock.emit).not.toHaveBeenCalledWith('burnMessageRead', expect.anything())
      })

      it('目标事件不是本人发送时不触发（防伪造信号烧毁他人消息）', () => {
        router.setup(client as never, syncManager as never)
        const room = makeRoom({ findEventById: vi.fn(() => makeBurnEvent('$burn1', '@other:hs')) })
        client.getRoom.mockReturnValue(room)
        const signal = makeToDeviceEvent('com.tjg.burn_read', { room_id: '!room:hs', event_id: '$burn1' })

        client.handlers.get('toDeviceEvent')?.(signal as never)

        expect(mittMock.emit).not.toHaveBeenCalledWith('burnMessageRead', expect.anything())
      })

      it('目标事件不是焚毁消息时不触发', () => {
        router.setup(client as never, syncManager as never)
        const room = makeRoom({ findEventById: vi.fn(() => makeBurnEvent('$plain1', '@me:hs', false)) })
        client.getRoom.mockReturnValue(room)
        const signal = makeToDeviceEvent('com.tjg.burn_read', { room_id: '!room:hs', event_id: '$plain1' })

        client.handlers.get('toDeviceEvent')?.(signal as never)

        expect(mittMock.emit).not.toHaveBeenCalledWith('burnMessageRead', expect.anything())
      })
    })

    it('Room.redaction 有关联 id 时调用 worker redactSearchEvent', () => {
      router.setup(client as never, syncManager as never)
      const event = makeMatrixEvent({ getAssociatedId: vi.fn(() => '$redacted1') })
      client.handlers.get('Room.redaction')?.(event as never)

      expect(workerHostMock.redactSearchEvent).toHaveBeenCalledWith('$redacted1')
    })

    it('Room.redaction 无关联 id 时不调用 worker', () => {
      router.setup(client as never, syncManager as never)
      const event = makeMatrixEvent({ getAssociatedId: vi.fn(() => undefined) })
      client.handlers.get('Room.redaction')?.(event as never)

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

    it('room_timeline 中 m.text 消息按 50ms 窗口批量写入 worker upsertSearchEvents', () => {
      vi.useFakeTimers()
      try {
        router.setup(client as never, syncManager as never)
        const room = makeRoom()
        client.handlers.get('Room.timeline')?.(makeMatrixEvent() as never, room as never)
        client.handlers.get('Room.timeline')?.(
          makeMatrixEvent({ getId: vi.fn(() => '$event2') }) as never,
          room as never
        )

        expect(workerHostMock.upsertSearchEvents).not.toHaveBeenCalled()

        vi.advanceTimersByTime(50)

        expect(workerHostMock.upsertSearchEvents).toHaveBeenCalledTimes(1)
        expect(workerHostMock.upsertSearchEvents).toHaveBeenCalledWith([
          expect.objectContaining({ eventId: '$event1', body: 'hello' }),
          expect.objectContaining({ eventId: '$event2', body: 'hello' })
        ])
      } finally {
        vi.useRealTimers()
      }
    })

    it('worker 未启动时保留批次，启动后在下个窗口补写', () => {
      vi.useFakeTimers()
      try {
        // 旧实现把批次交给未启动的 worker 后直接丢弃，这段搜索索引永久丢失
        workerHostMock.isStarted = false
        router.setup(client as never, syncManager as never)
        client.handlers.get('Room.timeline')?.(makeMatrixEvent() as never, makeRoom() as never)

        vi.advanceTimersByTime(50)
        expect(workerHostMock.upsertSearchEvents).not.toHaveBeenCalled()

        workerHostMock.isStarted = true
        vi.advanceTimersByTime(50)

        expect(workerHostMock.upsertSearchEvents).toHaveBeenCalledTimes(1)
        expect(workerHostMock.upsertSearchEvents).toHaveBeenCalledWith([
          expect.objectContaining({ eventId: '$event1', body: 'hello' })
        ])
      } finally {
        workerHostMock.isStarted = true
        vi.useRealTimers()
      }
    })

    it('worker 冷启动超过旧的 150ms 重试预算后，缓冲事件仍能补写', () => {
      vi.useFakeTimers()
      try {
        // 冷启动实测 0.6–1.5s：旧实现只等约 150ms 就丢批，这里验证新退避能撑到 worker 就绪
        workerHostMock.isStarted = false
        router.setup(client as never, syncManager as never)
        client.handlers.get('Room.timeline')?.(makeMatrixEvent() as never, makeRoom() as never)

        vi.advanceTimersByTime(1_200)
        expect(workerHostMock.upsertSearchEvents).not.toHaveBeenCalled()

        workerHostMock.isStarted = true
        vi.advanceTimersByTime(2_000)

        expect(workerHostMock.upsertSearchEvents).toHaveBeenCalledTimes(1)
        expect(workerHostMock.upsertSearchEvents).toHaveBeenCalledWith([
          expect.objectContaining({ eventId: '$event1', body: 'hello' })
        ])
      } finally {
        workerHostMock.isStarted = true
        vi.useRealTimers()
      }
    })

    it('worker 超过 30s 仍未启动才丢弃缓冲，之后启动也不再补写', () => {
      vi.useFakeTimers()
      try {
        workerHostMock.isStarted = false
        router.setup(client as never, syncManager as never)
        client.handlers.get('Room.timeline')?.(makeMatrixEvent() as never, makeRoom() as never)

        // 退避到 30s 时限后的下一个重试点才判定超时丢批（约 30.4s）
        vi.advanceTimersByTime(32_000)
        expect(workerHostMock.upsertSearchEvents).not.toHaveBeenCalled()

        workerHostMock.isStarted = true
        vi.advanceTimersByTime(2_000)

        expect(workerHostMock.upsertSearchEvents).not.toHaveBeenCalled()
      } finally {
        workerHostMock.isStarted = true
        vi.useRealTimers()
      }
    })

    it('room_timeline 中非 m.text 消息不调用 worker upsertSearchEvents', () => {
      router.setup(client as never, syncManager as never)
      const event = makeMatrixEvent({
        getType: vi.fn(() => 'm.room.message'),
        getContent: vi.fn(() => ({ msgtype: 'm.image' }))
      })
      client.handlers.get('Room.timeline')?.(event as never, makeRoom() as never)

      expect(workerHostMock.upsertSearchEvents).not.toHaveBeenCalled()
    })
  })
})
