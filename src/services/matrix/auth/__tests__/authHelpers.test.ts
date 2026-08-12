import { describe, expect, it, vi } from 'vitest'
import type { MatrixEmailTokenResult } from '../authHelpers'
import {
  buildRegisterAuth,
  buildResetPasswordAuth,
  generateClientSecret,
  resolveMatrixClientUrl,
  resolveSubmitEmailTokenPath,
  runSdkFirst,
  withClientSecret
} from '../authHelpers'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('@/services/backend/config', () => ({
  resolveMatrixRuntimeEndpointConfig: () => ({
    homeserverUrl: 'https://matrix.example.com/',
    identityServerUrl: 'https://matrix.example.com/'
  })
}))

vi.mock('@/services/matrix/network/runtimeFetch', () => ({
  getRuntimeAwareFetch: vi.fn(),
  getRuntimeAwareFetchFn: vi.fn()
}))

vi.mock('@/services/matrix/sdk', () => ({
  createClient: vi.fn()
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(),
    login: vi.fn()
  }
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

describe('buildRegisterAuth', () => {
  it('returns m.login.email.identity auth with threepid_creds for email registration', () => {
    const result = buildRegisterAuth('session-123', 'm.login.email.identity', 'token-abc', 'secret-xyz')
    expect(result).toEqual({
      type: 'm.login.email.identity',
      threepid_creds: {
        sid: 'session-123',
        client_secret: 'secret-xyz'
      }
    })
  })

  it('uses authToken as client_secret fallback when clientSecret is absent', () => {
    const result = buildRegisterAuth('session-123', 'm.login.email.identity', 'token-abc')
    expect(result).toEqual({
      type: 'm.login.email.identity',
      threepid_creds: {
        sid: 'session-123',
        client_secret: 'token-abc'
      }
    })
  })

  it('returns session-based auth for non-email auth types', () => {
    const result = buildRegisterAuth('session-456', 'm.login.recaptcha', 'captcha-token')
    expect(result).toEqual({
      session: 'session-456',
      type: 'm.login.recaptcha',
      token: 'captcha-token'
    })
  })

  it('returns m.login.dummy when session and authType are absent (synapse-rust single-step)', () => {
    const result = buildRegisterAuth()
    expect(result).toEqual({ type: 'm.login.dummy' })
  })

  it('returns m.login.dummy when only session is absent', () => {
    const result = buildRegisterAuth(undefined, 'm.login.recaptcha', 'token')
    expect(result).toEqual({ type: 'm.login.dummy' })
  })

  it('returns m.login.dummy when only authType is absent', () => {
    const result = buildRegisterAuth('session-789')
    expect(result).toEqual({ type: 'm.login.dummy' })
  })
})

describe('buildResetPasswordAuth', () => {
  it('returns email.identity auth for password reset via email', () => {
    const result = buildResetPasswordAuth('reset-session', 'm.login.email.identity', 'token', 'secret')
    expect(result).toEqual({
      type: 'm.login.email.identity',
      threepid_creds: {
        sid: 'reset-session',
        client_secret: 'secret'
      }
    })
  })

  it('uses authToken as client_secret fallback', () => {
    const result = buildResetPasswordAuth('reset-session', 'm.login.email.identity', 'fallback-token')
    expect(result).toEqual({
      type: 'm.login.email.identity',
      threepid_creds: {
        sid: 'reset-session',
        client_secret: 'fallback-token'
      }
    })
  })

  it('returns session-based auth for non-email types', () => {
    const result = buildResetPasswordAuth('reset-session', 'm.login.recaptcha', 'captcha')
    expect(result).toEqual({
      session: 'reset-session',
      type: 'm.login.recaptcha',
      token: 'captcha'
    })
  })

  it('returns undefined when both session and authType are absent', () => {
    expect(buildResetPasswordAuth()).toBeUndefined()
    expect(buildResetPasswordAuth(undefined, undefined, 'token')).toBeUndefined()
  })
})

describe('withClientSecret', () => {
  it('adds client_secret to an email token result', () => {
    const input: MatrixEmailTokenResult = {
      sid: 'sid-123',
      submit_url: 'https://matrix.org/submit',
      expires_in: 3600
    }
    const result = withClientSecret(input, 'my-secret')
    expect(result).toEqual({
      sid: 'sid-123',
      submit_url: 'https://matrix.org/submit',
      expires_in: 3600,
      client_secret: 'my-secret'
    })
  })

  it('does not mutate the original object', () => {
    const input: MatrixEmailTokenResult = { sid: 'sid-456' }
    const result = withClientSecret(input, 'secret')
    expect(input).toEqual({ sid: 'sid-456' })
    expect(result.client_secret).toBe('secret')
  })
})

describe('generateClientSecret', () => {
  it('generates a 43-character string', () => {
    const secret = generateClientSecret()
    expect(secret).toHaveLength(43)
  })

  it('generates different values on successive calls', () => {
    const s1 = generateClientSecret()
    const s2 = generateClientSecret()
    expect(s1).not.toBe(s2)
  })

  it('only contains alphanumeric characters', () => {
    for (let i = 0; i < 10; i++) {
      const secret = generateClientSecret()
      expect(secret).toMatch(/^[A-Za-z0-9]+$/)
    }
  })
})

describe('resolveMatrixClientUrl', () => {
  it('concatenates homeserver URL with path', () => {
    expect(resolveMatrixClientUrl('/_matrix/client/v3/login')).toBe(
      'https://matrix.example.com/_matrix/client/v3/login'
    )
  })

  it('normalizes trailing slashes on homeserver URL', () => {
    expect(resolveMatrixClientUrl('path')).toBe('https://matrix.example.com/path')
  })

  it('handles path with leading slash', () => {
    expect(resolveMatrixClientUrl('/path')).toBe('https://matrix.example.com/path')
  })

  it('handles path without leading slash', () => {
    expect(resolveMatrixClientUrl('path/to/resource')).toBe('https://matrix.example.com/path/to/resource')
  })
})

describe('resolveSubmitEmailTokenPath', () => {
  it('returns register path for register purpose', () => {
    const path = resolveSubmitEmailTokenPath('register')
    expect(path).toContain('/register/email/submitToken')
  })

  it('returns password reset path for password_reset purpose', () => {
    const path = resolveSubmitEmailTokenPath('password_reset')
    expect(path).toContain('/account/password/email/submitToken')
  })

  it('returns different paths for different purposes', () => {
    const registerPath = resolveSubmitEmailTokenPath('register')
    const resetPath = resolveSubmitEmailTokenPath('password_reset')
    expect(registerPath).not.toBe(resetPath)
  })
})

describe('runSdkFirst', () => {
  it('returns SDK result when SDK succeeds', async () => {
    const sdkRequest = vi.fn().mockResolvedValue('sdk-result')
    const fallbackRequest = vi.fn()
    const result = await runSdkFirst(sdkRequest, fallbackRequest, '测试失败')
    expect(result).toBe('sdk-result')
    expect(fallbackRequest).not.toHaveBeenCalled()
  })

  it('falls back to HTTP when SDK throws without errcode', async () => {
    const sdkRequest = vi.fn().mockRejectedValue(new Error('network error'))
    const fallbackRequest = vi.fn().mockResolvedValue('http-result')
    const result = await runSdkFirst(sdkRequest, fallbackRequest, '测试失败')
    expect(result).toBe('http-result')
    expect(fallbackRequest).toHaveBeenCalled()
  })

  it('rethrows without fallback when SDK throws with errcode (Matrix standard error)', async () => {
    const matrixError = Object.assign(new Error('forbidden'), {
      errcode: 'M_FORBIDDEN',
      httpStatus: 403
    })
    const sdkRequest = vi.fn().mockRejectedValue(matrixError)
    const fallbackRequest = vi.fn()
    await expect(runSdkFirst(sdkRequest, fallbackRequest, '登录失败')).rejects.toThrow()
    expect(fallbackRequest).not.toHaveBeenCalled()
  })

  it('wraps fallback error when both SDK and HTTP fail', async () => {
    const sdkRequest = vi.fn().mockRejectedValue(new Error('sdk-down'))
    const fallbackRequest = vi.fn().mockRejectedValue(new Error('http-down'))
    await expect(runSdkFirst(sdkRequest, fallbackRequest, '操作失败')).rejects.toThrow('操作失败')
  })

  it('wraps Matrix error with errcode in the failure label', async () => {
    const matrixError = Object.assign(new Error('rate limited'), {
      errcode: 'M_LIMIT_EXCEEDED',
      httpStatus: 429
    })
    const sdkRequest = vi.fn().mockRejectedValue(matrixError)
    const fallbackRequest = vi.fn()
    await expect(runSdkFirst(sdkRequest, fallbackRequest, '请求失败')).rejects.toThrow('请求失败')
  })
})
