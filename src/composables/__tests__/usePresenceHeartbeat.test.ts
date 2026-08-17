/**
 * usePresenceHeartbeat 单元测试
 *
 * 覆盖点:
 * - start 后按固定 45s 间隔调 setPresence('online')
 * - 用户活动/visibility 事件不再触发额外上报 (心跳只由固定定时器驱动)
 * - start 会把本地 userInfo.activeStatus 同步为 ONLINE
 * - stop 后定时器被清除, 不再心跳
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

import {
  PRESENCE_HEARTBEAT_INTERVAL_MS,
  startPresenceHeartbeat,
  stopPresenceHeartbeat
} from '@/composables/user/usePresenceHeartbeat'

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

  it('定时器按固定 45s 间隔调用 setPresence(online) 并回写本地 userStore', async () => {
    startPresenceHeartbeat()
    vi.advanceTimersByTime(PRESENCE_HEARTBEAT_INTERVAL_MS)
    await flushMicro()

    expect(setPresenceMock).toHaveBeenCalledTimes(1)
    expect(setPresenceMock).toHaveBeenCalledWith('online')
    expect(userStoreMock.userInfo.activeStatus).toBe(OnlineEnum.ONLINE)
    expect(userStoreMock.userInfo.lastOptTime).toBeGreaterThan(0)
  })

  it('心跳间隔为 45 秒 (而非更长的旧周期)', () => {
    expect(PRESENCE_HEARTBEAT_INTERVAL_MS).toBe(45 * 1000)
  })

  it('用户活动/visibility 事件不再触发额外上报', async () => {
    startPresenceHeartbeat()

    window.dispatchEvent(new Event('mousemove'))
    window.dispatchEvent(new Event('mousedown'))
    window.dispatchEvent(new Event('keydown'))
    document.dispatchEvent(new Event('visibilitychange'))
    await flushMicro()

    // 只有固定定时器会触发, 事件不应产生上报
    expect(setPresenceMock).not.toHaveBeenCalled()
  })

  it('stop 后定时器被清除, 不再心跳', async () => {
    startPresenceHeartbeat()
    stopPresenceHeartbeat()

    vi.advanceTimersByTime(PRESENCE_HEARTBEAT_INTERVAL_MS * 10)
    await flushMicro()

    expect(setPresenceMock).not.toHaveBeenCalled()
  })

  it('重复 start 不会叠加多个定时器', async () => {
    startPresenceHeartbeat()
    startPresenceHeartbeat()
    startPresenceHeartbeat()

    vi.advanceTimersByTime(PRESENCE_HEARTBEAT_INTERVAL_MS)
    await flushMicro()
    expect(setPresenceMock).toHaveBeenCalledTimes(1)
  })
})
