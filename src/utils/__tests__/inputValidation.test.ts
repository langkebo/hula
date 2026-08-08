import { describe, expect, it } from 'vitest'
import { isNonEmptyString, isValidMatrixRoomId, isValidMatrixUserId } from '../inputValidation'

describe('inputValidation', () => {
  describe('isValidMatrixUserId', () => {
    it('accepts valid user IDs', () => {
      expect(isValidMatrixUserId('@alice:example.com')).toBe(true)
      expect(isValidMatrixUserId('@bob.smith:matrix.org')).toBe(true)
      expect(isValidMatrixUserId('@user123:server-1.io')).toBe(true)
    })

    it('rejects invalid user IDs', () => {
      expect(isValidMatrixUserId('alice:example.com')).toBe(false)
      expect(isValidMatrixUserId('@')).toBe(false)
      expect(isValidMatrixUserId('')).toBe(false)
      expect(isValidMatrixUserId('@alice')).toBe(false)
    })
  })

  describe('isValidMatrixRoomId', () => {
    it('accepts valid room IDs', () => {
      expect(isValidMatrixRoomId('!abc123:example.com')).toBe(true)
    })

    it('rejects invalid room IDs', () => {
      expect(isValidMatrixRoomId('#room:example.com')).toBe(false)
      expect(isValidMatrixRoomId('')).toBe(false)
    })
  })

  describe('isNonEmptyString', () => {
    it('returns true for non-empty strings', () => {
      expect(isNonEmptyString('hello')).toBe(true)
    })

    it('returns false for empty/whitespace/non-strings', () => {
      expect(isNonEmptyString('')).toBe(false)
      expect(isNonEmptyString('   ')).toBe(false)
      expect(isNonEmptyString(null)).toBe(false)
      expect(isNonEmptyString(42)).toBe(false)
    })
  })
})
