import type { MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import { MatrixAuthService } from '../MatrixAuthService'

const TEST_BASE_URL = 'https://matrix.test'

const server = setupMswServer(
  http.post(`${TEST_BASE_URL}/_matrix/client/v3/login`, () => {
    return HttpResponse.json({
      user_id: '@test:matrix.org',
      access_token: 'token123',
      device_id: 'device123'
    })
  }),
  http.post(`${TEST_BASE_URL}/_matrix/client/v3/register`, () => {
    return HttpResponse.json({
      user_id: '@newuser:matrix.org'
    })
  }),
  http.post(`${TEST_BASE_URL}/_matrix/client/v3/register/email/requestToken`, () => {
    return HttpResponse.json({
      sid: 'session-id-123',
      submit_url: 'https://matrix.org/submit',
      expires_in: 3600
    })
  }),
  http.post(`${TEST_BASE_URL}/_matrix/client/v3/account/password/email/requestToken`, () => {
    return HttpResponse.json({
      sid: 'reset-session-id-123'
    })
  }),
  http.post(`${TEST_BASE_URL}/_matrix/client/v3/account/password`, () => {
    return HttpResponse.json({ success: true })
  }),
  http.post(`${TEST_BASE_URL}/_matrix/client/v3/account/password/email/submitToken`, () => {
    return HttpResponse.json({ success: true })
  }),
  http.post(`${TEST_BASE_URL}/_matrix/client/v3/register/email/submitToken`, () => {
    return HttpResponse.json({ success: true })
  }),
  http.post(`${TEST_BASE_URL}/_matrix/client/v3/register/captcha/send`, () => {
    return HttpResponse.json({
      captcha_type: 'm.login.recaptcha',
      public_key: 'test_key',
      session: 'session-123',
      api_path: '/api/captcha',
      mxc_url: 'mxc://matrix.org/captcha/123'
    })
  })
)

const { mockSdk } = vi.hoisted(() => ({
  mockSdk: {
    createClient: vi.fn()
  }
}))

vi.mock('matrix-js-sdk', () => ({
  ...mockSdk,
  default: mockSdk
}))

import * as sdk from 'matrix-js-sdk'
import matrixClientService from '../../MatrixClientService'

describe('MatrixAuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
    vi.spyOn(matrixClientService, 'getHomeserverUrl').mockReturnValue(TEST_BASE_URL)
    vi.spyOn(matrixClientService, 'login')
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('MatrixAuthService class', () => {
    describe('generateClientSecret', () => {
      it('should generate 43 character string', () => {
        const secret1 = (MatrixAuthService as unknown as { generateClientSecret: () => string }).generateClientSecret()
        const secret2 = (MatrixAuthService as unknown as { generateClientSecret: () => string }).generateClientSecret()

        expect(secret1.length).toBe(43)
        expect(secret2.length).toBe(43)
        expect(secret1).not.toBe(secret2)
      })
    })

    describe('login', () => {
      it('should prefer sdk login request when client is not initialized', async () => {
        const loginRequest = vi.fn().mockResolvedValue({
          user_id: '@test:matrix.org',
          access_token: 'token123',
          device_id: 'device123'
        })

        vi.mocked(sdk.createClient).mockReturnValue({
          loginRequest
        } as unknown as sdk.MatrixClient)

        const result = await MatrixAuthService.login('testuser', 'password123', 'device-id', 'Device Name')

        expect(loginRequest).toHaveBeenCalledWith({
          type: 'm.login.password',
          user: 'testuser',
          password: 'password123',
          device_id: 'device-id',
          initial_display_name: 'Device Name'
        })
        expect(result).toEqual({
          user_id: '@test:matrix.org',
          access_token: 'token123',
          device_id: 'device123'
        })
      })

      it('should surface sdk login matrix error without falling back to homeserver', async () => {
        const loginRequest = vi.fn().mockRejectedValue(
          Object.assign(new Error('Invalid username or password'), {
            errcode: 'M_FORBIDDEN',
            error: 'Invalid username or password',
            httpStatus: 403
          })
        )

        vi.spyOn(sdk, 'createClient').mockReturnValue({
          loginRequest
        } as unknown as sdk.MatrixClient)

        await expect(MatrixAuthService.login('testuser', 'wrongpassword')).rejects.toThrow(
          '登录失败 (403): Invalid username or password [M_FORBIDDEN] (认证信息无效或当前操作无权限)'
        )
      })

      it('should fall back to homeserver login when sdk throws runtime error', async () => {
        const loginRequest = vi.fn().mockRejectedValue(new Error('sdk bootstrap failed'))
        vi.spyOn(sdk, 'createClient').mockReturnValue({
          loginRequest
        } as unknown as MatrixClient)

        const result = await MatrixAuthService.login('testuser', 'password123', 'device-id', 'Device Name')

        expect(result).toEqual({
          user_id: '@test:matrix.org',
          access_token: 'token123',
          device_id: 'device123'
        })
      })

      it('should keep using matrix client service when initialized', async () => {
        vi.mocked(matrixClientService.getClient).mockReturnValue({} as unknown as MatrixClient)
        vi.mocked(matrixClientService.login).mockResolvedValueOnce({
          success: true,
          userId: '@test:matrix.org',
          accessToken: 'token123',
          deviceId: 'device123'
        })

        const result = await MatrixAuthService.login('testuser', 'password123', 'device-id', 'Device Name')

        expect(result).toEqual({
          user_id: '@test:matrix.org',
          access_token: 'token123',
          device_id: 'device123'
        })
      })

      it('should call matrixLogin with correct parameters', async () => {
        const result = await MatrixAuthService.login('testuser', 'password123', 'device-id', 'Device Name')

        expect(result).toEqual({
          user_id: '@test:matrix.org',
          access_token: 'token123',
          device_id: 'device123'
        })
      })
    })

    describe('register', () => {
      it('should prefer sdk register request when available', async () => {
        const registerRequest = vi.fn().mockResolvedValue({
          user_id: '@newuser:matrix.org',
          access_token: 'token123'
        })

        vi.mocked(sdk.createClient).mockReturnValue({
          registerRequest
        } as unknown as sdk.MatrixClient)

        const result = await MatrixAuthService.register('newuser', 'password123')

        expect(registerRequest).toHaveBeenCalledWith({
          type: 'm.login.dummy',
          session: undefined,
          username: 'newuser',
          password: 'password123',
          initial_device_display_name: 'HuLa Desktop',
          auth: undefined
        })
        expect(result).toEqual({
          user_id: '@newuser:matrix.org',
          access_token: 'token123'
        })
      })

      it('should surface sdk register matrix error without falling back to homeserver', async () => {
        const registerRequest = vi.fn().mockRejectedValue(
          Object.assign(new Error('User ID already taken'), {
            errcode: 'M_USER_IN_USE',
            error: 'User ID already taken',
            httpStatus: 400
          })
        )

        vi.spyOn(sdk, 'createClient').mockReturnValue({
          registerRequest
        } as unknown as sdk.MatrixClient)

        await expect(MatrixAuthService.register('newuser', 'password123')).rejects.toThrow(
          '注册失败 (400): User ID already taken [M_USER_IN_USE] (用户名已被占用)'
        )
      })

      it('should fall back to homeserver register when sdk throws runtime error', async () => {
        const registerRequest = vi.fn().mockRejectedValue(new Error('sdk bootstrap failed'))
        vi.spyOn(sdk, 'createClient').mockReturnValue({
          registerRequest
        } as unknown as MatrixClient)

        const result = await MatrixAuthService.register('newuser', 'password123')

        expect(result).toEqual({
          user_id: '@newuser:matrix.org'
        })
      })

      it('should call matrixRegister with correct parameters', async () => {
        const result = await MatrixAuthService.register('newuser', 'password123')

        expect(result).toEqual({
          user_id: '@newuser:matrix.org'
        })
      })
    })

    describe('requestEmailToken', () => {
      it('should prefer sdk register email token request when available', async () => {
        const requestRegisterEmailToken = vi.fn().mockResolvedValue({
          sid: 'sdk-session-id-123',
          submit_url: 'https://matrix.org/submit'
        })

        vi.mocked(sdk.createClient).mockReturnValue({
          requestRegisterEmailToken
        } as unknown as sdk.MatrixClient)

        const result = await MatrixAuthService.requestEmailToken('test@example.com', 2, 'secret123')

        expect(requestRegisterEmailToken).toHaveBeenCalledWith('test@example.com', 'secret123', 2)
        expect(result).toEqual({
          sid: 'sdk-session-id-123',
          submit_url: 'https://matrix.org/submit',
          client_secret: 'secret123'
        })
      })

      it('should request email token through homeserver', async () => {
        const result = await MatrixAuthService.requestEmailToken('test@example.com')

        expect(result).toMatchObject({
          sid: 'session-id-123',
          submit_url: 'https://matrix.org/submit',
          expires_in: 3600
        })
        expect(result.client_secret).toHaveLength(43)
      })

      it('should surface sdk matrix error without falling back to homeserver', async () => {
        const requestRegisterEmailToken = vi.fn().mockRejectedValue(
          Object.assign(new Error('Email already used'), {
            errcode: 'M_THREEPID_IN_USE',
            error: 'Email already used',
            httpStatus: 400
          })
        )

        vi.spyOn(sdk, 'createClient').mockReturnValue({
          requestRegisterEmailToken
        } as unknown as sdk.MatrixClient)

        await expect(MatrixAuthService.requestEmailToken('test@example.com', 1, 'secret123')).rejects.toThrow(
          '请求邮箱令牌失败 (400): Email already used [M_THREEPID_IN_USE] (邮箱已被使用)'
        )
      })

      it('should accept custom sendAttempt', async () => {
        let requestBody: Record<string, unknown> = {}
        server.use(
          http.post(`${TEST_BASE_URL}/_matrix/client/v3/register/email/requestToken`, async ({ request }) => {
            requestBody = (await request.json()) as Record<string, unknown>
            return HttpResponse.json({ sid: 'session-id-123' })
          })
        )

        await MatrixAuthService.requestEmailToken('test@example.com', 3)

        expect(requestBody).toHaveProperty('send_attempt', 3)
      })

      it('should request password reset email token through homeserver', async () => {
        server.use(
          http.post(`${TEST_BASE_URL}/_matrix/client/v3/account/password/email/requestToken`, () => {
            return HttpResponse.json({
              sid: 'reset-session-id-123',
              expires_in: 3600
            })
          })
        )

        const result = await MatrixAuthService.requestPasswordEmailToken('test@example.com', 1, 'secret123')

        expect(result).toEqual({
          sid: 'reset-session-id-123',
          expires_in: 3600,
          client_secret: 'secret123'
        })
      })

      it('should prefer sdk password reset email token request when available', async () => {
        const requestPasswordEmailToken = vi.fn().mockResolvedValue({
          sid: 'sdk-reset-session-id-123',
          submit_url: 'https://matrix.org/password-reset'
        })

        vi.mocked(sdk.createClient).mockReturnValue({
          requestPasswordEmailToken
        } as unknown as sdk.MatrixClient)

        const result = await MatrixAuthService.requestPasswordEmailToken('test@example.com', 3, 'secret123')

        expect(requestPasswordEmailToken).toHaveBeenCalledWith('test@example.com', 'secret123', 3)
        expect(result).toEqual({
          sid: 'sdk-reset-session-id-123',
          submit_url: 'https://matrix.org/password-reset',
          client_secret: 'secret123'
        })
      })

      it('should fall back to homeserver when sdk password token request throws runtime error', async () => {
        const requestPasswordEmailToken = vi.fn().mockRejectedValue(new Error('temporary sdk init failure'))
        vi.mocked(sdk.createClient).mockReturnValue({
          requestPasswordEmailToken
        } as unknown as sdk.MatrixClient)

        const result = await MatrixAuthService.requestPasswordEmailToken('test@example.com', 1, 'secret123')

        expect(result).toEqual({
          sid: 'reset-session-id-123',
          client_secret: 'secret123'
        })
      })
    })

    describe('getCaptcha', () => {
      it('should get captcha through homeserver', async () => {
        server.use(
          http.post(`${TEST_BASE_URL}/_matrix/client/v3/register`, () => {
            return HttpResponse.json({ session: 'session-123' })
          })
        )

        const result = await (MatrixAuthService as any).getCaptcha()

        expect(result).toEqual({
          captcha_type: 'm.login.recaptcha',
          public_key: 'test_key',
          session: 'session-123',
          api_path: '/api/captcha',
          mxc_url: 'mxc://matrix.org/captcha/123'
        })
      })
    })

    describe('forgetPassword', () => {
      it('should prefer sdk password reset flow through service wrapper', async () => {
        const requestPasswordEmailToken = vi.fn().mockResolvedValue({
          sid: 'sdk-reset-session-id-123'
        })

        vi.mocked(sdk.createClient).mockReturnValue({
          requestPasswordEmailToken
        } as unknown as sdk.MatrixClient)

        const result = await MatrixAuthService.forgetPassword('test@example.com', 2, 'secret123')

        expect(requestPasswordEmailToken).toHaveBeenCalledWith('test@example.com', 'secret123', 2)
        expect(result).toEqual({
          sid: 'sdk-reset-session-id-123',
          client_secret: 'secret123'
        })
      })

      it('should fall back to homeserver when sdk forget password flow throws runtime error', async () => {
        const requestPasswordEmailToken = vi.fn().mockRejectedValue(new Error('sdk bootstrap failed'))
        vi.mocked(matrixClientService.getClient).mockReturnValue(null)
        vi.spyOn(sdk, 'createClient').mockReturnValue({
          requestPasswordEmailToken
        } as unknown as sdk.MatrixClient)

        const result = await MatrixAuthService.forgetPassword('test@example.com', 1, 'secret123')

        expect(result).toEqual({
          sid: 'reset-session-id-123',
          client_secret: 'secret123'
        })
      })
    })

    describe('resetPassword', () => {
      it('should prefer sdk setPassword when auth is provided', async () => {
        const setPassword = vi.fn().mockResolvedValue({
          success: true
        })

        vi.mocked(sdk.createClient).mockReturnValue({
          setPassword
        } as unknown as sdk.MatrixClient)

        const result = await MatrixAuthService.resetPassword(
          'newPassword123',
          'sid123',
          'm.login.email.identity',
          undefined,
          'secret123'
        )

        expect(setPassword).toHaveBeenCalledWith(
          {
            type: 'm.login.email.identity',
            threepid_creds: {
              sid: 'sid123',
              client_secret: 'secret123'
            }
          },
          'newPassword123'
        )
        expect(result).toEqual({ success: true })
      })

      it('should surface sdk setPassword matrix error without falling back to homeserver', async () => {
        const setPassword = vi.fn().mockRejectedValue(
          Object.assign(new Error('Session not found'), {
            errcode: 'M_SESSION_NOT_FOUND',
            error: 'Session not found',
            httpStatus: 400
          })
        )

        vi.spyOn(sdk, 'createClient').mockReturnValue({
          setPassword
        } as unknown as sdk.MatrixClient)

        await expect(
          MatrixAuthService.resetPassword('newPassword123', 'sid123', 'm.login.email.identity', undefined, 'secret123')
        ).rejects.toThrow('重置密码失败 (400): Session not found [M_SESSION_NOT_FOUND] (验证会话不存在或已失效)')
      })

      it('should fall back to homeserver reset password when sdk throws runtime error', async () => {
        const setPassword = vi.fn().mockRejectedValue(new Error('sdk bootstrap failed'))
        vi.spyOn(sdk, 'createClient').mockReturnValue({
          setPassword
        } as unknown as MatrixClient)

        await MatrixAuthService.resetPassword(
          'newPassword123',
          'sid123',
          'm.login.email.identity',
          undefined,
          'secret123'
        )
      })

      it('should request password update through homeserver', async () => {
        let requestBody: Record<string, unknown> = {}
        server.use(
          http.post(`${TEST_BASE_URL}/_matrix/client/v3/account/password`, async ({ request }) => {
            requestBody = (await request.json()) as Record<string, unknown>
            return HttpResponse.json({ success: true })
          })
        )

        const result = await MatrixAuthService.resetPassword(
          'newPassword123',
          'session123',
          'm.login.password',
          'token123'
        )

        expect(requestBody).toEqual({
          new_password: 'newPassword123',
          auth: {
            session: 'session123',
            type: 'm.login.password',
            token: 'token123'
          }
        })
        expect(result).toEqual({ success: true })
      })

      it('should send threepid creds when reset password uses email identity auth', async () => {
        const setPassword = vi.fn().mockRejectedValue(new Error('sdk bootstrap failed'))
        vi.spyOn(sdk, 'createClient').mockReturnValue({
          setPassword
        } as unknown as MatrixClient)

        let requestBody: Record<string, unknown> = {}
        server.use(
          http.post(`${TEST_BASE_URL}/_matrix/client/v3/account/password`, async ({ request }) => {
            requestBody = (await request.json()) as Record<string, unknown>
            return HttpResponse.json({})
          })
        )

        await MatrixAuthService.resetPassword(
          'newPassword123',
          'sid123',
          'm.login.email.identity',
          undefined,
          'secret123'
        )

        expect(requestBody).toEqual({
          new_password: 'newPassword123',
          auth: {
            type: 'm.login.email.identity',
            threepid_creds: {
              sid: 'sid123',
              client_secret: 'secret123'
            }
          }
        })
      })

      it('should work without auth session', async () => {
        let requestBody: Record<string, unknown> = {}
        server.use(
          http.post(`${TEST_BASE_URL}/_matrix/client/v3/account/password`, async ({ request }) => {
            requestBody = (await request.json()) as Record<string, unknown>
            return HttpResponse.json({})
          })
        )

        await MatrixAuthService.resetPassword('newPassword123')

        expect(requestBody).toEqual({
          new_password: 'newPassword123'
        })
      })
    })

    describe('submitEmailToken', () => {
      it('should prefer sdk email token submission when available', async () => {
        const submitEmailToken = vi.fn().mockResolvedValue({
          success: true
        })

        vi.spyOn(sdk, 'createClient').mockReturnValue({
          getAccountManager: () => ({
            submitEmailToken
          })
        } as unknown as sdk.MatrixClient)

        const result = await MatrixAuthService.submitEmailToken('code123', 'secret123', 'sid123')

        expect(submitEmailToken).toHaveBeenCalledWith('sid123', 'secret123', 'code123')
        expect(result).toEqual({
          success: true
        })
      })

      it('should submit password reset email token through password reset endpoint', async () => {
        const submitEmailToken = vi.fn()

        vi.spyOn(sdk, 'createClient').mockReturnValue({
          getAccountManager: () => ({
            submitEmailToken
          })
        } as unknown as MatrixClient)

        let requestBody: Record<string, unknown> = {}
        server.use(
          http.post(`${TEST_BASE_URL}/_matrix/client/v3/account/password/email/submitToken`, async ({ request }) => {
            requestBody = (await request.json()) as Record<string, unknown>
            return HttpResponse.json({ success: true })
          })
        )

        const result = await MatrixAuthService.submitEmailToken('code123', 'secret123', 'sid123', 'password_reset')

        expect(submitEmailToken).not.toHaveBeenCalled()
        expect(requestBody).toEqual({
          token: 'code123',
          client_secret: 'secret123',
          sid: 'sid123'
        })
        expect(result).toEqual({ success: true })
      })

      it('should surface sdk submit token matrix error without falling back to homeserver', async () => {
        const submitEmailToken = vi.fn().mockRejectedValue(
          Object.assign(new Error('Token expired'), {
            errcode: 'M_TOKEN_EXPIRED',
            error: 'Token expired',
            httpStatus: 400
          })
        )

        vi.spyOn(sdk, 'createClient').mockReturnValue({
          getAccountManager: () => ({
            submitEmailToken
          })
        } as unknown as MatrixClient)

        await expect(MatrixAuthService.submitEmailToken('code123', 'secret123', 'sid123')).rejects.toThrow(
          '提交邮箱令牌失败 (400): Token expired [M_TOKEN_EXPIRED] (验证码已过期)'
        )
      })

      it('should fall back to homeserver email token submission when sdk throws runtime error', async () => {
        const submitEmailToken = vi.fn().mockRejectedValue(new Error('sdk bootstrap failed'))

        vi.spyOn(sdk, 'createClient').mockReturnValue({
          getAccountManager: () => ({
            submitEmailToken
          })
        } as unknown as MatrixClient)

        const result = await MatrixAuthService.submitEmailToken('code123', 'secret123', 'sid123')

        expect(result).toEqual({ success: true })
      })

      it('should show readable token expiry error from homeserver fallback', async () => {
        const submitEmailToken = vi.fn().mockRejectedValue(new Error('sdk bootstrap failed'))

        vi.spyOn(sdk, 'createClient').mockReturnValue({
          getAccountManager: () => ({
            submitEmailToken
          })
        } as unknown as MatrixClient)

        server.use(
          http.post(`${TEST_BASE_URL}/_matrix/client/v3/register/email/submitToken`, () => {
            return HttpResponse.json({ errcode: 'M_TOKEN_EXPIRED' }, { status: 400 })
          })
        )

        await expect(MatrixAuthService.submitEmailToken('code123', 'secret123', 'sid123')).rejects.toThrow(
          '提交邮箱令牌失败 (400): [M_TOKEN_EXPIRED] (验证码已过期)'
        )
      })
    })

    it('should show readable invalid email error from homeserver', async () => {
      const requestRegisterEmailToken = vi.fn().mockRejectedValue(new Error('sdk bootstrap failed'))
      vi.spyOn(sdk, 'createClient').mockReturnValue({
        requestRegisterEmailToken
      } as unknown as MatrixClient)

      server.use(
        http.post(`${TEST_BASE_URL}/_matrix/client/v3/register/email/requestToken`, () => {
          return HttpResponse.json({ errcode: 'M_INVALID_EMAIL' }, { status: 400 })
        })
      )

      await expect(MatrixAuthService.requestEmailToken('invalid-email', 1, 'secret123')).rejects.toThrow(
        '请求邮箱令牌失败 (400): [M_INVALID_EMAIL] (邮箱格式无效)'
      )
    })
  })
})
