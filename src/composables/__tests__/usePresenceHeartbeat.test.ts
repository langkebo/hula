/**
 * usePresenceHeartbeat 单元测试
 *
 * 覆盖点:
 * - start 后固定间隔调 setPresence('online')
 * - 用户活动事件触发节流刷新, 不会每次事件都上报
 * - start 会把本地 userInfo.activeStatus 同步为 ONLINE
 * - stop 后定时器/监听器全部卸载
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { OnlineEnum } from '@/enums'

const setPresenceMock = vi.fn<(state: string) => Promise<void>>(() => Promise.resolve())

vi.mock('@tauri-apps/plugin-log', () => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn()
}))

vi.mock('@/services/matrix/user/MatrixPresenceService', () => ({
  matrixPresenceService: {
    setPresence: (state: string) => setPresenceMock(state)
  }
}))

// pushOnline 会先检查 matrixClientService.getClient()，未 mock 时会直接 return
vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: () => ({ getUserId: () => '@user:server.com' })
  }
}))

const userStoreMock = reactive<{ userInfo: { activeStatus?: OnlineEnum; lastOptTime?: number } }>({
  userInfo: { activeStatus: OnlineEnum.OFFLINE, lastOptTime: 0 }
})
vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => userStoreMock
}))

import { startPresenceHeartbeat, stopPresenceHeartbeat } from '@/composables/user/usePresenceHeartbeat'

// 让 pushOnline 的内部 microtask 跑完, 但不触发任何定时器前进
const flushMicro = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

describe('usePresenceHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setPresenceMock.mockClear()
    userStoreMock.userInfo.activeStatus = OnlineEnum.OFFLINE
    userStoreMock.userInfo.lastOptTime = 0
  })

  afterEach(() => {
    stopPresenceHeartbeat()
    vi.useRealTimers()
  })

  it('定时器到期时调用 setPresence(online) 并回写本地 userStore', async () => {
    startPresenceHeartbeat()
    vi.advanceTimersByTime(4 * 60 * 1000)
    await flushMicro()

    expect(setPresenceMock).toHaveBeenCalledTimes(1)
    expect(setPresenceMock).toHaveBeenCalledWith('online')
    expect(userStoreMock.userInfo.activeStatus).toBe(OnlineEnum.ONLINE)
    expect(userStoreMock.userInfo.lastOptTime).toBeGreaterThan(0)
  })

  it('用户活动事件节流: 60 秒内多次事件只上报一次, 超阈值后可再次上报', async () => {
    startPresenceHeartbeat()

    window.dispatchEvent(new Event('mousemove'))
    window.dispatchEvent(new Event('mousedown'))
    window.dispatchEvent(new Event('keydown'))
    await flushMicro()
    expect(setPresenceMock).toHaveBeenCalledTimes(1)

    // 30 秒后的再次 mousemove 仍被节流
    vi.advanceTimersByTime(30 * 1000)
    window.dispatchEvent(new Event('mousemove'))
    await flushMicro()
    expect(setPresenceMock).toHaveBeenCalledTimes(1)

    // 超过 60 秒阈值后可再次上报
    vi.advanceTimersByTime(31 * 1000)
    window.dispatchEvent(new Event('mousemove'))
    await flushMicro()
    expect(setPresenceMock).toHaveBeenCalledTimes(2)
  })

  it('stop 后既不再心跳, 也不再被活动事件触发', async () => {
    startPresenceHeartbeat()
    stopPresenceHeartbeat()

    vi.advanceTimersByTime(10 * 60 * 1000)
    window.dispatchEvent(new Event('mousemove'))
    await flushMicro()

    expect(setPresenceMock).not.toHaveBeenCalled()
  })

  it('重复 start 不会叠加多个定时器', async () => {
    startPresenceHeartbeat()
    startPresenceHeartbeat()
    startPresenceHeartbeat()

    vi.advanceTimersByTime(4 * 60 * 1000)
    await flushMicro()
    expect(setPresenceMock).toHaveBeenCalledTimes(1)
  })
})
