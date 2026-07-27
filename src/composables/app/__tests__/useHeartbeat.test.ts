import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type HeartbeatDeps, useHeartbeat } from '@/composables/app/useHeartbeat'

describe('useHeartbeat — 离线检测心跳增强 (§9.3.4)', () => {
  const pingMock = vi.fn<() => Promise<boolean>>()
  let deps: HeartbeatDeps

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    deps = { ping: pingMock }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('初始状态', () => {
    it('heartbeatOk 初始为 null（未知）', () => {
      const { heartbeatOk } = useHeartbeat(deps)
      expect(heartbeatOk.value).toBeNull()
    })

    it('heartbeatOk 初始为 null，未调用 ping', () => {
      const { heartbeatOk } = useHeartbeat(deps)
      expect(heartbeatOk.value).toBeNull()
      expect(pingMock).not.toHaveBeenCalled()
    })
  })

  describe('checkNow — 立即探测', () => {
    it('ping 成功时 heartbeatOk 为 true', async () => {
      pingMock.mockResolvedValue(true)
      const { heartbeatOk, checkNow } = useHeartbeat(deps)
      await checkNow()
      expect(heartbeatOk.value).toBe(true)
    })

    it('ping 失败时 heartbeatOk 为 false', async () => {
      pingMock.mockResolvedValue(false)
      const { heartbeatOk, checkNow } = useHeartbeat(deps)
      await checkNow()
      expect(heartbeatOk.value).toBe(false)
    })

    it('ping 抛异常时 heartbeatOk 为 false', async () => {
      pingMock.mockRejectedValue(new Error('网络错误'))
      const { heartbeatOk, checkNow } = useHeartbeat(deps)
      await checkNow()
      expect(heartbeatOk.value).toBe(false)
    })
  })

  describe('start/stop — 定时心跳', () => {
    it('start 后按 interval 周期性调用 ping', async () => {
      pingMock.mockResolvedValue(true)
      const { start } = useHeartbeat(deps, { intervalMs: 30000 })
      start()
      // 首次立即探测
      await vi.advanceTimersByTimeAsync(0)
      expect(pingMock).toHaveBeenCalledTimes(1)

      // 30s 后第二次
      await vi.advanceTimersByTimeAsync(30000)
      expect(pingMock).toHaveBeenCalledTimes(2)

      // 60s 后第三次
      await vi.advanceTimersByTimeAsync(30000)
      expect(pingMock).toHaveBeenCalledTimes(3)
    })

    it('stop 后不再调用 ping', async () => {
      pingMock.mockResolvedValue(true)
      const { start, stop } = useHeartbeat(deps, { intervalMs: 30000 })
      start()
      await vi.advanceTimersByTimeAsync(0)
      expect(pingMock).toHaveBeenCalledTimes(1)

      stop()
      await vi.advanceTimersByTimeAsync(60000)
      expect(pingMock).toHaveBeenCalledTimes(1)
    })

    it('重复 start 不会创建多个定时器', async () => {
      pingMock.mockResolvedValue(true)
      const { start } = useHeartbeat(deps, { intervalMs: 30000 })
      start()
      start()
      start()
      await vi.advanceTimersByTimeAsync(0)
      expect(pingMock).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(30000)
      expect(pingMock).toHaveBeenCalledTimes(2)
    })

    it('stop 后再次 start 可恢复心跳', async () => {
      pingMock.mockResolvedValue(true)
      const { start, stop } = useHeartbeat(deps, { intervalMs: 30000 })
      start()
      await vi.advanceTimersByTimeAsync(0)
      stop()

      start()
      await vi.advanceTimersByTimeAsync(0)
      expect(pingMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('interval 默认值', () => {
    it('未指定 interval 时默认 30 秒', async () => {
      pingMock.mockResolvedValue(true)
      const { start } = useHeartbeat(deps)
      start()
      await vi.advanceTimersByTimeAsync(0)
      expect(pingMock).toHaveBeenCalledTimes(1)

      // 29s 不触发
      await vi.advanceTimersByTimeAsync(29000)
      expect(pingMock).toHaveBeenCalledTimes(1)

      // 30s 触发
      await vi.advanceTimersByTimeAsync(1000)
      expect(pingMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('isReachable — 真实在线状态', () => {
    it('heartbeatOk=null 时 isReachable 为 null（未知）', () => {
      const { isReachable } = useHeartbeat(deps)
      expect(isReachable.value).toBeNull()
    })

    it('navigator.onLine=false 且 heartbeatOk=true 时 isReachable 为 false', async () => {
      pingMock.mockResolvedValue(true)
      const { isReachable, checkNow } = useHeartbeat(deps, { browserOnline: false })
      await checkNow()
      expect(isReachable.value).toBe(false)
    })

    it('navigator.onLine=true 且 heartbeatOk=true 时 isReachable 为 true', async () => {
      pingMock.mockResolvedValue(true)
      const { isReachable, checkNow } = useHeartbeat(deps, { browserOnline: true })
      await checkNow()
      expect(isReachable.value).toBe(true)
    })

    it('navigator.onLine=true 且 heartbeatOk=false 时 isReachable 为 false（假在线）', async () => {
      pingMock.mockResolvedValue(false)
      const { isReachable, checkNow } = useHeartbeat(deps, { browserOnline: true })
      await checkNow()
      expect(isReachable.value).toBe(false)
    })
  })
})
