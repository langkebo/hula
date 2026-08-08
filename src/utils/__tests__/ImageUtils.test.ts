import { describe, expect, it } from 'vitest'
import { compressImage, detectImageFormat, isImageFile, isImageUrl } from '../ImageUtils'

describe('ImageUtils', () => {
  describe('detectImageFormat', () => {
    it('should detect JPEG format', () => {
      expect(detectImageFormat('image.jpg')).toBe('JPEG')
      expect(detectImageFormat('image.jpeg')).toBe('JPEG')
    })

    it('should detect PNG format', () => {
      expect(detectImageFormat('image.png')).toBe('PNG')
    })

    it('should detect GIF format', () => {
      expect(detectImageFormat('image.gif')).toBe('GIF')
    })

    it('should detect WebP format', () => {
      expect(detectImageFormat('image.webp')).toBe('WEBP')
    })

    it('should return UNKNOWN for unknown formats', () => {
      expect(detectImageFormat('image.xyz')).toBe('UNKNOWN')
    })
  })

  describe('isImageUrl', () => {
    it('should return true for image URLs', () => {
      expect(isImageUrl('https://example.com/image.jpg')).toBe(true)
      expect(isImageUrl('https://example.com/image.png')).toBe(true)
      expect(isImageUrl('https://example.com/image.gif')).toBe(true)
    })

    it('should return true for data URLs', () => {
      expect(isImageUrl('data:image/png;base64,abc123')).toBe(true)
    })

    it('should return false for non-image URLs', () => {
      expect(isImageUrl('https://example.com/page.html')).toBe(false)
      expect(isImageUrl('https://example.com/doc.pdf')).toBe(false)
    })
  })

  // formatFileSize 已统一到 Formatting.formatBytes，相关断言见 Formatting.test.ts

  describe('isImageFile', () => {
    it('should return true for image file extensions', () => {
      expect(isImageFile('image.jpg')).toBe(true)
      expect(isImageFile('image.png')).toBe(true)
      expect(isImageFile('image.gif')).toBe(true)
      expect(isImageFile('image.webp')).toBe(true)
    })

    it('should return true for File objects with image type', () => {
      const file = new File([''], 'test.png', { type: 'image/png' })
      expect(isImageFile(file)).toBe(true)
    })

    it('should return false for non-image files', () => {
      expect(isImageFile('document.pdf')).toBe(false)
      expect(isImageFile('video.mp4')).toBe(false)
    })

    it('should handle case insensitive extensions', () => {
      expect(isImageFile('image.JPG')).toBe(true)
      expect(isImageFile('image.PNG')).toBe(true)
    })
  })

  describe('compressImage', () => {
    it('should compress image file', async () => {
      // Create a simple image file for testing
      const canvas = document.createElement('canvas')
      canvas.width = 100
      canvas.height = 100
      const ctx = canvas.getContext('2d')
      ctx?.fillRect(0, 0, 100, 100)

      canvas.toBlob(async (blob) => {
        if (blob) {
          const file = new File([blob], 'test.png', { type: 'image/png' })
          const result = await compressImage(file, { quality: 0.5 })

          expect(result).toBeTruthy()
          expect(result.width).toBe(100)
          expect(result.height).toBe(100)
          expect(result.blob).toBeInstanceOf(Blob)
        }
      }, 'image/png')
    }, 10000) // Increase timeout for browser test
  })
})
