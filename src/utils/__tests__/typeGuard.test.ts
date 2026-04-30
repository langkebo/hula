import { describe, expect, it } from 'vitest'
import { getProperty, isEmpty, isNumber, isObject, isString, safeGet } from '../typeGuard'

describe('typeGuard', () => {
  describe('isObject', () => {
    it('should return true for object', () => {
      expect(isObject({})).toBe(true)
      expect(isObject({ a: 1 })).toBe(true)
    })

    it('should return false for primitives', () => {
      expect(isObject(null)).toBe(false)
      expect(isObject('string')).toBe(false)
      expect(isObject(123)).toBe(false)
      expect(isObject([])).toBe(false)
      expect(isObject(undefined)).toBe(false)
    })
  })

  describe('isString', () => {
    it('should return true for string', () => {
      expect(isString('hello')).toBe(true)
      expect(isString('')).toBe(true)
    })

    it('should return false for non-string', () => {
      expect(isString(123)).toBe(false)
      expect(isString(null)).toBe(false)
      expect(isString(undefined)).toBe(false)
    })
  })

  describe('isNumber', () => {
    it('should return true for number', () => {
      expect(isNumber(123)).toBe(true)
      expect(isNumber(0)).toBe(true)
      expect(isNumber(-1)).toBe(true)
    })

    it('should return false for NaN and non-number', () => {
      expect(isNumber(NaN)).toBe(false)
      expect(isNumber('123')).toBe(false)
    })
  })

  describe('isEmpty', () => {
    it('should return true for empty values', () => {
      expect(isEmpty(null)).toBe(true)
      expect(isEmpty(undefined)).toBe(true)
      expect(isEmpty('')).toBe(true)
      expect(isEmpty([])).toBe(true)
      expect(isEmpty({})).toBe(true)
    })

    it('should return false for non-empty values', () => {
      expect(isEmpty('hello')).toBe(false)
      expect(isEmpty([1, 2])).toBe(false)
      expect(isEmpty({ a: 1 })).toBe(false)
    })
  })

  describe('getProperty', () => {
    it('should get property safely', () => {
      const obj = { a: 1, b: 'hello' }
      expect(getProperty(obj, 'a')).toBe(1)
      expect(getProperty(obj, 'b')).toBe('hello')
      expect(getProperty(obj, 'c')).toBeUndefined()
    })
  })

  describe('safeGet', () => {
    it('should get nested property', () => {
      const obj = { a: { b: { c: 'deep' } } }
      expect(safeGet(obj, 'a.b.c')).toBe('deep')
      expect(safeGet(obj, 'a.b.d')).toBeUndefined()
    })
  })
})
