import { describe, expect, it } from 'vitest'
import { LRUCache } from '../LRUCache'

describe('LRUCache', () => {
  it('initializes with default capacity 50', () => {
    const cache = new LRUCache<string, number>()
    expect(cache.capacity).toBe(50)
    expect(cache.size).toBe(0)
  })

  it('initializes with custom capacity', () => {
    const cache = new LRUCache<string, number>(3)
    expect(cache.capacity).toBe(3)
  })

  it('stores and retrieves values', () => {
    const cache = new LRUCache<string, number>(3)
    cache.set('a', 1)
    cache.set('b', 2)
    expect(cache.get('a')).toBe(1)
    expect(cache.get('b')).toBe(2)
    expect(cache.size).toBe(2)
  })

  it('returns undefined for missing keys', () => {
    const cache = new LRUCache<string, number>()
    expect(cache.get('missing')).toBeUndefined()
  })

  it('checks existence via has()', () => {
    const cache = new LRUCache<string, number>()
    cache.set('a', 1)
    expect(cache.has('a')).toBe(true)
    expect(cache.has('b')).toBe(false)
  })

  it('evicts the least recently used item when over capacity', () => {
    const cache = new LRUCache<string, number>(3)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    cache.set('d', 4)
    expect(cache.has('a')).toBe(false)
    expect(cache.has('b')).toBe(true)
    expect(cache.size).toBe(3)
  })

  it('promotes accessed items to most recently used', () => {
    const cache = new LRUCache<string, number>(3)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    cache.get('a')
    cache.set('d', 4)
    expect(cache.has('a')).toBe(true)
    expect(cache.has('b')).toBe(false)
  })

  it('updates existing key without eviction', () => {
    const cache = new LRUCache<string, number>(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('a', 99)
    expect(cache.get('a')).toBe(99)
    expect(cache.size).toBe(2)
    cache.set('c', 3)
    expect(cache.has('b')).toBe(false)
    expect(cache.has('a')).toBe(true)
  })

  it('deletes specific items', () => {
    const cache = new LRUCache<string, number>()
    cache.set('a', 1)
    expect(cache.delete('a')).toBe(true)
    expect(cache.has('a')).toBe(false)
    expect(cache.delete('a')).toBe(false)
  })

  it('clears all items', () => {
    const cache = new LRUCache<string, number>()
    cache.set('a', 1)
    cache.set('b', 2)
    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.has('a')).toBe(false)
  })

  it('iterates keys, values, and entries in insertion order', () => {
    const cache = new LRUCache<string, number>()
    cache.set('a', 1)
    cache.set('b', 2)
    expect(Array.from(cache.keys())).toEqual(['a', 'b'])
    expect(Array.from(cache.values())).toEqual([1, 2])
    expect(Array.from(cache.entries())).toEqual([
      ['a', 1],
      ['b', 2]
    ])
  })

  it('supports forEach iteration', () => {
    const cache = new LRUCache<string, number>()
    cache.set('a', 1)
    cache.set('b', 2)
    const collected: Array<[string, number]> = []
    cache.forEach((value, key) => collected.push([key, value]))
    expect(collected).toEqual([
      ['a', 1],
      ['b', 2]
    ])
  })

  it('handles capacity of 1 by always keeping only the latest item', () => {
    const cache = new LRUCache<string, number>(1)
    cache.set('a', 1)
    cache.set('b', 2)
    expect(cache.has('a')).toBe(false)
    expect(cache.get('b')).toBe(2)
  })
})
