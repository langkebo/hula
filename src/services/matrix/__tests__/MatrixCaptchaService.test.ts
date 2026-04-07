import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matrixCaptchaService } from '../MatrixCaptchaService'

const mockAuthedRequest = vi.fn()

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(() => ({
      http: {
        authedRequest: mockAuthedRequest
      }
    }))
  }
}))

describe('MatrixCaptchaService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getCaptcha', () => {
    it('should get captcha', async () => {
      mockAuthedRequest.mockResolvedValueOnce({
        captcha_id: 'captcha123',
        type: 'image',
        data: 'data:image/png;base64,abc',
        expires_in: 300
      })

      const result = await matrixCaptchaService.getCaptcha()

      expect(result).toBeTruthy()
      expect(result?.captchaId).toBe('captcha123')
      expect(result?.type).toBe('image')
    })

    it('should return null on error', async () => {
      mockAuthedRequest.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixCaptchaService.getCaptcha()

      expect(result).toBeNull()
    })
  })

  describe('sendCaptcha', () => {
    it('should send captcha', async () => {
      mockAuthedRequest.mockResolvedValueOnce({})

      const result = await matrixCaptchaService.sendCaptcha('test@example.com', 'email')

      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      mockAuthedRequest.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixCaptchaService.sendCaptcha('test@example.com', 'email')

      expect(result).toBe(false)
    })
  })

  describe('verify', () => {
    it('should verify captcha', async () => {
      mockAuthedRequest.mockResolvedValueOnce({
        valid: true
      })

      const result = await matrixCaptchaService.verify({
        captchaId: 'captcha123',
        solution: 'ABC123'
      })

      expect(result).toBe(true)
    })

    it('should return false when invalid', async () => {
      mockAuthedRequest.mockResolvedValueOnce({
        valid: false
      })

      const result = await matrixCaptchaService.verify({
        captchaId: 'captcha123',
        solution: 'wrong'
      })

      expect(result).toBe(false)
    })

    it('should return false on error', async () => {
      mockAuthedRequest.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixCaptchaService.verify({
        captchaId: 'captcha123',
        solution: 'ABC123'
      })

      expect(result).toBe(false)
    })
  })

  describe('invalidate', () => {
    it('should invalidate captcha', async () => {
      mockAuthedRequest.mockResolvedValueOnce({})

      const result = await matrixCaptchaService.invalidate('captcha123')

      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      mockAuthedRequest.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixCaptchaService.invalidate('captcha123')

      expect(result).toBe(false)
    })
  })

  describe('isRequired', () => {
    it('should check if captcha is required', async () => {
      mockAuthedRequest.mockResolvedValueOnce({
        required: true
      })

      const result = await matrixCaptchaService.isRequired()

      expect(result).toBe(true)
    })

    it('should return false when not required', async () => {
      mockAuthedRequest.mockResolvedValueOnce({
        required: false
      })

      const result = await matrixCaptchaService.isRequired()

      expect(result).toBe(false)
    })

    it('should return false on error', async () => {
      mockAuthedRequest.mockRejectedValueOnce(new Error('Network error'))

      const result = await matrixCaptchaService.isRequired()

      expect(result).toBe(false)
    })
  })
})
