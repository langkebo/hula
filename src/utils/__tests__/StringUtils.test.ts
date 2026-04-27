import { describe, expect, it } from 'vitest'
import { addSlashToHead } from '../StringUtils'

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
})
