import { describe, expect, it } from 'vitest'
import { serializeLogArg, toErrorDescriptor } from '../logArgSerialize'

/**
 * `logArgSerialize` 的单元测试。
 *
 * 契约（2026-10-13）：**日志不得静默丢弃错误事实**。修复前
 * `logger.warn(msg, someError)` 在 Tauri 侧日志里输出 `{}`（因为 Error 的
 * `message`/`stack` 非可枚举，`JSON.stringify` 得空对象），排障时看不到
 * errcode / 状态码。
 */

describe('toErrorDescriptor', () => {
  it('把非可枚举的 name/message 摊成可枚举字段', () => {
    const descriptor = toErrorDescriptor(new Error('boom'))
    expect(descriptor.name).toBe('Error')
    expect(descriptor.message).toBe('boom')
    expect(Object.keys(descriptor)).toContain('message')
    expect(JSON.stringify(descriptor)).toContain('boom')
  })

  it('保留 Matrix SDK 的事实字段（errorCode / statusCode / isRetryable / retryAfter）', () => {
    const error = Object.assign(new Error('forbidden'), {
      name: 'ApiError',
      errorCode: 'M_FORBIDDEN',
      statusCode: 403,
      isRetryable: false,
      retryAfter: 5
    })

    const descriptor = toErrorDescriptor(error)

    expect(descriptor.name).toBe('ApiError')
    expect(descriptor.errorCode).toBe('M_FORBIDDEN')
    expect(descriptor.statusCode).toBe(403)
    expect(descriptor.isRetryable).toBe(false)
    expect(descriptor.retryAfter).toBe(5)
    expect(JSON.stringify(descriptor)).toContain('M_FORBIDDEN')
  })

  it('保留 stack（排障必需）', () => {
    const descriptor = toErrorDescriptor(new Error('with-stack'))
    expect(typeof descriptor.stack).toBe('string')
    expect(String(descriptor.stack)).toContain('with-stack')
  })

  it('展开 cause 链（最多 3 层，防自引用）', () => {
    const inner = Object.assign(new Error('inner'), { errorCode: 'M_UNKNOWN' })
    const outer = new Error('outer', { cause: inner })

    const descriptor = toErrorDescriptor(outer)

    expect(descriptor.cause).toMatchObject({ message: 'inner', errorCode: 'M_UNKNOWN' })
  })

  it('自引用的 cause 不会无限展开（不抛栈溢出）', () => {
    const error = new Error('self')
    ;(error as { cause?: unknown }).cause = error

    expect(() => toErrorDescriptor(error)).not.toThrow()
  })

  it('非 Error 的 cause 原样保留', () => {
    const error = new Error('outer', { cause: { code: 42 } })
    expect(toErrorDescriptor(error).cause).toEqual({ code: 42 })
  })
})

describe('serializeLogArg', () => {
  it('字符串原样返回（不额外加引号）', () => {
    expect(serializeLogArg('plain')).toBe('plain')
  })

  it('null/undefined/数字/布尔按字面量输出', () => {
    expect(serializeLogArg(null)).toBe('null')
    expect(serializeLogArg(undefined)).toBe('undefined')
    expect(serializeLogArg(0)).toBe('0')
    expect(serializeLogArg(false)).toBe('false')
  })

  it('普通对象走 JSON', () => {
    expect(serializeLogArg({ a: 1 })).toBe('{"a":1}')
  })

  it('循环引用不抛错，降级为 [Unserializable]（日志调用不得污染调用点）', () => {
    const circular: Record<string, unknown> = { a: 1 }
    circular.self = circular

    expect(() => serializeLogArg(circular)).not.toThrow()
    expect(serializeLogArg(circular)).toBe('[Unserializable]')
  })

  it('BigInt 不抛错', () => {
    expect(() => serializeLogArg({ big: 1n })).not.toThrow()
    expect(serializeLogArg({ big: 1n })).toBe('[Unserializable]')
  })

  it('Error 直接传入时也会被展开（不依赖调用方先转换）', () => {
    // 注意：Error 本身仍会走 JSON.stringify ⇒ {} 。保留该断言是为了锁住
    // 「必须经 toErrorDescriptor 转换」这一事实（红=有人误以为直接传 Error 也行）。
    // 真正的端到端保证在 Logger.test.ts（redactObject 里做了转换）。
    expect(serializeLogArg(new Error('lost'))).toBe('{}')
    expect(serializeLogArg(toErrorDescriptor(new Error('kept')))).toContain('kept')
  })
})
