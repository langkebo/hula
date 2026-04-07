import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MatrixAuthService, matrixLogin, matrixRegister } from '../MatrixAuthService'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

import { invoke } from '@tauri-apps/api/core'

const mockInvoke = invoke as ReturnType<typeof vi.fn>

describe('MatrixAuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('matrixLogin', () => {
    it('should call invoke with correct parameters', async () => {
      const mockResult = {
        user_id: '@test:matrix.org',
        access_token: 'token123',
        device_id: 'device123'
      }
      mockInvoke.mockResolvedValueOnce(mockResult)

      const result = await matrixLogin('testuser', 'password123')

      expect(mockInvoke).toHaveBeenCalledWith('matrix_login', {
        username: 'testuser',
        password: 'password123',
        deviceId: undefined,
        deviceName: undefined
      })
      expect(result).toEqual(mockResult)
    })

    it('should pass optional parameters', async () => {
      const mockResult = {
        user_id: '@test:matrix.org',
        access_token: 'token123',
        device_id: 'custom-device'
      }
      mockInvoke.mockResolvedValueOnce(mockResult)

      const result = await matrixLogin('testuser', 'password123', 'custom-device', 'My Device')

      expect(mockInvoke).toHaveBeenCalledWith('matrix_login', {
        username: 'testuser',
        password: 'password123',
        deviceId: 'custom-device',
        deviceName: 'My Device'
      })
      expect(result.device_id).toBe('custom-device')
    })

    it('should throw error on login failure', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Invalid password'))

      await expect(matrixLogin('testuser', 'wrongpassword')).rejects.toThrow('Invalid password')
    })
  })

  describe('matrixRegister', () => {
    it('should call invoke with correct parameters', async () => {
      const mockResult = {
        user_id: '@newuser:matrix.org',
        access_token: 'token123',
        device_id: 'device123'
      }
      mockInvoke.mockResolvedValueOnce(mockResult)

      const result = await matrixRegister('newuser', 'password123')

      expect(mockInvoke).toHaveBeenCalledWith('matrix_register', {
        username: 'newuser',
        password: 'password123',
        session: undefined,
        authType: undefined,
        authToken: undefined
      })
      expect(result).toEqual(mockResult)
    })

    it('should pass auth parameters for captcha flow', async () => {
      const mockResult = {
        user_id: '@newuser:matrix.org'
      }
      mockInvoke.mockResolvedValueOnce(mockResult)

      await matrixRegister('newuser', 'password123', 'session123', 'm.login.recaptcha', 'captcha-token')

      expect(mockInvoke).toHaveBeenCalledWith('matrix_register', {
        username: 'newuser',
        password: 'password123',
        session: 'session123',
        authType: 'm.login.recaptcha',
        authToken: 'captcha-token'
      })
    })
  })

  describe('MatrixAuthService class', () => {
    describe('generateClientSecret', () => {
      it('should generate 43 character string', () => {
        const secret1 = (MatrixAuthService as any).generateClientSecret()
        const secret2 = (MatrixAuthService as any).generateClientSecret()

        expect(secret1.length).toBe(43)
        expect(secret2.length).toBe(43)
        expect(secret1).not.toBe(secret2)
      })
    })

    describe('login', () => {
      it('should call matrixLogin with correct parameters', async () => {
        const mockResult = {
          user_id: '@test:matrix.org',
          access_token: 'token123',
          device_id: 'device123'
        }
        mockInvoke.mockResolvedValueOnce(mockResult)

        const result = await MatrixAuthService.login('testuser', 'password123', 'device-id', 'Device Name')

        expect(result).toEqual(mockResult)
      })
    })

    describe('register', () => {
      it('should call matrixRegister with correct parameters', async () => {
        const mockResult = {
          user_id: '@newuser:matrix.org'
        }
        mockInvoke.mockResolvedValueOnce(mockResult)

        const result = await MatrixAuthService.register('newuser', 'password123')

        expect(result).toEqual(mockResult)
      })
    })

    describe('requestEmailToken', () => {
      it('should call invoke with generated client secret', async () => {
        const mockResult = {
          sid: 'session-id-123',
          submit_url: 'https://matrix.org/submit',
          expires_in: 3600
        }
        mockInvoke.mockResolvedValueOnce(mockResult)

        const result = await MatrixAuthService.requestEmailToken('test@example.com')

        expect(mockInvoke).toHaveBeenCalledWith('matrix_request_email_token', {
          email: 'test@example.com',
          clientSecret: expect.stringMatching(/^[A-Za-z0-9]{43}$/),
          sendAttempt: 1
        })
        expect(result).toEqual(mockResult)
      })

      it('should accept custom sendAttempt', async () => {
        const mockResult = {
          sid: 'session-id-123'
        }
        mockInvoke.mockResolvedValueOnce(mockResult)

        await MatrixAuthService.requestEmailToken('test@example.com', 3)

        expect(mockInvoke).toHaveBeenCalledWith('matrix_request_email_token', {
          email: 'test@example.com',
          clientSecret: expect.any(String),
          sendAttempt: 3
        })
      })
    })

    describe('getCaptcha', () => {
      it('should call invoke and return captcha result', async () => {
        const mockResult = {
          session: 'session-123',
          api_path: '/api/captcha',
          mxc_url: 'mxc://matrix.org/captcha/123'
        }
        mockInvoke.mockResolvedValueOnce(mockResult)

        const result = await MatrixAuthService.getCaptcha()

        expect(mockInvoke).toHaveBeenCalledWith('matrix_get_captcha')
        expect(result).toEqual(mockResult)
      })
    })

    describe('forgetPassword', () => {
      it('should call invoke with email', async () => {
        mockInvoke.mockResolvedValueOnce({})

        await MatrixAuthService.forgetPassword('test@example.com')

        expect(mockInvoke).toHaveBeenCalledWith('matrix_forget_password', {
          email: 'test@example.com'
        })
      })
    })

    describe('resetPassword', () => {
      it('should call invoke with correct parameters', async () => {
        mockInvoke.mockResolvedValueOnce({})

        await MatrixAuthService.resetPassword(
          'newPassword123',
          'oldPassword123',
          'session123',
          'm.login.password',
          'token123'
        )

        expect(mockInvoke).toHaveBeenCalledWith('matrix_reset_password', {
          oldPassword: 'oldPassword123',
          newPassword: 'newPassword123',
          authSession: 'session123',
          authType: 'm.login.password',
          authToken: 'token123'
        })
      })

      it('should work without oldPassword', async () => {
        mockInvoke.mockResolvedValueOnce({})

        await MatrixAuthService.resetPassword('newPassword123')

        expect(mockInvoke).toHaveBeenCalledWith('matrix_reset_password', {
          oldPassword: undefined,
          newPassword: 'newPassword123',
          authSession: undefined,
          authType: undefined,
          authToken: undefined
        })
      })
    })
  })
})
