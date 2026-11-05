import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatrixClient } from '@/services/matrix/sdk'
import type { MatrixClientConfig } from '../MatrixClientService'
import { MatrixSyncManager } from '../MatrixSyncManager'

/**
 * 滑窗房间订阅（F-11）。
 *
 * ## 为什么必须订阅
 *
 * 服务端只在 `pos` 缺省（首次同步）**或订阅集合变化**时给房间 `initial: true`；
 * 而 `SlidingSyncSdk.onRoomData` 对 store 里没有的房间，`initial` 不为真就直接 return。
 * 所以「同步过程中新建 / 新加入的房间」若不订阅，永远进不了 store ——
 * 表现为 `createRoom` 后 5s 拿不到实例、打开房间也拿不到 timeline。
 *
 * ## 这组用例锁的是什么
 *
 * 1. `subscribeRoom` 真的把房间推给 SDK（不是只改内部状态）；
 * 2. 幂等 + LRU 上限（请求体不随使用时长无限增长）；
 * 3. **活跃房间永不淘汰**（淘汰会导致正在看的房间丢 timeline）；
 * 4. `create()` 重建实例后**重放订阅**（forceReconnect / 重新登录场景）；
 * 5. `stop()` 清空（换账号不能带着上一个账号的 roomId）。
 */

const fakeClient = {} as MatrixClient
const baseConfig = { homeserverUrl: 'https://hs.example.com' } as MatrixClientConfig

const makeManager = (): { manager: MatrixSyncManager; sync: ReturnType<MatrixSyncManager['create']> } => {
  const manager = new MatrixSyncManager()
  const sync = manager.create(fakeClient, baseConfig)
  return { manager, sync }
}

/** 取最近一次推给 SDK 的订阅集合 */
const lastPushed = (spy: { mock: { calls: unknown[][] } }): Set<string> => {
  const calls = spy.mock.calls
  const last = calls[calls.length - 1]?.[0]
  return last instanceof Set ? (last as Set<string>) : new Set<string>()
}

beforeEach(() => {
  localStorage.clear()
})

describe('MatrixSyncManager 房间订阅', () => {
  it('subscribeRoom 把房间推给 SDK', () => {
    const { manager, sync } = makeManager()
    const spy = vi.spyOn(sync, 'modifyRoomSubscriptions')

    manager.subscribeRoom('!a:hs')

    expect(spy).toHaveBeenCalled()
    expect(lastPushed(spy)).toEqual(new Set(['!a:hs']))
  })

  it('重复订阅幂等（集合不变，仍会推送一次以刷新 LRU 位置）', () => {
    const { manager, sync } = makeManager()
    const spy = vi.spyOn(sync, 'modifyRoomSubscriptions')

    manager.subscribeRoom('!a:hs')
    manager.subscribeRoom('!a:hs')

    expect(lastPushed(spy)).toEqual(new Set(['!a:hs']))
  })

  it('空/空白 roomId 被忽略（不产生无意义请求）', () => {
    const { manager, sync } = makeManager()
    const spy = vi.spyOn(sync, 'modifyRoomSubscriptions')
    spy.mockClear()

    manager.subscribeRoom('')
    manager.subscribeRoom('   ')

    expect(spy).not.toHaveBeenCalled()
  })

  it('超过上限时按 LRU 淘汰最旧，集合稳定在 16', () => {
    const { manager, sync } = makeManager()
    const spy = vi.spyOn(sync, 'modifyRoomSubscriptions')

    for (let index = 0; index < 20; index++) {
      manager.subscribeRoom(`!r${index}:hs`)
    }

    const pushed = lastPushed(spy)
    expect(pushed.size).toBe(16)
    expect(pushed.has('!r0:hs')).toBe(false) // 最旧的被淘汰
    expect(pushed.has('!r19:hs')).toBe(true) // 最新的一定在
  })

  it('活跃房间不被 LRU 淘汰', () => {
    const { manager, sync } = makeManager()
    const spy = vi.spyOn(sync, 'modifyRoomSubscriptions')

    manager.setActiveRoom('!active:hs')
    for (let index = 0; index < 20; index++) {
      manager.subscribeRoom(`!r${index}:hs`)
    }

    expect(lastPushed(spy).has('!active:hs')).toBe(true)
  })

  it('setActiveRoom 订阅该房间；同值重复调用不再推送', () => {
    const { manager, sync } = makeManager()
    const spy = vi.spyOn(sync, 'modifyRoomSubscriptions')

    manager.setActiveRoom('!a:hs')
    expect(lastPushed(spy)).toContain('!a:hs')

    const countAfterFirst = spy.mock.calls.length
    manager.setActiveRoom('!a:hs')
    expect(spy.mock.calls.length).toBe(countAfterFirst)
  })

  it('setActiveRoom(null) 只取消「活跃」标记，不清空其它订阅', () => {
    const { manager, sync } = makeManager()
    const spy = vi.spyOn(sync, 'modifyRoomSubscriptions')

    manager.subscribeRoom('!keep:hs')
    manager.setActiveRoom('!active:hs')
    manager.setActiveRoom(null)

    expect(lastPushed(spy)).toEqual(new Set(['!keep:hs', '!active:hs']))
  })

  it('create() 重建实例时会重放已有订阅（forceReconnect / 重新登录）', () => {
    const { manager } = makeManager()
    manager.subscribeRoom('!a:hs')

    // 模拟实例重建：create() 内部 new SlidingSync 并 pushRoomSubscriptions()
    const second = manager.create(fakeClient, baseConfig)
    const spy = vi.spyOn(second, 'modifyRoomSubscriptions')

    // create() 已经把订阅推给新实例，这里再触发一次确认集合内容
    manager.subscribeRoom('!b:hs')

    expect(lastPushed(spy)).toEqual(new Set(['!a:hs', '!b:hs']))
  })

  it('stop() 清空订阅（换账号不带着上一个账号的 roomId）', () => {
    const { manager } = makeManager()
    manager.subscribeRoom('!a:hs')
    manager.setActiveRoom('!a:hs')
    manager.stop()

    const next = manager.create(fakeClient, baseConfig)
    const spy = vi.spyOn(next, 'modifyRoomSubscriptions')
    manager.subscribeRoom('!b:hs')

    expect(lastPushed(spy)).toEqual(new Set(['!b:hs']))
  })

  it('实例不存在时 subscribeRoom 不抛错（登录前的早调用）', () => {
    const manager = new MatrixSyncManager()

    expect(() => manager.subscribeRoom('!a:hs')).not.toThrow()
    expect(() => manager.setActiveRoom('!a:hs')).not.toThrow()
  })
})
