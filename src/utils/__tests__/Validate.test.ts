import { describe, expect, it } from 'vitest'
import { validateAlphaNumeric, validateSpecialChar } from '../Validate'

describe('Validate', () => {
  describe('validateSpecialChar', () => {
    it('should detect special characters', () => {
      expect(validateSpecialChar('test@')).toBe(true)
      expect(validateSpecialChar('test!')).toBe(true)
    })

    it('should accept string without special characters', () => {
      expect(validateSpecialChar('test123')).toBe(false)
    })
  })

  describe('validateAlphaNumeric', () => {
    it('should accept alphanumeric', () => {
      expect(validateAlphaNumeric('test123')).toBe(true)
    })

    it('should reject non-alphanumeric', () => {
      expect(validateAlphaNumeric('test')).toBe(false)
      expect(validateAlphaNumeric('123')).toBe(false)
    })
  })
})
