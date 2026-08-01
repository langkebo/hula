import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { errorTracker } from '@/utils/ErrorTracker'

/**
 * N-3 反馈循环：syncManager.stop() 触发的 abort 错误不应被 ErrorTracker 跟踪。
 *
 * 根因分析：
 * - MatrixSyncManager.stop() → SlidingSync.stop() → abortController.abort()
 * - 浏览器中止 in-flight fetch 请求，控制台输出 net::ERR_ABORTED（浏览器层面，无法消除）
 * - SDK sliding-sync.ts:713 的 catch 块调用 logger.error(err) 输出
 *   `ApiError: RoomManager.POST /sync failed: fetch failed: Failed to fetch`
 * - 此错误已在 SDK 内部 catch 处理，不应成为 unhandled rejection
 * - 但若因时序异常成为 unhandled rejection，ErrorTracker 应过滤此类良性 abort 错误
 */
describe('ErrorTracker — N-3 sync abort 错误过滤', () => {
  beforeEach(() => {
    errorTracker.clearErrors()
    errorTracker.terminate()
    errorTracker.initialize({ enableGlobalHandlers: false })
  })

  afterEach(() => {
    errorTracker.terminate()
  })

  it('过滤 "RoomManager.POST /sync failed: fetch failed" 错误', () => {
    const err = new Error('RoomManager.POST /sync failed: fetch failed: Failed to fetch')
    errorTracker.trackError('promise', err)
    expect(errorTracker.getErrors()).toHaveLength(0)
  })

  it('过滤 presence status 设置时的 fetch failed 错误', () => {
    const err = new Error('ProfileManager.PUT /status failed: fetch failed: Failed to fetch')
    errorTracker.trackError('promise', err)
    expect(errorTracker.getErrors()).toHaveLength(0)
  })

  it('过滤 PresenceManager 的 presence status 设置 fetch failed 错误', () => {
    const err = new Error('PresenceManager.PUT /status failed: fetch failed: Failed to fetch')
    errorTracker.trackError('promise', err)
    expect(errorTracker.getErrors()).toHaveLength(0)
  })

  it('过滤 SlidingSync backing off 警告（abort 后的 backoff）', () => {
    // SDK 在 abort 后可能进入 backoff 路径，产生此类错误
    const err = new Error('SlidingSync backing off for 1000ms after 1 consecutive errors')
    errorTracker.trackError('promise', err)
    expect(errorTracker.getErrors()).toHaveLength(0)
  })

  it('不过滤真实的非 abort 相关 API 错误（HTTP 500）', () => {
    const err = new Error('RoomManager.POST /sync failed: HTTP 500 Internal Server Error')
    errorTracker.trackError('promise', err)
    expect(errorTracker.getErrors()).toHaveLength(1)
  })

  it('不过滤其他 manager 的真实 fetch failed 错误（非 stop 时主动 abort 的 endpoint）', () => {
    // 例如 RoomManager.POST /join 在用户操作时失败，应被跟踪
    const err = new Error('RoomManager.POST /join failed: fetch failed: Failed to fetch')
    errorTracker.trackError('promise', err)
    expect(errorTracker.getErrors()).toHaveLength(1)
  })

  it('不过滤其他真实的 HTTP 错误（403 Forbidden）', () => {
    const err = new Error('RoomManager.POST /join failed: HTTP 403 Forbidden')
    errorTracker.trackError('promise', err)
    expect(errorTracker.getErrors()).toHaveLength(1)
  })
})
