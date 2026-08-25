import { describe, expect, it } from 'vitest'
import { validateAlphaNumeric, validatePasswordMinLength, validateSpecialChar, validateUsername } from '../Validate'

describe('Validate', () => {
  describe('validateSpecialChar', () => {
    it('should detect special characters', () => {
      expect(validateSpecialChar('test@')).toBe(true)
      expect(validateSpecialChar('test!')).toBe(true)
      expect(validateSpecialChar('test{}')).toBe(true)
      expect(validateSpecialChar('test<>?')).toBe(true)
    })

    it('should accept string without special characters', () => {
      expect(validateSpecialChar('test123')).toBe(false)
    })

    it('should align with server special char set', () => {
      // 服务端字符集：!@#$%^&*()_+-=[]{}|;:,.<>?（¥ 不在其中）
      expect(validateSpecialChar('test¥')).toBe(false)
    })
  })

  describe('validateAlphaNumeric', () => {
    it('should accept mixed case with digits', () => {
      expect(validateAlphaNumeric('Test123')).toBe(true)
    })

    it('should reject missing uppercase', () => {
      expect(validateAlphaNumeric('test123')).toBe(false)
    })

    it('should reject missing lowercase', () => {
      expect(validateAlphaNumeric('TEST123')).toBe(false)
    })

    it('should reject missing digits', () => {
      expect(validateAlphaNumeric('TestPass')).toBe(false)
      expect(validateAlphaNumeric('test')).toBe(false)
      expect(validateAlphaNumeric('123')).toBe(false)
    })
  })

  describe('validatePasswordMinLength', () => {
    it('should align with server minimum of 8', () => {
      expect(validatePasswordMinLength('Ab1!xyz')).toBe(false)
      expect(validatePasswordMinLength('Ab1!xyz9')).toBe(true)
    })
  })

  describe('validateUsername', () => {
    it('should accept lowercase letters, digits and . _ = - symbols', () => {
      expect(validateUsername('alice')).toBe(true)
      expect(validateUsername('a.b_c=d-e')).toBe(true)
      expect(validateUsername('user123')).toBe(true)
      expect(validateUsername('a1b2c3')).toBe(true)
    })

    it('should reject characters outside the allowed set', () => {
      // 服务端仅允许小写字母、数字和 . _ = -，以下内容应被拒
      expect(validateUsername('Alice')).toBe(false) // 大写
      expect(validateUsername('阿力')).toBe(false) // 中文
      expect(validateUsername('a b')).toBe(false) // 空格
      expect(validateUsername('a@b')).toBe(false) // @ 不在字符集
      expect(validateUsername('UPPER')).toBe(false) // 全大写
    })

    it('should trim surrounding whitespace before testing', () => {
      expect(validateUsername('  alice  ')).toBe(true)
      expect(validateUsername(' Alice ')).toBe(false)
    })

    it('should reject empty or blank input', () => {
      expect(validateUsername('')).toBe(false)
      expect(validateUsername('   ')).toBe(false)
    })
  })
})
