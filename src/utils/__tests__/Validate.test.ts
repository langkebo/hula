import { describe, expect, it } from 'vitest'
import {
  sanitizeInput,
  validateAlphaNumeric,
  validateEmail,
  validateFileSize,
  validateFileType,
  validateMatrixId,
  validatePassword,
  validatePhone,
  validateRoomAlias,
  validateRoomId,
  validateSpecialChar,
  validateUrl,
  validateUsername
} from '../Validate'

describe('Validate 工具', () => {
  describe('validateUsername', () => {
    it('should accept valid username', () => {
      expect(validateUsername('user123').valid).toBe(true)
      expect(validateUsername('test-user').valid).toBe(true)
      expect(validateUsername('test_user').valid).toBe(true)
    })

    it('should reject short username', () => {
      expect(validateUsername('ab').valid).toBe(false)
      expect(validateUsername('').valid).toBe(false)
    })

    it('should reject long username', () => {
      expect(validateUsername('a'.repeat(21)).valid).toBe(false)
    })

    it('should reject invalid characters', () => {
      expect(validateUsername('user@name').valid).toBe(false)
      expect(validateUsername('user name').valid).toBe(false)
    })
  })

  describe('validatePassword', () => {
    it('should accept strong password', () => {
      expect(validatePassword('Password123').valid).toBe(true)
      expect(validatePassword('Test@1234').valid).toBe(true)
    })

    it('should reject short password', () => {
      expect(validatePassword('pass').valid).toBe(false)
      expect(validatePassword('').valid).toBe(false)
    })

    it('should reject long password', () => {
      expect(validatePassword('a'.repeat(129)).valid).toBe(false)
    })

    it('should reject weak password', () => {
      expect(validatePassword('password').valid).toBe(false)
      expect(validatePassword('12345678').valid).toBe(false)
    })
  })

  describe('validateEmail', () => {
    it('should accept valid email', () => {
      expect(validateEmail('test@example.com').valid).toBe(true)
      expect(validateEmail('user.name@example.co.uk').valid).toBe(true)
    })

    it('should reject invalid email', () => {
      expect(validateEmail('').valid).toBe(false)
      expect(validateEmail('invalid').valid).toBe(false)
      expect(validateEmail('invalid@').valid).toBe(false)
      expect(validateEmail('@example.com').valid).toBe(false)
    })
  })

  describe('validatePhone', () => {
    it('should accept valid phone', () => {
      expect(validatePhone('13800138000').valid).toBe(true)
      expect(validatePhone('+86 138 0013 8000').valid).toBe(true)
    })

    it('should reject invalid phone', () => {
      expect(validatePhone('').valid).toBe(false)
      expect(validatePhone('abc').valid).toBe(false)
    })
  })

  describe('validateUrl', () => {
    it('should accept valid URL', () => {
      expect(validateUrl('https://example.com').valid).toBe(true)
      expect(validateUrl('http://example.com/path').valid).toBe(true)
    })

    it('should reject invalid URL', () => {
      expect(validateUrl('').valid).toBe(false)
      expect(validateUrl('not-a-url').valid).toBe(false)
    })
  })

  describe('validateMatrixId', () => {
    it('should accept valid Matrix ID', () => {
      expect(validateMatrixId('@user:example.com').valid).toBe(true)
      expect(validateMatrixId('@user:matrix.org').valid).toBe(true)
    })

    it('should reject invalid Matrix ID', () => {
      expect(validateMatrixId('').valid).toBe(false)
      expect(validateMatrixId('user:example.com').valid).toBe(false)
      expect(validateMatrixId('@user').valid).toBe(false)
    })
  })

  describe('validateRoomId', () => {
    it('should accept valid Room ID', () => {
      expect(validateRoomId('!room:example.com').valid).toBe(true)
    })

    it('should reject invalid Room ID', () => {
      expect(validateRoomId('').valid).toBe(false)
      expect(validateRoomId('room:example.com').valid).toBe(false)
    })
  })

  describe('validateRoomAlias', () => {
    it('should accept valid Room Alias', () => {
      expect(validateRoomAlias('#room:example.com').valid).toBe(true)
    })

    it('should reject invalid Room Alias', () => {
      expect(validateRoomAlias('').valid).toBe(false)
      expect(validateRoomAlias('room:example.com').valid).toBe(false)
    })
  })

  describe('sanitizeInput', () => {
    it('should escape HTML characters', () => {
      expect(sanitizeInput('<script>')).toBe('&lt;script&gt;')
      expect(sanitizeInput('a > b')).toBe('a &gt; b')
      expect(sanitizeInput('"quote"')).toBe('&quot;quote&quot;')
    })

    it('should handle empty string', () => {
      expect(sanitizeInput('')).toBe('')
    })
  })

  describe('validateFileType', () => {
    it('should accept allowed file types', () => {
      expect(validateFileType('image.png', ['png', 'jpg', 'gif']).valid).toBe(true)
      expect(validateFileType('document.pdf', ['pdf', 'doc']).valid).toBe(true)
    })

    it('should reject disallowed file types', () => {
      expect(validateFileType('file.exe', ['png', 'jpg']).valid).toBe(false)
    })
  })

  describe('validateFileSize', () => {
    it('should accept file within size limit', () => {
      expect(validateFileSize(1024 * 1024, 2).valid).toBe(true) // 1MB within 2MB
    })

    it('should reject file exceeding size limit', () => {
      expect(validateFileSize(3 * 1024 * 1024, 2).valid).toBe(false) // 3MB exceeds 2MB
    })
  })

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
