import { describe, expect, it } from 'vitest'
import {
  clampNumber,
  isNonEmptyString,
  isValidEmail,
  isValidMatrixEventId,
  isValidMatrixRoomId,
  isValidMatrixUserId,
  isValidUrl,
  sanitizeDisplayName,
  sanitizeForLog,
  sanitizeHtml,
  validatePagination
} from '../inputValidation'

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

  describe('isValidMatrixEventId', () => {
    it('accepts valid event IDs', () => {
      expect(isValidMatrixEventId('$abc123def')).toBe(true)
      expect(isValidMatrixEventId('$abc/def+ghi_jkl-mno')).toBe(true)
    })

    it('rejects invalid event IDs', () => {
      expect(isValidMatrixEventId('abc123')).toBe(false)
      expect(isValidMatrixEventId('')).toBe(false)
    })
  })

  describe('isValidEmail', () => {
    it('accepts valid emails', () => {
      expect(isValidEmail('user@example.com')).toBe(true)
      expect(isValidEmail('a.b+c@d.co')).toBe(true)
    })

    it('rejects invalid emails', () => {
      expect(isValidEmail('not-an-email')).toBe(false)
      expect(isValidEmail('@missing.user')).toBe(false)
      expect(isValidEmail('')).toBe(false)
    })
  })

  describe('isValidUrl', () => {
    it('accepts valid URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true)
      expect(isValidUrl('http://localhost:28008')).toBe(true)
    })

    it('rejects invalid URLs', () => {
      expect(isValidUrl('ftp://example.com')).toBe(false)
      expect(isValidUrl('not a url')).toBe(false)
    })
  })

  describe('sanitizeHtml', () => {
    it('escapes HTML entities', () => {
      expect(sanitizeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
    })

    it('escapes single quotes', () => {
      expect(sanitizeHtml("it's")).toBe('it&#39;s')
    })

    it('handles ampersands', () => {
      expect(sanitizeHtml('a & b')).toBe('a &amp; b')
    })
  })

  describe('sanitizeForLog', () => {
    it('truncates long strings', () => {
      const long = 'a'.repeat(300)
      const result = sanitizeForLog(long)
      expect(result.length).toBe(203)
      expect(result.endsWith('...')).toBe(true)
    })

    it('strips newlines', () => {
      expect(sanitizeForLog('line1\nline2\rline3')).toBe('line1 line2 line3')
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

  describe('clampNumber', () => {
    it('clamps correctly', () => {
      expect(clampNumber(5, 0, 10)).toBe(5)
      expect(clampNumber(-1, 0, 10)).toBe(0)
      expect(clampNumber(20, 0, 10)).toBe(10)
    })
  })

  describe('sanitizeDisplayName', () => {
    it('trims and truncates', () => {
      expect(sanitizeDisplayName('  hello  ')).toBe('hello')
      expect(sanitizeDisplayName('a'.repeat(100), 10)).toBe('a'.repeat(10))
    })
  })

  describe('validatePagination', () => {
    it('uses defaults when no params', () => {
      expect(validatePagination({})).toEqual({ limit: 50, offset: 0 })
    })

    it('clamps out-of-range values', () => {
      expect(validatePagination({ limit: 9999, offset: -5 })).toEqual({ limit: 1000, offset: 0 })
      expect(validatePagination({ limit: 0 })).toEqual({ limit: 1, offset: 0 })
    })
  })
})
