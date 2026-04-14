/**
 * LRUCache 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { LRUCache } from '../LRUCache'

describe('LRUCache', () => {
  let cache: LRUCache<string, number>

  beforeEach(() => {
    cache = new LRUCache<string, number>(3)
  })

  describe('基本操作', () => {
    it('应该能够设置和获取值', () => {
      cache.set('a', 1)
      expect(cache.get('a')).toBe(1)
    })

    it('应该返回 undefined 对于不存在的键', () => {
      expect(cache.get('nonexistent')).toBeUndefined()
    })

    it('应该能够检查键是否存在', () => {
      cache.set('a', 1)
      expect(cache.has('a')).toBe(true)
      expect(cache.has('b')).toBe(false)
    })

    it('应该能够删除键', () => {
      cache.set('a', 1)
      expect(cache.delete('a')).toBe(true)
      expect(cache.has('a')).toBe(false)
      expect(cache.delete('a')).toBe(false)
    })

    it('应该能够清空缓存', () => {
      cache.set('a', 1)
      cache.set('b', 2)
      cache.clear()
      expect(cache.size).toBe(0)
    })
  })

  describe('LRU 淘汰策略', () => {
    it('应该在达到容量时淘汰最久未使用的项', () => {
      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3)
      cache.set('d', 4)

      expect(cache.has('a')).toBe(false)
      expect(cache.has('b')).toBe(true)
      expect(cache.has('c')).toBe(true)
      expect(cache.has('d')).toBe(true)
      expect(cache.size).toBe(3)
    })

    it('应该在访问时更新项的位置', () => {
      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3)

      cache.get('a')

      cache.set('d', 4)

      expect(cache.has('a')).toBe(true)
      expect(cache.has('b')).toBe(false)
      expect(cache.has('c')).toBe(true)
      expect(cache.has('d')).toBe(true)
    })

    it('应该在更新时移动项到最新位置', () => {
      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3)

      cache.set('a', 10)

      cache.set('d', 4)

      expect(cache.has('a')).toBe(true)
      expect(cache.has('b')).toBe(false)
      expect(cache.get('a')).toBe(10)
    })
  })

  describe('属性和方法', () => {
    it('应该返回正确的大小', () => {
      expect(cache.size).toBe(0)
      cache.set('a', 1)
      expect(cache.size).toBe(1)
      cache.set('b', 2)
      expect(cache.size).toBe(2)
    })

    it('应该返回正确的容量', () => {
      expect(cache.capacity).toBe(3)
    })

    it('应该能够遍历所有键', () => {
      cache.set('a', 1)
      cache.set('b', 2)

      const keys = Array.from(cache.keys())
      expect(keys).toEqual(['a', 'b'])
    })

    it('应该能够遍历所有值', () => {
      cache.set('a', 1)
      cache.set('b', 2)

      const values = Array.from(cache.values())
      expect(values).toEqual([1, 2])
    })

    it('应该能够遍历所有键值对', () => {
      cache.set('a', 1)
      cache.set('b', 2)

      const entries = Array.from(cache.entries())
      expect(entries).toEqual([
        ['a', 1],
        ['b', 2]
      ])
    })

    it('应该能够使用 forEach 遍历', () => {
      cache.set('a', 1)
      cache.set('b', 2)

      const result: [string, number][] = []
      cache.forEach((value, key) => {
        result.push([key, value])
      })

      expect(result).toEqual([
        ['a', 1],
        ['b', 2]
      ])
    })
  })

  describe('边界情况', () => {
    it('应该支持容量为 1 的缓存', () => {
      const smallCache = new LRUCache<string, number>(1)
      smallCache.set('a', 1)
      smallCache.set('b', 2)

      expect(smallCache.has('a')).toBe(false)
      expect(smallCache.has('b')).toBe(true)
    })

    it('应该支持不同的键类型', () => {
      const numberCache = new LRUCache<number, string>(2)
      numberCache.set(1, 'one')
      numberCache.set(2, 'two')

      expect(numberCache.get(1)).toBe('one')
      expect(numberCache.get(2)).toBe('two')
    })
  })
})
