import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matrixCaptchaService } from '../MatrixCaptchaService'

// Mock MatrixClientService
vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(() => ({
      http: {
        authedRequest: vi.fn()
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
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({
        captcha_id: 'captcha123',
        type: 'image',
        data: 'data:image/png;base64,abc'
      })

      const result = await matrixCaptchaService.getCaptcha()

      expect(result).toBeTruthy()
      expect(result?.captchaId).toBe('captcha123')
      expect(result?.type).toBe('image')
    })
  })

  describe('sendCaptcha', () => {
    it('should send captcha', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({})

      const result = await matrixCaptchaService.sendCaptcha('test@example.com', 'email')

      expect(result).toBe(true)
    })
  })

  describe('verify', () => {
    it('should verify captcha', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({
        valid: true
      })

      const result = await matrixCaptchaService.verify({
        captchaId: 'captcha123',
        solution: 'ABC123'
      })

      expect(result).toBe(true)
    })
  })

  describe('invalidate', () => {
    it('should invalidate captcha', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({})

      const result = await matrixCaptchaService.invalidate('captcha123')

      expect(result).toBe(true)
    })
  })

  describe('isRequired', () => {
    it('should check if captcha is required', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({
        required: true
      })

      const result = await matrixCaptchaService.isRequired()

      expect(result).toBe(true)
    })
  })
})
