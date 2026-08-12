import { describe, expect, it, vi } from 'vitest'
import { IdempotencyGuard, SingleFlight } from '../ExecutionGuard'

describe('SingleFlight', () => {
  it('并发调用 run 3 次，factory 只执行 1 次', async () => {
    const factory = vi.fn().mockResolvedValue('result')
    const flight = new SingleFlight<string>()

    const [r1, r2, r3] = await Promise.all([flight.run(factory), flight.run(factory), flight.run(factory)])

    expect(factory).toHaveBeenCalledTimes(1)
    expect(r1).toBe('result')
    expect(r2).toBe(r1)
    expect(r3).toBe(r1)
  })

  it('第一次完成后再次 run，factory 重新执行（不缓存结果）', async () => {
    const factory = vi.fn().mockResolvedValue('result')
    const flight = new SingleFlight<string>()

    await flight.run(factory)
    await flight.run(factory)

    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('factory 失败时清空 in-flight，允许重试', async () => {
    const factory = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce('success')
    const flight = new SingleFlight<string>()

    await expect(flight.run(factory)).rejects.toThrow('fail')
    const result = await flight.run(factory)

    expect(factory).toHaveBeenCalledTimes(2)
    expect(result).toBe('success')
  })

  it('isRunning 在执行期间为 true，完成后为 false', async () => {
    let resolveFn: (v: string) => void
    const factory = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFn = resolve
        })
    )
    const flight = new SingleFlight<string>()

    const promise = flight.run(factory)
    expect(flight.isRunning).toBe(true)

    resolveFn!('done')
    await promise

    expect(flight.isRunning).toBe(false)
  })

  it('reset 清空 in-flight 引用', () => {
    const flight = new SingleFlight<string>()
    expect(flight.isRunning).toBe(false)
    flight.reset()
    expect(flight.isRunning).toBe(false)
  })
})

describe('IdempotencyGuard', () => {
  it('串行调用 run 两次，factory 只执行 1 次', async () => {
    const factory = vi.fn().mockResolvedValue(undefined)
    const guard = new IdempotencyGuard()

    await guard.run(factory)
    await guard.run(factory)

    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('并发调用 run 两次，factory 只执行 1 次（Promise 复用）', async () => {
    const factory = vi.fn().mockResolvedValue(undefined)
    const guard = new IdempotencyGuard()

    await Promise.all([guard.run(factory), guard.run(factory)])

    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('factory 失败时不置 settled，允许重试', async () => {
    const factory = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce(undefined)
    const guard = new IdempotencyGuard()

    await expect(guard.run(factory)).rejects.toThrow('fail')
    expect(guard.isSettled).toBe(false)

    await guard.run(factory)
    expect(guard.isSettled).toBe(true)
    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('reset 后可重新执行', async () => {
    const factory = vi.fn().mockResolvedValue(undefined)
    const guard = new IdempotencyGuard()

    await guard.run(factory)
    expect(guard.isSettled).toBe(true)

    guard.reset()
    expect(guard.isSettled).toBe(false)

    await guard.run(factory)
    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('settled 后 run 返回已完成的 Promise', async () => {
    const factory = vi.fn().mockResolvedValue(undefined)
    const guard = new IdempotencyGuard()

    await guard.run(factory)

    // 第二次调用应立即 resolve（已 settled）
    const start = Date.now()
    await guard.run(factory)
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(10)
  })
})
