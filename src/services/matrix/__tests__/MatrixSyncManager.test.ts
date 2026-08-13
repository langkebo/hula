import type { MSC3575SlidingSyncResponse } from 'matrix-js-sdk'
import { HTTPError, SlidingSync, SlidingSyncEvent, SlidingSyncState } from 'matrix-js-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatrixClientConfig } from '../MatrixClientService'
import {
  detectNetworkType,
  MatrixSyncManager,
  SLIDING_SYNC_PRESETS,
  type SlidingSyncLifecycleListener
} from '../MatrixSyncManager'

const { loggerSpy } = vi.hoisted(() => ({
  loggerSpy: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => loggerSpy
}))

describe('MatrixSyncManager', () => {
  const createMockClient = () => ({}) as unknown as import('matrix-js-sdk').MatrixClient

  const defaultConfig: MatrixClientConfig = {
    homeserverUrl: 'https://matrix.test'
  }

  it('returns null when no instance has been created', () => {
    const manager = new MatrixSyncManager()
    expect(manager.get()).toBeNull()
  })

  it('creates a SlidingSync instance with default config values', () => {
    const manager = new MatrixSyncManager()
    const client = createMockClient()
    const ss = manager.create(client, defaultConfig)

    expect(ss).toBeDefined()
    expect(manager.get()).toBe(ss)
  })

  it('respects custom sliding sync config', () => {
    const manager = new MatrixSyncManager()
    const client = createMockClient()
    const ss = manager.create(client, {
      homeserverUrl: 'https://matrix.test',
      slidingSync: {
        roomRangeEnd: 9,
        timelineLimit: 5,
        pollTimeout: 15000
      }
    })

    expect(ss).toBeDefined()
    expect(manager.get()).toBe(ss)
  })

  it('stop clears the current instance', () => {
    const manager = new MatrixSyncManager()
    manager.create(createMockClient(), defaultConfig)
    expect(manager.get()).not.toBeNull()

    manager.stop()
    expect(manager.get()).toBeNull()
  })

  it('waitForReady returns false when no instance exists', async () => {
    const manager = new MatrixSyncManager()
    const ready = await manager.waitForReady(100)
    expect(ready).toBe(false)
  })

  it('waitForReady returns true after markReady is called', async () => {
    const manager = new MatrixSyncManager()
    manager.create(createMockClient(), defaultConfig)
    manager.resetReady()
    manager.markReady()

    const ready = await manager.waitForReady(500)
    expect(ready).toBe(true)
  })

  it('waitForReady times out when markReady is never called', async () => {
    const manager = new MatrixSyncManager()
    manager.create(createMockClient(), defaultConfig)
    manager.resetReady()

    const ready = await manager.waitForReady(50)
    expect(ready).toBe(false)
  })

  it('resetReady replaces the pending promise', async () => {
    const manager = new MatrixSyncManager()
    manager.create(createMockClient(), defaultConfig)
    manager.resetReady()
    manager.markReady()

    // First resetReady was already resolved by markReady
    const first = await manager.waitForReady(50)
    expect(first).toBe(true)

    // Second resetReady creates a new unresolved promise
    manager.resetReady()
    const second = await manager.waitForReady(50)
    expect(second).toBe(false)
  })

  describe('Lifecycle 事件封装（onLifecycleEvent / offLifecycleEvent）', () => {
    it('onLifecycleEvent 委托到 SlidingSync 实例的 on 方法', () => {
      const manager = new MatrixSyncManager()
      const ss = manager.create(createMockClient(), defaultConfig)
      const onSpy = vi.spyOn(ss, 'on')

      const listener: SlidingSyncLifecycleListener = () => {}
      manager.onLifecycleEvent(listener)

      expect(onSpy).toHaveBeenCalledWith(SlidingSyncEvent.Lifecycle, listener)
    })

    it('offLifecycleEvent 委托到 SlidingSync 实例的 off 方法', () => {
      const manager = new MatrixSyncManager()
      const ss = manager.create(createMockClient(), defaultConfig)
      const offSpy = vi.spyOn(ss, 'off')

      const listener: SlidingSyncLifecycleListener = () => {}
      manager.offLifecycleEvent(listener)

      expect(offSpy).toHaveBeenCalledWith(SlidingSyncEvent.Lifecycle, listener)
    })

    it('onLifecycleEvent 在无实例时安全跳过（不抛错）', () => {
      const manager = new MatrixSyncManager()
      const listener: SlidingSyncLifecycleListener = () => {}

      expect(() => manager.onLifecycleEvent(listener)).not.toThrow()
    })

    it('offLifecycleEvent 在无实例时安全跳过（不抛错）', () => {
      const manager = new MatrixSyncManager()
      const listener: SlidingSyncLifecycleListener = () => {}

      expect(() => manager.offLifecycleEvent(listener)).not.toThrow()
    })

    it('stop 后 onLifecycleEvent 不再订阅（实例已清除）', () => {
      const manager = new MatrixSyncManager()
      manager.create(createMockClient(), defaultConfig)
      manager.stop()

      const listener: SlidingSyncLifecycleListener = () => {}
      expect(() => manager.onLifecycleEvent(listener)).not.toThrow()
    })

    it('通过 onLifecycleEvent 订阅的监听器能收到 SlidingSync Lifecycle 事件', () => {
      const manager = new MatrixSyncManager()
      const ss = manager.create(createMockClient(), defaultConfig)

      const receivedStates: string[] = []
      const listener: SlidingSyncLifecycleListener = (state) => {
        receivedStates.push(state as string)
      }
      manager.onLifecycleEvent(listener)

      // 模拟 SDK 触发 Lifecycle 事件
      ss.emit(SlidingSyncEvent.Lifecycle, SlidingSyncState.Complete, null, undefined)

      expect(receivedStates).toContain(SlidingSyncState.Complete)

      // 清理
      manager.offLifecycleEvent(listener)
    })
  })

  describe('动态 SlidingSync 参数（网络自适应）', () => {
    interface MockConnection {
      effectiveType: string
      addEventListener: (type: string, handler: () => void) => void
      removeEventListener: (type: string, handler: () => void) => void
    }

    /** 设置 navigator.connection mock */
    function setMockConnection(conn: Partial<MockConnection> | null): void {
      const nav = navigator as unknown as { connection?: MockConnection }
      if (conn) {
        nav.connection = {
          effectiveType: 'wifi',
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          ...conn
        } as MockConnection
      } else {
        delete nav.connection
      }
    }

    afterEach(() => {
      setMockConnection(null)
    })

    it('detectNetworkType: 无 navigator.connection 时降级为 wifi', () => {
      setMockConnection(null)
      expect(detectNetworkType()).toBe('wifi')
    })

    it('detectNetworkType: effectiveType=4g 返回 4g', () => {
      setMockConnection({ effectiveType: '4g' })
      expect(detectNetworkType()).toBe('4g')
    })

    it('detectNetworkType: effectiveType=3g 返回 3g', () => {
      setMockConnection({ effectiveType: '3g' })
      expect(detectNetworkType()).toBe('3g')
    })

    it('detectNetworkType: effectiveType=slow-2g 返回 slow-2g', () => {
      setMockConnection({ effectiveType: 'slow-2g' })
      expect(detectNetworkType()).toBe('slow-2g')
    })

    it('detectNetworkType: 未知 effectiveType 降级为 wifi', () => {
      setMockConnection({ effectiveType: 'unknown-type' })
      expect(detectNetworkType()).toBe('wifi')
    })

    it('SLIDING_SYNC_PRESETS: 四档预设值正确', () => {
      expect(SLIDING_SYNC_PRESETS.wifi).toEqual({ roomRangeEnd: 49, timelineLimit: 10, pollTimeout: 30000 })
      expect(SLIDING_SYNC_PRESETS['4g']).toEqual({ roomRangeEnd: 29, timelineLimit: 5, pollTimeout: 25000 })
      expect(SLIDING_SYNC_PRESETS['3g']).toEqual({ roomRangeEnd: 19, timelineLimit: 3, pollTimeout: 20000 })
      expect(SLIDING_SYNC_PRESETS['slow-2g']).toEqual({ roomRangeEnd: 9, timelineLimit: 1, pollTimeout: 15000 })
    })

    it('stop 后网络变化监听器被移除', () => {
      const removeSpy = vi.fn()
      setMockConnection({ effectiveType: 'wifi', removeEventListener: removeSpy })
      const manager = new MatrixSyncManager()
      manager.create(createMockClient(), defaultConfig)
      manager.stop()

      // 验证 removeEventListener 被调用
      expect(removeSpy).toHaveBeenCalledWith('change', expect.any(Function))
    })

    it('无 navigator.connection 时不注册监听器（不抛错）', () => {
      setMockConnection(null)
      const manager = new MatrixSyncManager()
      expect(() => manager.create(createMockClient(), defaultConfig)).not.toThrow()
      manager.stop()
    })
  })

  describe('pos 持久化与增量恢复', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    afterEach(() => {
      localStorage.clear()
    })

    /** 构造带 pos 的完整 SlidingSyncResponse 用于 emit */
    function makeResp(pos: string): MSC3575SlidingSyncResponse {
      return { pos, lists: {}, rooms: {}, extensions: {} } as MSC3575SlidingSyncResponse
    }

    /** emit 的类型严格，用 as never 绕过 */
    function emitLifecycle(
      ss: import('matrix-js-sdk').SlidingSync,
      state: SlidingSyncState,
      resp: unknown,
      err?: Error
    ): void {
      ;(ss.emit as (event: string, ...args: unknown[]) => void)(SlidingSyncEvent.Lifecycle, state, resp, err)
    }

    it('SlidingSync Complete 事件触发 pos 持久化到 localStorage', () => {
      const manager = new MatrixSyncManager()
      const ss = manager.create(createMockClient(), defaultConfig)

      emitLifecycle(ss, SlidingSyncState.Complete, makeResp('pos-abc-123'))

      const raw = localStorage.getItem('matrix.sliding_sync.pos')
      expect(raw).not.toBeNull()
      const data = JSON.parse(raw!)
      expect(data.pos).toBe('pos-abc-123')
      expect(typeof data.ts).toBe('number')

      manager.stop()
    })

    it('stop() 清除持久化的 pos，防止 client 重建后 timeline 为空', () => {
      // 第一次 create：持久化 pos
      const manager1 = new MatrixSyncManager()
      const ss1 = manager1.create(createMockClient(), defaultConfig)
      emitLifecycle(ss1, SlidingSyncState.Complete, makeResp('persisted-pos-456'))

      // 验证 pos 已持久化
      expect(JSON.parse(localStorage.getItem('matrix.sliding_sync.pos')!).pos).toBe('persisted-pos-456')

      // stop() 应清除 pos（client 重建时 room store 会被清空，pos 不再有效）
      manager1.stop()
      expect(localStorage.getItem('matrix.sliding_sync.pos')).toBeNull()
    })

    it('room store 为空时清除持久化 pos，避免空 timeline（4.2.2）', () => {
      // 模拟崩溃/清缓存后重启：pos 仍在 localStorage，但 room store 为空
      // （StubStore 不持久化房间数据）。此时盲目恢复增量 pos 会导致
      // timeline 为空，必须清 pos 强制走全量初始同步。
      localStorage.setItem('matrix.sliding_sync.pos', JSON.stringify({ pos: 'orphan-pos', ts: Date.now() }))

      const proto = SlidingSync.prototype as unknown as { setInitialPos?: (pos: string) => void }
      const hadMethod = typeof proto.setInitialPos === 'function'
      if (!hadMethod) {
        proto.setInitialPos = () => {}
      }
      const setInitialPosSpy = vi.spyOn(proto, 'setInitialPos')

      const emptyClient = { getRooms: () => [] } as unknown as import('matrix-js-sdk').MatrixClient
      const manager = new MatrixSyncManager()
      manager.create(emptyClient, defaultConfig)

      expect(setInitialPosSpy).not.toHaveBeenCalled()
      expect(localStorage.getItem('matrix.sliding_sync.pos')).toBeNull()

      manager.stop()
      setInitialPosSpy.mockRestore()
      if (!hadMethod) {
        delete proto.setInitialPos
      }
    })

    it('room store 有数据时恢复持久化 pos（增量同步）', () => {
      // 模拟 room store 已加载历史房间的短时重启：pos 有效且房间数据在，
      // 此时恢复增量 pos 是安全的。
      localStorage.setItem('matrix.sliding_sync.pos', JSON.stringify({ pos: 'restart-pos-789', ts: Date.now() }))

      const proto = SlidingSync.prototype as unknown as { setInitialPos?: (pos: string) => void }
      const hadMethod = typeof proto.setInitialPos === 'function'
      if (!hadMethod) {
        proto.setInitialPos = () => {}
      }
      const setInitialPosSpy = vi.spyOn(proto, 'setInitialPos')

      const populatedClient = {
        getRooms: () => [{ roomId: '!r:example.com' }]
      } as unknown as import('matrix-js-sdk').MatrixClient
      const manager = new MatrixSyncManager()
      manager.create(populatedClient, defaultConfig)

      expect(setInitialPosSpy).toHaveBeenCalledWith('restart-pos-789')

      manager.stop()
      setInitialPosSpy.mockRestore()
      if (!hadMethod) {
        delete proto.setInitialPos
      }
    })

    it('未调用 stop() 时，新 manager 从 localStorage 恢复 pos', () => {
      // 模拟应用重启场景：pos 已在 localStorage 中，但旧 manager 未调用 stop()
      // （例如进程直接退出）。room store 已加载历史房间，增量恢复是安全的。
      localStorage.setItem('matrix.sliding_sync.pos', JSON.stringify({ pos: 'restart-pos-789', ts: Date.now() }))

      // setInitialPos 可能在 SDK 构建版本中不存在，添加 stub
      const proto = SlidingSync.prototype as unknown as { setInitialPos?: (pos: string) => void }
      const hadMethod = typeof proto.setInitialPos === 'function'
      if (!hadMethod) {
        proto.setInitialPos = () => {}
      }
      const setInitialPosSpy = vi.spyOn(proto, 'setInitialPos')

      const populatedClient = {
        getRooms: () => [{ roomId: '!r:example.com' }]
      } as unknown as import('matrix-js-sdk').MatrixClient
      const manager = new MatrixSyncManager()
      manager.create(populatedClient, defaultConfig)

      expect(setInitialPosSpy).toHaveBeenCalledWith('restart-pos-789')
      manager.stop()
      setInitialPosSpy.mockRestore()
      if (!hadMethod) {
        delete proto.setInitialPos
      }
    })

    it('TTL 24h 过期后 loadPersistedPos 返回 null 并清除 localStorage', () => {
      // 写入一个 25 小时前的 pos
      const expiredTs = Date.now() - 25 * 60 * 60 * 1000 // 25h ago
      localStorage.setItem('matrix.sliding_sync.pos', JSON.stringify({ pos: 'expired-pos', ts: expiredTs }))

      // setInitialPos 可能在 SDK 构建版本中不存在，添加 stub
      const proto = SlidingSync.prototype as unknown as { setInitialPos?: (pos: string) => void }
      const hadMethod = typeof proto.setInitialPos === 'function'
      if (!hadMethod) {
        proto.setInitialPos = () => {}
      }
      const setInitialPosSpy = vi.spyOn(proto, 'setInitialPos')

      const manager = new MatrixSyncManager()
      manager.create(createMockClient(), defaultConfig)

      // 过期的 pos 不应被恢复
      expect(setInitialPosSpy).not.toHaveBeenCalled()
      // localStorage 中的过期 pos 应被清除
      expect(localStorage.getItem('matrix.sliding_sync.pos')).toBeNull()

      manager.stop()
      setInitialPosSpy.mockRestore()
      if (!hadMethod) {
        delete proto.setInitialPos
      }
    })

    it('400 错误触发清除持久化 pos', () => {
      const manager = new MatrixSyncManager()
      const ss = manager.create(createMockClient(), defaultConfig)

      // 先持久化一个 pos
      emitLifecycle(ss, SlidingSyncState.Complete, makeResp('will-be-cleared'))
      expect(localStorage.getItem('matrix.sliding_sync.pos')).not.toBeNull()

      // 模拟 400 错误（session expiry）
      const httpError = new HTTPError('session expired', 400)
      emitLifecycle(ss, SlidingSyncState.RequestFinished, null, httpError)

      // pos 应被清除
      expect(localStorage.getItem('matrix.sliding_sync.pos')).toBeNull()

      manager.stop()
    })

    it('非 400 错误不清除持久化 pos', () => {
      const manager = new MatrixSyncManager()
      const ss = manager.create(createMockClient(), defaultConfig)

      // 先持久化一个 pos
      emitLifecycle(ss, SlidingSyncState.Complete, makeResp('keep-me'))
      expect(localStorage.getItem('matrix.sliding_sync.pos')).not.toBeNull()

      // 模拟 500 错误（不应清除 pos）
      const httpError = new HTTPError('server error', 500)
      emitLifecycle(ss, SlidingSyncState.RequestFinished, null, httpError)

      // pos 应保留
      expect(localStorage.getItem('matrix.sliding_sync.pos')).not.toBeNull()

      manager.stop()
    })

    it('stop 后 pos 持久化监听器被移除（不再持久化）', () => {
      const manager = new MatrixSyncManager()
      const ss = manager.create(createMockClient(), defaultConfig)
      manager.stop()

      // stop 后再 emit Complete 事件，不应持久化
      emitLifecycle(ss, SlidingSyncState.Complete, makeResp('after-stop'))
      expect(localStorage.getItem('matrix.sliding_sync.pos')).toBeNull()
    })

    it('clearPersistedPos 手动清除 localStorage 中的 pos', () => {
      localStorage.setItem('matrix.sliding_sync.pos', JSON.stringify({ pos: 'manual-clear', ts: Date.now() }))

      const manager = new MatrixSyncManager()
      manager.clearPersistedPos()

      expect(localStorage.getItem('matrix.sliding_sync.pos')).toBeNull()
    })

    it('无 pos 的 Complete 事件不触发持久化', () => {
      const manager = new MatrixSyncManager()
      const ss = manager.create(createMockClient(), defaultConfig)

      // Complete 事件但 resp 无 pos 字段
      const respWithoutPos = { lists: {}, rooms: {}, extensions: {} } as MSC3575SlidingSyncResponse
      emitLifecycle(ss, SlidingSyncState.Complete, respWithoutPos)
      expect(localStorage.getItem('matrix.sliding_sync.pos')).toBeNull()

      manager.stop()
    })
  })

  describe('multi-list subscription (§9.2)', () => {
    it('registers a friends list filtered by im.hula.friend_list room type', () => {
      const manager = new MatrixSyncManager()
      const ss = manager.create(createMockClient(), defaultConfig)

      const params = ss.getListParams('friends')
      expect(params).not.toBeNull()
      expect(params?.filters?.room_types).toEqual(['im.hula.friend_list'])
    })

    it('registers a spaces list filtered by m.space room type', () => {
      const manager = new MatrixSyncManager()
      const ss = manager.create(createMockClient(), defaultConfig)

      const params = ss.getListParams('spaces')
      expect(params).not.toBeNull()
      expect(params?.filters?.room_types).toEqual(['m.space'])
    })

    it('registers a dms list filtered by is_dm=true', () => {
      const manager = new MatrixSyncManager()
      const ss = manager.create(createMockClient(), defaultConfig)

      const params = ss.getListParams('dms')
      expect(params).not.toBeNull()
      expect(params?.filters?.is_dm).toBe(true)
    })

    it('uses timeline_limit: 1 on extension lists to reduce first-screen load', () => {
      const manager = new MatrixSyncManager()
      const ss = manager.create(createMockClient(), defaultConfig)

      for (const key of ['friends', 'spaces', 'dms']) {
        const params = ss.getListParams(key)
        expect(params?.timeline_limit).toBe(1)
      }
    })
  })
})

describe('R-17b: error logging', () => {
  const createMockClient = () => ({}) as unknown as import('matrix-js-sdk').MatrixClient

  const defaultConfig: MatrixClientConfig = {
    homeserverUrl: 'https://matrix.test'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('logs a warning when loadPersistedPos throws and returns null', () => {
    // Put corrupted JSON in localStorage to trigger JSON.parse error
    localStorage.setItem('matrix.sliding_sync.pos', '{invalid json')

    // Stub setInitialPos (may not exist in SDK build)
    const proto = SlidingSync.prototype as unknown as { setInitialPos?: (pos: string) => void }
    const hadMethod = typeof proto.setInitialPos === 'function'
    if (!hadMethod) {
      proto.setInitialPos = () => {}
    }
    const setInitialPosSpy = vi.spyOn(proto, 'setInitialPos')

    const manager = new MatrixSyncManager()
    manager.create(createMockClient(), defaultConfig)

    // Corrupted data should not be restored
    expect(setInitialPosSpy).not.toHaveBeenCalled()
    // R-17b: logger should have been called
    expect(loggerSpy.warn).toHaveBeenCalledWith('getPersistedPos failed:', expect.any(Error))

    manager.stop()
    setInitialPosSpy.mockRestore()
    if (!hadMethod) {
      delete proto.setInitialPos
    }
  })
})
