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

    it('create() 使用 wifi 预设创建 SlidingSync（无 navigator.connection）', () => {
      setMockConnection(null)
      const manager = new MatrixSyncManager()
      manager.create(createMockClient(), defaultConfig)

      // 验证 manager 记录了正确的 networkType
      expect(manager.getCurrentNetworkType()).toBe('wifi')
      manager.stop()
    })

    it('create() 在 4g 网络下使用 4g 预设', () => {
      setMockConnection({ effectiveType: '4g' })
      const manager = new MatrixSyncManager()
      manager.create(createMockClient(), defaultConfig)

      expect(manager.getCurrentNetworkType()).toBe('4g')
      manager.stop()
    })

    it('create() 在 slow-2g 网络下使用 slow-2g 预设', () => {
      setMockConnection({ effectiveType: 'slow-2g' })
      const manager = new MatrixSyncManager()
      manager.create(createMockClient(), defaultConfig)

      expect(manager.getCurrentNetworkType()).toBe('slow-2g')
      manager.stop()
    })

    it('config 中的显式值优先于网络预设', () => {
      setMockConnection({ effectiveType: 'slow-2g' }) // 预设 roomRangeEnd=9
      const manager = new MatrixSyncManager()
      const customConfig: MatrixClientConfig = {
        homeserverUrl: 'https://matrix.test',
        slidingSync: { roomRangeEnd: 100, timelineLimit: 20, pollTimeout: 60000 }
      }
      // 显式配置不应被预设覆盖，create() 应成功
      expect(() => manager.create(createMockClient(), customConfig)).not.toThrow()
      expect(manager.getCurrentNetworkType()).toBe('slow-2g') // 网络类型仍被记录
      manager.stop()
    })

    it('adaptToNetwork: 网络变化时更新 currentNetworkType', () => {
      setMockConnection({ effectiveType: 'wifi' })
      const manager = new MatrixSyncManager()
      manager.create(createMockClient(), defaultConfig)
      expect(manager.getCurrentNetworkType()).toBe('wifi')

      // 模拟网络降级到 3g
      setMockConnection({ effectiveType: '3g' })
      manager.adaptToNetwork()
      expect(manager.getCurrentNetworkType()).toBe('3g')

      manager.stop()
    })

    it('adaptToNetwork: 网络类型不变时不更新', () => {
      setMockConnection({ effectiveType: '4g' })
      const manager = new MatrixSyncManager()
      manager.create(createMockClient(), defaultConfig)
      const initialType = manager.getCurrentNetworkType()

      manager.adaptToNetwork() // 网络类型未变
      expect(manager.getCurrentNetworkType()).toBe(initialType)

      manager.stop()
    })

    it('stop 后 currentNetworkType 被清除', () => {
      setMockConnection({ effectiveType: '4g' })
      const manager = new MatrixSyncManager()
      manager.create(createMockClient(), defaultConfig)
      expect(manager.getCurrentNetworkType()).toBe('4g')

      manager.stop()
      expect(manager.getCurrentNetworkType()).toBeNull()
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

    it('网络变化触发 adaptToNetwork 被调用', () => {
      const listeners: Array<() => void> = []
      setMockConnection({
        effectiveType: 'wifi',
        addEventListener: (_type: string, handler: () => void) => listeners.push(handler),
        removeEventListener: vi.fn()
      })

      const manager = new MatrixSyncManager()
      manager.create(createMockClient(), defaultConfig)
      expect(manager.getCurrentNetworkType()).toBe('wifi')

      // 模拟网络降级到 3g
      setMockConnection({ effectiveType: '3g' })

      // 触发 'change' 事件
      for (const listener of listeners) {
        listener()
      }

      expect(manager.getCurrentNetworkType()).toBe('3g')
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

    it('重启后从 localStorage 恢复 pos 并设置到 SlidingSync 实例', () => {
      // 第一次 create：持久化 pos
      const manager1 = new MatrixSyncManager()
      const ss1 = manager1.create(createMockClient(), defaultConfig)
      emitLifecycle(ss1, SlidingSyncState.Complete, makeResp('persisted-pos-456'))
      manager1.stop()

      // 验证 pos 已持久化
      expect(JSON.parse(localStorage.getItem('matrix.sliding_sync.pos')!).pos).toBe('persisted-pos-456')

      // 第二次 create：应恢复 pos
      // setInitialPos 可能在 SDK 构建版本中不存在，添加 stub
      const proto = SlidingSync.prototype as unknown as { setInitialPos?: (pos: string) => void }
      const hadMethod = typeof proto.setInitialPos === 'function'
      if (!hadMethod) {
        proto.setInitialPos = () => {}
      }
      const setInitialPosSpy = vi.spyOn(proto, 'setInitialPos')

      const manager2 = new MatrixSyncManager()
      manager2.create(createMockClient(), defaultConfig)

      expect(setInitialPosSpy).toHaveBeenCalledWith('persisted-pos-456')
      manager2.stop()
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

  describe('连接质量监控（OPT-9 深化）', () => {
    /**
     * 步骤 4.2 OPT-9 测试：验证 MatrixSyncManager 的错误统计、延迟监控、成功率计算。
     *
     * 设计原则（codebase-design）：
     * - 深模块：3 个公有方法（getErrorStats/getSyncLatency/getSuccessRate）隐藏滑动窗口实现
     * - 接受依赖：通过 SlidingSync Lifecycle 事件自动采集，无需调用方传入数据
     * - 返回结果：所有方法返回快照对象/数字，不产生副作用
     */
    beforeEach(() => {
      localStorage.clear()
    })

    afterEach(() => {
      localStorage.clear()
    })

    function emitLifecycle(
      ss: import('matrix-js-sdk').SlidingSync,
      state: SlidingSyncState,
      resp: unknown,
      err?: Error
    ): void {
      ;(ss.emit as (event: string, ...args: unknown[]) => void)(SlidingSyncEvent.Lifecycle, state, resp, err)
    }

    it('getErrorStats: 初始状态返回全零', () => {
      const manager = new MatrixSyncManager()
      manager.create(createMockClient(), defaultConfig)

      const stats = manager.getErrorStats()
      expect(stats).toEqual({
        consecutiveErrors: 0,
        totalErrors: 0,
        totalRequests: 0,
        lastErrorTime: null
      })

      manager.stop()
    })

    it('getErrorStats: RequestFinished 错误递增 consecutiveErrors 和 totalErrors', () => {
      const manager = new MatrixSyncManager()
      const ss = manager.create(createMockClient(), defaultConfig)

      emitLifecycle(ss, SlidingSyncState.RequestFinished, null, new Error('network error'))

      const stats = manager.getErrorStats()
      expect(stats.consecutiveErrors).toBe(1)
      expect(stats.totalErrors).toBe(1)
      expect(stats.totalRequests).toBe(1)
      expect(stats.lastErrorTime).not.toBeNull()

      manager.stop()
    })

    it('getErrorStats: 连续错误递增 consecutiveErrors', () => {
      const manager = new MatrixSyncManager()
      const ss = manager.create(createMockClient(), defaultConfig)

      emitLifecycle(ss, SlidingSyncState.RequestFinished, null, new Error('err1'))
      emitLifecycle(ss, SlidingSyncState.RequestFinished, null, new Error('err2'))
      emitLifecycle(ss, SlidingSyncState.RequestFinished, null, new Error('err3'))

      const stats = manager.getErrorStats()
      expect(stats.consecutiveErrors).toBe(3)
      expect(stats.totalErrors).toBe(3)
      expect(stats.totalRequests).toBe(3)

      manager.stop()
    })

    it('getErrorStats: 成功的 Complete 事件重置 consecutiveErrors', () => {
      const manager = new MatrixSyncManager()
      const ss = manager.create(createMockClient(), defaultConfig)

      emitLifecycle(ss, SlidingSyncState.RequestFinished, null, new Error('err'))
      emitLifecycle(ss, SlidingSyncState.RequestFinished, null, new Error('err'))
      expect(manager.getErrorStats().consecutiveErrors).toBe(2)

      // 成功响应
      emitLifecycle(ss, SlidingSyncState.Complete, { pos: 'p1' }, undefined)

      const stats = manager.getErrorStats()
      expect(stats.consecutiveErrors).toBe(0)
      expect(stats.totalErrors).toBe(2) // 总错误数不重置
      expect(stats.totalRequests).toBe(3) // 2 错误 + 1 成功

      manager.stop()
    })

    it('getSyncLatency: 无 Complete 事件时返回 0', () => {
      const manager = new MatrixSyncManager()
      manager.create(createMockClient(), defaultConfig)

      expect(manager.getSyncLatency()).toBe(0)

      manager.stop()
    })

    it('getSyncLatency: 单次 Complete 事件后返回 0（需要至少 2 次才能计算间隔）', () => {
      const manager = new MatrixSyncManager()
      const ss = manager.create(createMockClient(), defaultConfig)

      emitLifecycle(ss, SlidingSyncState.Complete, { pos: 'p1' }, undefined)

      expect(manager.getSyncLatency()).toBe(0)

      manager.stop()
    })

    it('getSyncLatency: 两次 Complete 事件后返回间隔时间', async () => {
      const manager = new MatrixSyncManager()
      const ss = manager.create(createMockClient(), defaultConfig)

      emitLifecycle(ss, SlidingSyncState.Complete, { pos: 'p1' }, undefined)
      // 等待一小段时间确保时间戳不同
      await new Promise((resolve) => setTimeout(resolve, 50))
      emitLifecycle(ss, SlidingSyncState.Complete, { pos: 'p2' }, undefined)

      const latency = manager.getSyncLatency()
      // 延迟应大于 0（至少 50ms 的间隔）
      expect(latency).toBeGreaterThan(0)
      // 上限检查（避免假阳性）
      expect(latency).toBeLessThan(5000)

      manager.stop()
    })

    it('getSyncLatency: 滑动窗口只保留最近 10 次延迟样本', async () => {
      const manager = new MatrixSyncManager()
      const ss = manager.create(createMockClient(), defaultConfig)

      // 发出 12 次 Complete 事件
      for (let i = 0; i < 12; i++) {
        emitLifecycle(ss, SlidingSyncState.Complete, { pos: `p${i}` }, undefined)
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      // 延迟应基于最近 10 次样本，不是全部 12 次
      const latency = manager.getSyncLatency()
      expect(latency).toBeGreaterThan(0)
      expect(latency).toBeLessThan(1000)

      manager.stop()
    })

    it('getSuccessRate: 无请求时返回 1（无失败）', () => {
      const manager = new MatrixSyncManager()
      manager.create(createMockClient(), defaultConfig)

      expect(manager.getSuccessRate()).toBe(1)

      manager.stop()
    })

    it('getSuccessRate: 全部成功时返回 1', () => {
      const manager = new MatrixSyncManager()
      const ss = manager.create(createMockClient(), defaultConfig)

      emitLifecycle(ss, SlidingSyncState.Complete, { pos: 'p1' }, undefined)
      emitLifecycle(ss, SlidingSyncState.Complete, { pos: 'p2' }, undefined)

      expect(manager.getSuccessRate()).toBe(1)

      manager.stop()
    })

    it('getSuccessRate: 全部失败时返回 0', () => {
      const manager = new MatrixSyncManager()
      const ss = manager.create(createMockClient(), defaultConfig)

      emitLifecycle(ss, SlidingSyncState.RequestFinished, null, new Error('err'))
      emitLifecycle(ss, SlidingSyncState.RequestFinished, null, new Error('err'))

      expect(manager.getSuccessRate()).toBe(0)

      manager.stop()
    })

    it('getSuccessRate: 混合成功/失败时返回正确比率', () => {
      const manager = new MatrixSyncManager()
      const ss = manager.create(createMockClient(), defaultConfig)

      // 3 成功 + 1 失败 = 75%
      emitLifecycle(ss, SlidingSyncState.Complete, { pos: 'p1' }, undefined)
      emitLifecycle(ss, SlidingSyncState.Complete, { pos: 'p2' }, undefined)
      emitLifecycle(ss, SlidingSyncState.Complete, { pos: 'p3' }, undefined)
      emitLifecycle(ss, SlidingSyncState.RequestFinished, null, new Error('err'))

      expect(manager.getSuccessRate()).toBe(0.75)

      manager.stop()
    })

    it('getSuccessRate: 滑动窗口只统计最近 100 次请求', () => {
      const manager = new MatrixSyncManager()
      const ss = manager.create(createMockClient(), defaultConfig)

      // 60 次失败（窗口只保留最近 100 次，前 10 次会被驱逐）
      for (let i = 0; i < 60; i++) {
        emitLifecycle(ss, SlidingSyncState.RequestFinished, null, new Error('err'))
      }
      // 40 次成功（窗口内：50 失败 + 40 成功 = 90，但窗口容量 100，所以全部保留）
      for (let i = 0; i < 40; i++) {
        emitLifecycle(ss, SlidingSyncState.Complete, { pos: `p${i}` }, undefined)
      }

      // 总共 100 次请求，窗口保留全部：60 失败 + 40 成功 = 40%
      expect(manager.getSuccessRate()).toBe(0.4)

      // 再加 10 次成功，窗口驱逐前 10 次失败
      for (let i = 0; i < 10; i++) {
        emitLifecycle(ss, SlidingSyncState.Complete, { pos: `p${i}` }, undefined)
      }
      // 窗口内：50 失败 + 50 成功 = 50%
      expect(manager.getSuccessRate()).toBe(0.5)

      manager.stop()
    })

    it('stop 后质量统计被重置', () => {
      const manager = new MatrixSyncManager()
      const ss = manager.create(createMockClient(), defaultConfig)

      emitLifecycle(ss, SlidingSyncState.RequestFinished, null, new Error('err'))
      emitLifecycle(ss, SlidingSyncState.Complete, { pos: 'p1' }, undefined)
      expect(manager.getErrorStats().totalRequests).toBe(2)

      manager.stop()
      // 清除 localStorage 中持久化的 pos，避免第二次 create() 调用 setInitialPos
      localStorage.clear()

      // 重新创建后统计应重置
      manager.create(createMockClient(), defaultConfig)
      expect(manager.getErrorStats()).toEqual({
        consecutiveErrors: 0,
        totalErrors: 0,
        totalRequests: 0,
        lastErrorTime: null
      })

      manager.stop()
    })
  })
})
