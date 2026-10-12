import { describe, expect, it } from 'vitest'
import { addSlashToHead, isValidUrl, truncateMiddle } from '../StringUtils'

describe('StringUtils', () => {
  describe('addSlashToHead', () => {
    it('returns the path unchanged when it already starts with /', () => {
      expect(addSlashToHead('/foo')).toBe('/foo')
      expect(addSlashToHead('/')).toBe('/')
    })

    it('prepends a slash when the path does not start with one', () => {
      expect(addSlashToHead('foo')).toBe('/foo')
      expect(addSlashToHead('foo/bar')).toBe('/foo/bar')
    })

    it('handles empty string by prepending a slash', () => {
      expect(addSlashToHead('')).toBe('/')
    })
  })

  describe('truncateMiddle', () => {
    it('returns the value unchanged when within maxLength', () => {
      expect(truncateMiddle('1234567890')).toBe('1234567890')
      expect(truncateMiddle('a'.repeat(24))).toBe('a'.repeat(24))
    })

    it('keeps head and tail with an ellipsis using default thresholds', () => {
      expect(truncateMiddle('a'.repeat(30))).toBe(`${'a'.repeat(12)}...${'a'.repeat(8)}`)
    })

    it('honours custom thresholds', () => {
      const value = '$abcdefghij0123456789XYZ'
      expect(truncateMiddle(value, 20, 10, 6)).toBe('$abcdefghi...789XYZ')
    })
  })

  describe('isValidUrl', () => {
    it('returns true for parseable URLs', () => {
      expect(isValidUrl('https://example.com/a.png')).toBe(true)
      expect(isValidUrl('mxc://example.com/abc')).toBe(true)
    })

    it('returns false for non-URL strings', () => {
      expect(isValidUrl('not a url')).toBe(false)
      expect(isValidUrl('')).toBe(false)
    })
  })
})
