import { describe, expect, it } from 'vitest'
import {
  deepClone,
  isArray,
  isBoolean,
  isEmptyObject,
  isEqual,
  isFunction,
  isNonEmpty,
  isNonEmptyObject,
  isNullOrUndefined,
  isPromise,
  merge,
  omit,
  parseJSON,
  pick,
  stringifyJSON,
  typeGuard,
  unknownToArray,
  unknownToBoolean,
  unknownToNumber,
  unknownToObject,
  unknownToString
} from '../typeGuard'

describe('typeGuard - additional helpers', () => {
  describe('isArray / isBoolean / isFunction', () => {
    it('isArray detects arrays only', () => {
      expect(isArray([])).toBe(true)
      expect(isArray([1, 2])).toBe(true)
      expect(isArray('abc')).toBe(false)
      expect(isArray({ length: 0 })).toBe(false)
    })

    it('isBoolean detects only booleans', () => {
      expect(isBoolean(true)).toBe(true)
      expect(isBoolean(false)).toBe(true)
      expect(isBoolean(0)).toBe(false)
      expect(isBoolean('true')).toBe(false)
    })

    it('isFunction detects callable values', () => {
      expect(isFunction(() => 0)).toBe(true)
      expect(isFunction(class {})).toBe(true)
      expect(isFunction({})).toBe(false)
    })
  })

  describe('isPromise', () => {
    it('detects native Promise', () => {
      expect(isPromise(Promise.resolve())).toBe(true)
    })

    it('detects thenable-like objects', () => {
      const thenable = Object.create(null) as Record<string, unknown>
      // biome-ignore lint/suspicious/noThenProperty: testing thenable detection
      Object.assign(thenable, { then: () => 0, catch: () => 0 })
      expect(isPromise(thenable)).toBe(true)
    })

    it('rejects plain objects', () => {
      expect(isPromise({})).toBe(false)
      expect(isPromise(null)).toBe(false)
    })
  })

  describe('isNullOrUndefined', () => {
    it('returns true for null/undefined', () => {
      expect(isNullOrUndefined(null)).toBe(true)
      expect(isNullOrUndefined(undefined)).toBe(true)
    })

    it('returns false for falsy non-nullish', () => {
      expect(isNullOrUndefined(0)).toBe(false)
      expect(isNullOrUndefined('')).toBe(false)
      expect(isNullOrUndefined(false)).toBe(false)
    })
  })

  describe('isEmptyObject / isNonEmptyObject / isNonEmpty', () => {
    it('isEmptyObject only true for empty plain object', () => {
      expect(isEmptyObject({})).toBe(true)
      expect(isEmptyObject({ a: 1 })).toBe(false)
      expect(isEmptyObject([])).toBe(false)
      expect(isEmptyObject(null)).toBe(false)
    })

    it('isNonEmptyObject is the inverse for objects', () => {
      expect(isNonEmptyObject({ a: 1 })).toBe(true)
      expect(isNonEmptyObject({})).toBe(false)
    })

    it('isNonEmpty is the inverse of isEmpty', () => {
      expect(isNonEmpty('hello')).toBe(true)
      expect(isNonEmpty([1])).toBe(true)
      expect(isNonEmpty('')).toBe(false)
      expect(isNonEmpty([])).toBe(false)
      expect(isNonEmpty({})).toBe(false)
    })
  })

  describe('unknown converters', () => {
    it('unknownToString handles strings, numbers, null, undefined', () => {
      expect(unknownToString('a')).toBe('a')
      expect(unknownToString(42)).toBe('42')
      expect(unknownToString(null)).toBe('null')
      expect(unknownToString(undefined)).toBe('undefined')
      expect(unknownToString(true)).toBe('true')
    })

    it('unknownToNumber parses numeric strings, falls back otherwise', () => {
      expect(unknownToNumber(7)).toBe(7)
      expect(unknownToNumber('3.14')).toBe(3.14)
      expect(unknownToNumber('abc', 99)).toBe(99)
      expect(unknownToNumber({}, 0)).toBe(0)
    })

    it('unknownToBoolean parses "true"/"false" strings', () => {
      expect(unknownToBoolean(true)).toBe(true)
      expect(unknownToBoolean('true')).toBe(true)
      expect(unknownToBoolean('TRUE')).toBe(true)
      expect(unknownToBoolean('false')).toBe(false)
      expect(unknownToBoolean('other')).toBe(false)
      expect(unknownToBoolean(null, true)).toBe(true)
    })

    it('unknownToArray returns the array or empty', () => {
      expect(unknownToArray([1, 2])).toEqual([1, 2])
      expect(unknownToArray('not array')).toEqual([])
    })

    it('unknownToObject returns objects or null', () => {
      expect(unknownToObject({ a: 1 })).toEqual({ a: 1 })
      expect(unknownToObject([])).toBeNull()
      expect(unknownToObject(null)).toBeNull()
    })
  })

  describe('parseJSON / stringifyJSON', () => {
    it('parseJSON returns parsed value or default on error', () => {
      expect(parseJSON('{"a":1}')).toEqual({ a: 1 })
      expect(parseJSON('not-json', { fallback: true })).toEqual({ fallback: true })
      expect(parseJSON('not-json')).toBeNull()
    })

    it('stringifyJSON returns string or default on circular', () => {
      const cyclic: Record<string, unknown> = {}
      cyclic.self = cyclic
      expect(stringifyJSON({ a: 1 })).toBe('{"a":1}')
      expect(stringifyJSON(cyclic, '{}')).toBe('{}')
    })
  })

  describe('typeGuard helper', () => {
    it('returns value when guard passes', () => {
      expect(typeGuard<string>('x', (v): v is string => typeof v === 'string', 'fallback')).toBe('x')
    })

    it('returns default when guard fails', () => {
      expect(typeGuard<string>(123, (v): v is string => typeof v === 'string', 'fallback')).toBe('fallback')
    })
  })

  describe('pick / omit / merge', () => {
    it('pick selects only listed keys', () => {
      expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 })
    })

    it('omit removes listed keys', () => {
      expect(omit({ a: 1, b: 2, c: 3 }, ['b'])).toEqual({ a: 1, c: 3 })
    })

    it('merge combines objects with later keys overriding', () => {
      expect(merge({ a: 1, b: 2 }, { b: 99, c: 3 })).toEqual({ a: 1, b: 99, c: 3 })
    })
  })

  describe('deepClone', () => {
    it('clones nested objects by value', () => {
      const src = { a: 1, nested: { b: 2 } }
      const copy = deepClone(src)
      expect(copy).toEqual(src)
      expect(copy).not.toBe(src)
      expect(copy.nested).not.toBe(src.nested)
    })

    it('clones arrays', () => {
      const src = [1, [2, 3]]
      const copy = deepClone(src)
      expect(copy).toEqual(src)
      expect(copy).not.toBe(src)
      expect(copy[1]).not.toBe(src[1])
    })

    it('returns primitives as-is', () => {
      expect(deepClone(5)).toBe(5)
      expect(deepClone('s')).toBe('s')
      expect(deepClone(null)).toBe(null)
      expect(deepClone(undefined)).toBe(undefined)
    })
  })

  describe('isEqual', () => {
    it('returns true for identical primitives', () => {
      expect(isEqual(1, 1)).toBe(true)
      expect(isEqual('a', 'a')).toBe(true)
    })

    it('returns false for differing primitives', () => {
      expect(isEqual(1, 2)).toBe(false)
      expect(isEqual('a', 'b')).toBe(false)
    })

    it('compares arrays deeply', () => {
      expect(isEqual([1, [2, 3]], [1, [2, 3]])).toBe(true)
      expect(isEqual([1, 2], [1, 2, 3])).toBe(false)
    })

    it('compares objects deeply', () => {
      expect(isEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } })).toBe(true)
      expect(isEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
      expect(isEqual({ a: 1 }, { a: 2 })).toBe(false)
    })

    it('returns false when only one side is null', () => {
      expect(isEqual(null, {})).toBe(false)
      expect(isEqual({}, null)).toBe(false)
    })
  })
})
