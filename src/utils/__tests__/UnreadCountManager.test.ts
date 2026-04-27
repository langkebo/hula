import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: { getByLabel: vi.fn().mockResolvedValue(null) }
}))
vi.mock('@/utils/PlatformConstants', () => ({
  isMac: () => false,
  isIOS: () => false
}))
vi.mock('@vueuse/core', () => ({
  useDebounceFn: (fn: (...args: unknown[]) => unknown) => fn
}))

import { NotificationTypeEnum } from '@/enums'
import { UnreadCountManager } from '../UnreadCountManager'

const session = (unreadCount: number, muted = false): any => ({
  unreadCount,
  muteNotification: muted ? NotificationTypeEnum.NOT_DISTURB : undefined
})

describe('UnreadCountManager', () => {
  let mgr: UnreadCountManager

  beforeEach(() => {
    mgr = new UnreadCountManager()
  })

  it('calculateTotal sums non-muted unread counts', () => {
    const mark = { newFriendUnreadCount: 0, newGroupUnreadCount: 0, newMsgUnreadCount: 0 }
    mgr.calculateTotal([session(3), session(5), session(2)], mark)
    expect(mark.newMsgUnreadCount).toBe(10)
  })

  it('calculateTotal ignores muted sessions', () => {
    const mark = { newFriendUnreadCount: 0, newGroupUnreadCount: 0, newMsgUnreadCount: 0 }
    mgr.calculateTotal([session(3), session(5, true)], mark)
    expect(mark.newMsgUnreadCount).toBe(3)
  })

  it('calculateTotal clamps negative unread counts to zero', () => {
    const mark = { newFriendUnreadCount: 0, newGroupUnreadCount: 0, newMsgUnreadCount: 0 }
    mgr.calculateTotal([session(-5), session(2)], mark)
    expect(mark.newMsgUnreadCount).toBe(2)
  })

  it('calculateTotal handles empty session list', () => {
    const mark = { newFriendUnreadCount: 0, newGroupUnreadCount: 0, newMsgUnreadCount: 0 }
    mgr.calculateTotal([], mark)
    expect(mark.newMsgUnreadCount).toBe(0)
  })

  it('calculateTotal handles undefined unreadCount as zero', () => {
    const mark = { newFriendUnreadCount: 0, newGroupUnreadCount: 0, newMsgUnreadCount: 0 }
    mgr.calculateTotal([{ unreadCount: undefined } as any], mark)
    expect(mark.newMsgUnreadCount).toBe(0)
  })

  it('requestUpdate triggers update callback (debounce mocked)', () => {
    const cb = vi.fn()
    mgr.setUpdateCallback(cb)
    mgr.requestUpdate('s1')
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('requestUpdate without session id queues a global update', () => {
    const cb = vi.fn()
    mgr.setUpdateCallback(cb)
    mgr.requestUpdate()
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('setTipVisibleCallback fires true when there is unread, false otherwise', async () => {
    const setTip = vi.fn()
    mgr.setTipVisibleCallback(setTip)
    await mgr.refreshBadge({ newFriendUnreadCount: 0, newGroupUnreadCount: 0, newMsgUnreadCount: 5 })
    expect(setTip).toHaveBeenLastCalledWith(true)
    await mgr.refreshBadge({ newFriendUnreadCount: 0, newGroupUnreadCount: 0, newMsgUnreadCount: 0 })
    expect(setTip).toHaveBeenLastCalledWith(false)
  })

  it('destroy clears pending updates', () => {
    mgr.requestUpdate('a')
    mgr.destroy()
    expect(() => mgr.destroy()).not.toThrow()
  })
})
