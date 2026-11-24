import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_FLUSH_TIMEOUT_MS,
  flushSettingsWrites,
  hasPendingSettingsWrites,
  resetSettingsPendingWritesForTest,
  trackSettingsWrite
} from '../settingsPendingWrites'

/** 手动可控的 promise 替身。 */
function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** 排空微任务，让 `trackSettingsWrite` 内部的 then/catch 得以执行。 */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('settingsPendingWrites', () => {
  beforeEach(() => {
    resetSettingsPendingWritesForTest()
  })

  afterEach(() => {
    resetSettingsPendingWritesForTest()
    vi.useRealTimers()
  })

  it('登记后 hasPending 为 true，settle 后为 false', async () => {
    const task = deferred()
    expect(hasPendingSettingsWrites()).toBe(false)

    trackSettingsWrite(task.promise)
    expect(hasPendingSettingsWrites()).toBe(true)

    task.resolve()
    await flushMicrotasks()
    expect(hasPendingSettingsWrites()).toBe(false)
  })

  it('reject 的写请求也会在 settle 后移除，且不产生未处理 rejection', async () => {
    const task = deferred()
    trackSettingsWrite(task.promise)

    task.reject(new Error('boom'))
    await flushMicrotasks()

    expect(hasPendingSettingsWrites()).toBe(false)
  })

  it('多个并发在飞请求，flushSettingsWrites 全部等待完成', async () => {
    const first = deferred()
    const second = deferred()
    trackSettingsWrite(first.promise)
    trackSettingsWrite(second.promise)

    let settled = false
    const flushing = flushSettingsWrites().then((result) => {
      settled = true
      return result
    })

    await flushMicrotasks()
    expect(settled).toBe(false)

    first.resolve()
    await flushMicrotasks()
    // 只完成一个，flush 不能提前返回
    expect(settled).toBe(false)

    second.resolve()
    await expect(flushing).resolves.toEqual({ failed: 0 })
    expect(hasPendingSettingsWrites()).toBe(false)
  })

  it('其中一个 reject 时不抛异常，只把失败数计入 failed', async () => {
    const ok = deferred()
    const bad = deferred()
    trackSettingsWrite(ok.promise)
    trackSettingsWrite(bad.promise)

    const flushing = flushSettingsWrites()
    ok.resolve()
    bad.reject(new Error('write failed'))

    await expect(flushing).resolves.toEqual({ failed: 1 })
  })

  it('超时到点直接 resolve，不挂死（默认超时 8000ms）', async () => {
    expect(DEFAULT_FLUSH_TIMEOUT_MS).toBe(8000)

    vi.useFakeTimers()
    // 永不 settle：模拟请求卡在网络层
    trackSettingsWrite(new Promise(() => undefined))

    const flushing = flushSettingsWrites()
    await vi.advanceTimersByTimeAsync(DEFAULT_FLUSH_TIMEOUT_MS)

    // 超时后仍未完成的任务计入 failed，且集合被清空（下次关窗不再重复等待）
    await expect(flushing).resolves.toEqual({ failed: 1 })
    expect(hasPendingSettingsWrites()).toBe(false)
  })

  it('settle 后从集合移除：重复 flush 不会二次等待', async () => {
    const task = deferred()
    trackSettingsWrite(task.promise)

    const firstFlush = flushSettingsWrites()
    task.resolve()
    await expect(firstFlush).resolves.toEqual({ failed: 0 })

    // 第二次 flush 应立即返回（集合已空），不需要任何新任务 settle
    const startedAt = Date.now()
    await expect(flushSettingsWrites()).resolves.toEqual({ failed: 0 })
    expect(Date.now() - startedAt).toBeLessThan(DEFAULT_FLUSH_TIMEOUT_MS)
  })

  it('flush 进行中登记的写请求（批次未完成时追加）也会被等待', async () => {
    // 真实路径：`activeElement.blur()` 会同步派发多个字段的 @blur，
    // 后登记的请求可能落在 flush 的某个批次之后，因此 drain 必须循环而不是只快照一次。
    const first = deferred()
    trackSettingsWrite(first.promise)

    const flushing = flushSettingsWrites()

    // 在第一批尚未 settle 时追加登记（模拟 blur 链式触发）
    const second = deferred()
    trackSettingsWrite(second.promise)

    let settled = false
    void flushing.then(() => {
      settled = true
    })

    first.resolve()
    await flushMicrotasks()
    // 只完成了 first，second 仍在飞 → flush 不能提前返回
    expect(settled).toBe(false)

    second.resolve()
    await expect(flushing).resolves.toEqual({ failed: 0 })
    expect(hasPendingSettingsWrites()).toBe(false)
  })
})
