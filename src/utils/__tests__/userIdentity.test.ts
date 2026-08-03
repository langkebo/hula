import { describe, expect, it } from 'vitest'
import { normalizeMatrixUserId, toLocalpart } from '../userIdentity'

describe('userIdentity', () => {
  describe('toLocalpart', () => {
    it('extracts localpart from a full MXID', () => {
      expect(toLocalpart('@hulatest:matrix.test')).toBe('hulatest')
    })

    it('returns the input unchanged when it is already a localpart', () => {
      expect(toLocalpart('hulatest')).toBe('hulatest')
    })

    it('returns empty string for empty input', () => {
      expect(toLocalpart('')).toBe('')
    })

    it('returns empty string for undefined', () => {
      expect(toLocalpart(undefined)).toBe('')
    })

    it('returns empty string for null', () => {
      expect(toLocalpart(null)).toBe('')
    })

    it('extracts localpart from a multi-segment server name', () => {
      expect(toLocalpart('@test:server.com')).toBe('test')
    })

    it('trims surrounding whitespace before extracting localpart', () => {
      expect(toLocalpart('  @hulatest:matrix.test  ')).toBe('hulatest')
    })
  })

  describe('normalizeMatrixUserId', () => {
    it('returns the value unchanged when it is already a full MXID', () => {
      expect(normalizeMatrixUserId('@ljf1:matrix.test', '@me:matrix.test')).toBe('@ljf1:matrix.test')
    })

    it('builds a full MXID from a localpart using the current user server name', () => {
      expect(normalizeMatrixUserId('ljf1', '@me:matrix.test')).toBe('@ljf1:matrix.test')
    })

    it('returns empty string for empty value', () => {
      expect(normalizeMatrixUserId('', '@me:matrix.test')).toBe('')
    })

    it('returns empty string for undefined value', () => {
      expect(normalizeMatrixUserId(undefined, '@me:matrix.test')).toBe('')
    })

    it('returns trimmed value when currentUserId is not provided', () => {
      expect(normalizeMatrixUserId('ljf1')).toBe('ljf1')
    })

    it('returns trimmed value when currentUserId has no server name', () => {
      expect(normalizeMatrixUserId('ljf1', 'ljf1')).toBe('ljf1')
    })
  })
})
