import { EventEmitter } from 'events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MatrixEventRouter } from '@/services/matrix/MatrixEventRouter'

/**
 * N-4 反馈循环：MatrixClient 的 EventEmitter 监听器累积超过默认上限 10。
 *
 * 根因分析（统计所有 client.on 调用）：
 * - MatrixEventRouter.setup(): 7 个 (sync/room/room_timeline/Event.redaction/Event.decrypted/Room.typing/Room.receipt)
 * - MatrixVoIPService.setup(): 3 个 (Call.incoming/Call.hangup/Call.replaced)
 * - MatrixPushService.setup(): 1 个 (pushRules)
 * - MatrixPresenceService.setup(): 1 个 (User.presence)
 * - MatrixSpecialFriendService.setup(): 1 个 (accountData)
 * 总计 13 个监听器，超过 EventEmitter 默认 maxListeners=10，触发 MaxListenersExceededWarning。
 *
 * MatrixEventRouter 已对 Room/RoomState 设置 setMaxListeners(50)（MatrixEventRouter.ts:104-105），
 * 但未对 client 设置。修复：在 setup() 中对 client 也设置 setMaxListeners。
 */
describe('MatrixEventRouter — N-4 client EventEmitter maxListeners', () => {
  let router: MatrixEventRouter
  let client: EventEmitter
  let syncManager: { onLifecycleEvent: () => void; offLifecycleEvent: () => void }
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    router = new MatrixEventRouter()
    client = new EventEmitter()
    // 默认 maxListeners=10，模拟 SDK MatrixClient 默认行为
    client.setMaxListeners(10)
    syncManager = {
      onLifecycleEvent: vi.fn(),
      offLifecycleEvent: vi.fn()
    }
    // spy console.warn 捕获 MaxListenersExceededWarning
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    router.detach(client as never, syncManager as never)
    warnSpy.mockRestore()
  })

  it('setup() 应对 client 设置 setMaxListeners(50)', () => {
    router.setup(client as never, syncManager as never)

    // 验证 client 的 maxListeners 被设置为 50（与 Room/RoomState 一致）
    expect(client.getMaxListeners()).toBe(50)
  })

  it('设置 maxListeners 后，13 个监听器不触发 MaxListenersExceededWarning', () => {
    router.setup(client as never, syncManager as never)
    // 清除 setup 调用中可能的 warn
    warnSpy.mockClear()

    // 再添加 6 个监听器（模拟其他 service）
    for (let i = 0; i < 6; i++) {
      client.on('dummy.event', () => {})
    }

    // 不应有 MaxListenersExceededWarning
    const maxListenersWarnings = warnSpy.mock.calls.filter((call: unknown[]) => {
      const arg = call[0]
      return typeof arg === 'string' && arg.includes('MaxListenersExceededWarning')
    })
    expect(maxListenersWarnings).toHaveLength(0)
  })

  it('setup() 多次调用（重复初始化场景）仍保持 maxListeners=50', () => {
    // 第一次 setup
    router.setup(client as never, syncManager as never)
    expect(client.getMaxListeners()).toBe(50)

    // 模拟重新初始化：先 detach 再 setup
    router.detach(client as never, syncManager as never)
    // detach 不应重置 maxListeners（避免反复设置）

    router.setup(client as never, syncManager as never)
    expect(client.getMaxListeners()).toBe(50)
  })

  it('detach 后重新 setup 新 client 也应设置 maxListeners', () => {
    const client2 = new EventEmitter()
    client2.setMaxListeners(10)

    router.setup(client as never, syncManager as never)
    router.setup(client2 as never, syncManager as never) // 内部会先 detach 旧 client

    expect(client2.getMaxListeners()).toBe(50)
  })
})
