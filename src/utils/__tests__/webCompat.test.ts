import { afterEach, describe, expect, it, vi } from 'vitest'
import { arrayAt, hasOwn, hasSubtleCrypto, requireSubtleCrypto, safeRandomUUID } from '../webCompat'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('webCompat', () => {
  describe('hasOwn', () => {
    it('识别自有属性且排除原型链属性', () => {
      const target = { a: 1 }
      expect(hasOwn(target, 'a')).toBe(true)
      expect(hasOwn(target, 'b')).toBe(false)
      expect(hasOwn(target, 'toString')).toBe(false)
    })

    it('在 Object.hasOwn 缺失时回退到 hasOwnProperty.call', () => {
      const original = Object.hasOwn
      // 模拟旧 WebView 缺失 Object.hasOwn
      Object.hasOwn = undefined as unknown as typeof Object.hasOwn
      try {
        const target = { a: 1 }
        expect(hasOwn(target, 'a')).toBe(true)
        expect(hasOwn(target, 'toString')).toBe(false)
      } finally {
        Object.hasOwn = original
      }
    })
  })

  describe('arrayAt', () => {
    it('支持正索引与负索引', () => {
      const items = ['a', 'b', 'c']
      expect(arrayAt(items, 0)).toBe('a')
      expect(arrayAt(items, -1)).toBe('c')
      expect(arrayAt(items, -3)).toBe('a')
    })

    it('越界返回 undefined', () => {
      const items = ['a', 'b']
      expect(arrayAt(items, 5)).toBeUndefined()
      expect(arrayAt(items, -5)).toBeUndefined()
      expect(arrayAt([], 0)).toBeUndefined()
    })

    it('在 Array.prototype.at 缺失时回退到手工索引', () => {
      const original = Array.prototype.at
      // 模拟旧 WebView 缺失 Array.prototype.at
      Array.prototype.at = undefined as unknown as typeof Array.prototype.at
      try {
        const items = ['a', 'b', 'c']
        expect(arrayAt(items, 0)).toBe('a')
        expect(arrayAt(items, -1)).toBe('c')
        expect(arrayAt(items, 9)).toBeUndefined()
        expect(arrayAt(items, -9)).toBeUndefined()
      } finally {
        Array.prototype.at = original
      }
    })
  })

  describe('hasSubtleCrypto / requireSubtleCrypto', () => {
    it('存在时返回 SubtleCrypto 实例', () => {
      expect(hasSubtleCrypto()).toBe(true)
      expect(requireSubtleCrypto()).toBe(globalThis.crypto.subtle)
    })

    it('缺失时 hasSubtleCrypto 为 false 且 requireSubtleCrypto 抛出可读错误', () => {
      vi.stubGlobal('crypto', {})
      expect(hasSubtleCrypto()).toBe(false)
      expect(() => requireSubtleCrypto()).toThrow(/SubtleCrypto/)
    })
  })

  describe('safeRandomUUID', () => {
    it('优先使用原生 randomUUID', () => {
      const native = vi.fn(() => '11111111-1111-4111-8111-111111111111')
      vi.stubGlobal('crypto', { randomUUID: native })
      expect(safeRandomUUID()).toBe('11111111-1111-4111-8111-111111111111')
      expect(native).toHaveBeenCalledTimes(1)
    })

    it('randomUUID 缺失时用 getRandomValues 生成合法 v4 UUID', () => {
      const getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
        const view = array as unknown as Uint8Array
        for (let i = 0; i < view.length; i++) view[i] = i * 7
        return array
      }
      vi.stubGlobal('crypto', { getRandomValues })
      const id = safeRandomUUID()
      expect(id).toMatch(UUID_V4)
    })
  })
})
