import { describe, expect, it } from 'vitest'
import { getBodyContent, getBodyTranslatedText, getBodyUrl, isMessageBody, toMessageBody } from '../messageBody'

describe('messageBody', () => {
  describe('isMessageBody', () => {
    it('should return true for valid MessageBody', () => {
      expect(isMessageBody({ content: 'hello' })).toBe(true)
      expect(isMessageBody({ body: 'hello' })).toBe(true)
      expect(isMessageBody({ url: 'http://example.com' })).toBe(true)
      expect(isMessageBody({ reply: { id: '123', roomId: 'room' } })).toBe(true)
    })

    it('should return false for invalid values', () => {
      expect(isMessageBody('string')).toBe(false)
      expect(isMessageBody(123)).toBe(false)
      expect(isMessageBody(null)).toBe(false)
      expect(isMessageBody(undefined)).toBe(false)
    })
  })

  describe('toMessageBody', () => {
    it('should convert string to MessageBody', () => {
      const result = toMessageBody('hello')
      expect(result).toEqual({ content: 'hello' })
    })

    it('should pass through valid MessageBody', () => {
      const input = { content: 'hello', url: 'http://example.com' }
      const result = toMessageBody(input)
      expect(result).toBe(input)
    })

    it('should convert object to MessageBody', () => {
      const result = toMessageBody({ custom: 'field' })
      expect(result).toEqual({ custom: 'field' })
    })

    it('should handle null/undefined', () => {
      expect(toMessageBody(null)).toEqual({ content: 'null' })
      expect(toMessageBody(undefined)).toEqual({ content: 'undefined' })
    })
  })

  describe('getBodyContent', () => {
    it('should extract content from MessageBody', () => {
      expect(getBodyContent({ content: 'hello' })).toBe('hello')
    })

    it('should fallback to body', () => {
      expect(getBodyContent({ body: 'world' })).toBe('world')
    })

    it('should convert string to content', () => {
      expect(getBodyContent('hello')).toBe('hello')
    })

    it('should return empty string for empty', () => {
      expect(getBodyContent({})).toBe('')
    })
  })

  describe('getBodyUrl', () => {
    it('should extract url', () => {
      expect(getBodyUrl({ url: 'http://example.com/image.png' })).toBe('http://example.com/image.png')
    })

    it('should return empty string for missing url', () => {
      expect(getBodyUrl({ content: 'hello' })).toBe('')
    })
  })

  describe('getBodyTranslatedText', () => {
    it('should extract translatedText', () => {
      const translated = { text: '翻译', provider: 'Google', from: 'en', to: 'zh' }
      expect(getBodyTranslatedText({ translatedText: translated })).toEqual(translated)
    })

    it('should return null for missing translatedText', () => {
      expect(getBodyTranslatedText({ content: 'hello' })).toBeNull()
    })
  })
})
