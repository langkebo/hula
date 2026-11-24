import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionItem } from '@/stores/domains/chat/chat'
import { invokeSilently } from '@/utils/TauriInvokeHandler'
import { UnreadCountManager } from '../UnreadCountManager'

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: { getByLabel: vi.fn().mockResolvedValue(null) }
}))
vi.mock('@/utils/PlatformConstants', () => ({
  isMac: () => false,
  isIOS: () => true
}))
vi.mock('@/utils/TauriInvokeHandler', () => ({
  invokeSilently: vi.fn().mockResolvedValue(null)
}))
vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() })
}))

const invokeMock = vi.mocked(invokeSilently)

const session = (unreadCount: number): SessionItem => ({ unreadCount }) as unknown as SessionItem

const mark = () => ({ newFriendUnreadCount: 0, newGroupUnreadCount: 0, newMsgUnreadCount: 0 })

/**
 * D2 验收场景：1 秒内约 1000 次未读变化。
 * 前端层验证防抖合并与「最终值正确」，原生层的 os_unfair_lock 合并由 BadgeBridge 负责。
 */
describe('UnreadCountManager 高频角标更新（D2）', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    invokeMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('requestUpdate 1 秒内调用 1000 次时，回调被防抖合并（每次 60ms 窗口最多一次）', () => {
    const mgr = new UnreadCountManager()
    const cb = vi.fn()
    mgr.setUpdateCallback(cb)

    for (let i = 0; i < 1000; i++) {
      mgr.requestUpdate(`session-${i}`)
      vi.advanceTimersByTime(1)
    }
    vi.advanceTimersByTime(60)

    expect(cb.mock.calls.length).toBeGreaterThan(0)
    expect(cb.mock.calls.length).toBeLessThanOrEqual(20)
  })

  it('1 秒内 1000 次 calculateTotal：最终角标写入值与最终未读数一致', async () => {
    const mgr = new UnreadCountManager()

    for (let i = 1; i <= 1000; i++) {
      mgr.calculateTotal([session(i)], mark())
      vi.advanceTimersByTime(1)
    }
    await vi.runAllTimersAsync()

    expect(invokeMock).toHaveBeenCalledTimes(1000)
    expect(invokeMock).toHaveBeenLastCalledWith('set_ios_badge', { count: 1000 })

    const counts = invokeMock.mock.calls.map(([, args]) => (args as { count?: number }).count)
    expect(counts.every((count) => (count ?? 0) > 0)).toBe(true)
    expect(counts[counts.length - 1]).toBe(1000)
  })

  it('未读数归零时写入 null，避免残留角标', async () => {
    const mgr = new UnreadCountManager()
    mgr.calculateTotal([session(42)], mark())
    mgr.calculateTotal([], mark())
    await vi.runAllTimersAsync()

    expect(invokeMock).toHaveBeenLastCalledWith('set_ios_badge', { count: null })
  })

  it('原生写入失败不会产生未处理的 Promise rejection', async () => {
    invokeMock.mockRejectedValueOnce(new Error('ipc unavailable'))
    const mgr = new UnreadCountManager()

    expect(() => mgr.calculateTotal([session(3)], mark())).not.toThrow()
    await vi.runAllTimersAsync()
    await Promise.resolve()

    expect(invokeMock).toHaveBeenCalledTimes(1)
  })
})
