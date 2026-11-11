import { describe, expect, it } from 'vitest'
import { normalizeCryptoError } from '../cryptoErrorNormalize'

/**
 * 回归背景：WASM 通过 wasm-bindgen 抛出的错误常是空对象 `{}`，
 * 若直接 String() 会得到 "[object Object]"，导致上层按错误字符串匹配的
 * 清理重试分支被整段跳过（高版本 crypto store 无法打开时静默降级为非加密模式）。
 */
describe('normalizeCryptoError', () => {
  it('returns the message of an Error instance', () => {
    expect(normalizeCryptoError(new Error('store open failed'))).toBe('store open failed')
  })

  it('preserves the message of Error subclasses', () => {
    class CryptoError extends Error {}
    expect(normalizeCryptoError(new CryptoError('boom'))).toBe('boom')
  })

  it('stringifies a non-empty plain object', () => {
    expect(normalizeCryptoError({ code: 42, reason: 'bad store' })).toBe('{"code":42,"reason":"bad store"}')
  })

  it('maps the wasm-bindgen empty object to a stable marker', () => {
    // 关键契约：空对象不能退化成 "[object Object]"，否则字符串匹配逻辑失效
    expect(normalizeCryptoError({})).toBe('[empty-object]')
  })

  it('maps an empty array-like object without own keys to the marker', () => {
    expect(normalizeCryptoError(Object.create(null))).toBe('[empty-object]')
  })

  it('falls back to String() when JSON.stringify throws', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(normalizeCryptoError(circular)).toBe('[object Object]')
  })

  it('stringifies primitives', () => {
    expect(normalizeCryptoError('plain string')).toBe('plain string')
    expect(normalizeCryptoError(42)).toBe('42')
    expect(normalizeCryptoError(null)).toBe('null')
    expect(normalizeCryptoError(undefined)).toBe('undefined')
    expect(normalizeCryptoError(false)).toBe('false')
  })

  it('serializes arrays through JSON.stringify', () => {
    expect(normalizeCryptoError(['a', 'b'])).toBe('["a","b"]')
  })
})
