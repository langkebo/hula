import { beforeEach, describe, expect, it, vi } from 'vitest'
import { forgetPassword, requestPasswordEmailToken, resetPassword } from '../MatrixAuthPassword'

// 完全 mock './authHelpers'，避免加载真实模块（其会引入 matrix-js-sdk 等依赖）。
// 保留 runSdkFirst / withClientSecret 的可信 mock 实现，以真实验证成功 / HTTP 回退分支。
const helpers = vi.hoisted(() => ({
  buildResetPasswordAuth: vi.fn(),
  createTemporaryMatrixClient: vi.fn(),
  generateClientSecret: vi.fn(),
  matrixRequestPasswordEmailToken: vi.fn(),
  matrixResetPassword: vi.fn(),
  runSdkFirst: vi.fn(),
  withClientSecret: vi.fn()
}))

vi.mock('../authHelpers', () => helpers)

const mockBuildResetPasswordAuth = helpers.buildResetPasswordAuth
const mockCreateTemporaryMatrixClient = helpers.createTemporaryMatrixClient
const mockGenerateClientSecret = helpers.generateClientSecret
const mockMatrixRequestPasswordEmailToken = helpers.matrixRequestPasswordEmailToken
const mockMatrixResetPassword = helpers.matrixResetPassword
const mockRunSdkFirst = helpers.runSdkFirst
const mockWithClientSecret = helpers.withClientSecret

const sdkRequestPasswordEmailToken = vi.fn()
const sdkSetPassword = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()

  // 复刻真实 runSdkFirst 的语义：SDK 成功返回；SDK 带 errcode 抛错不回退；否则回退 HTTP。
  mockRunSdkFirst.mockImplementation(
    async <T>(sdkRequest: () => Promise<T>, fallbackRequest: () => Promise<T>, failureLabel: string): Promise<T> => {
      try {
        return await sdkRequest()
      } catch (error) {
        const errcode = (error as { errcode?: string })?.errcode
        if (errcode) {
          throw new Error(failureLabel)
        }
        return fallbackRequest()
      }
    }
  )

  // 复刻真实 withClientSecret：把 client_secret 并入结果。
  mockWithClientSecret.mockImplementation((result, clientSecret) => ({
    ...result,
    client_secret: clientSecret
  }))

  mockCreateTemporaryMatrixClient.mockReturnValue({
    requestPasswordEmailToken: sdkRequestPasswordEmailToken,
    setPassword: sdkSetPassword
  } as unknown as {
    requestPasswordEmailToken: typeof sdkRequestPasswordEmailToken
    setPassword: typeof sdkSetPassword
  })
})

describe('requestPasswordEmailToken', () => {
  it('uses provided clientSecret and returns SDK result wrapped with client_secret', async () => {
    sdkRequestPasswordEmailToken.mockResolvedValue({
      sid: 'sid-1',
      submit_url: 'https://matrix.org/submit',
      expires_in: 3600
    })

    const result = await requestPasswordEmailToken('a@b.com', 1, 'fixed-secret')

    expect(mockGenerateClientSecret).not.toHaveBeenCalled()
    expect(sdkRequestPasswordEmailToken).toHaveBeenCalledWith('a@b.com', 'fixed-secret', 1)
    expect(result).toEqual({
      sid: 'sid-1',
      submit_url: 'https://matrix.org/submit',
      expires_in: 3600,
      client_secret: 'fixed-secret'
    })
  })

  it('auto-generates clientSecret when not provided', async () => {
    mockGenerateClientSecret.mockReturnValue('auto-secret')
    sdkRequestPasswordEmailToken.mockResolvedValue({ sid: 'sid-2' })

    const result = await requestPasswordEmailToken('a@b.com')

    expect(mockGenerateClientSecret).toHaveBeenCalled()
    expect(sdkRequestPasswordEmailToken).toHaveBeenCalledWith('a@b.com', 'auto-secret', 1)
    expect(result.client_secret).toBe('auto-secret')
  })

  it('falls back to HTTP when SDK request fails without a Matrix errcode', async () => {
    mockGenerateClientSecret.mockReturnValue('fallback-secret')
    sdkRequestPasswordEmailToken.mockRejectedValue(new Error('sdk network down'))
    mockMatrixRequestPasswordEmailToken.mockResolvedValue({ sid: 'sid-3' })

    const result = await requestPasswordEmailToken('a@b.com', 2)

    expect(mockMatrixRequestPasswordEmailToken).toHaveBeenCalledWith('a@b.com', 'fallback-secret', 2)
    expect(result.client_secret).toBe('fallback-secret')
    expect(result.sid).toBe('sid-3')
  })

  it('propagates Matrix standard error without falling back to HTTP', async () => {
    mockGenerateClientSecret.mockReturnValue('matrix-secret')
    sdkRequestPasswordEmailToken.mockRejectedValue(
      Object.assign(new Error('forbidden'), { errcode: 'M_FORBIDDEN', httpStatus: 403 })
    )

    await expect(requestPasswordEmailToken('a@b.com')).rejects.toThrow()
    expect(mockMatrixRequestPasswordEmailToken).not.toHaveBeenCalled()
  })
})

describe('forgetPassword', () => {
  it('delegates to requestPasswordEmailToken with the same arguments', async () => {
    mockGenerateClientSecret.mockReturnValue('delegated-secret')
    sdkRequestPasswordEmailToken.mockResolvedValue({ sid: 'sid-4' })

    const result = await forgetPassword('a@b.com', 3, 'delegated-secret')

    expect(sdkRequestPasswordEmailToken).toHaveBeenCalledWith('a@b.com', 'delegated-secret', 3)
    expect(result.client_secret).toBe('delegated-secret')
  })
})

describe('resetPassword', () => {
  it('goes straight to HTTP when no auth is built (no session/authType)', async () => {
    mockBuildResetPasswordAuth.mockReturnValue(undefined)
    mockMatrixResetPassword.mockResolvedValue({ success: true })

    const result = await resetPassword('new-pass', undefined, undefined, undefined, 'secret')

    expect(mockCreateTemporaryMatrixClient).not.toHaveBeenCalled()
    expect(mockMatrixResetPassword).toHaveBeenCalledWith('new-pass', undefined, undefined, undefined, 'secret')
    expect(result).toEqual({ success: true })
  })

  it('resets password via SDK when an auth object is built', async () => {
    const auth = { type: 'm.login.recaptcha', session: 's', token: 't' }
    mockBuildResetPasswordAuth.mockReturnValue(auth)
    sdkSetPassword.mockResolvedValue({ ok: true })

    const result = await resetPassword('new-pass', 's', 'm.login.recaptcha', 't')

    expect(sdkSetPassword).toHaveBeenCalledWith(auth, 'new-pass')
    expect(mockMatrixResetPassword).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: true })
  })

  it('falls back to HTTP when SDK setPassword fails without a Matrix errcode', async () => {
    const auth = { type: 'm.login.recaptcha', session: 's', token: 't' }
    mockBuildResetPasswordAuth.mockReturnValue(auth)
    sdkSetPassword.mockRejectedValue(new Error('sdk down'))
    mockMatrixResetPassword.mockResolvedValue({ ok: true })

    const result = await resetPassword('new-pass', 's', 'm.login.recaptcha', 't', 'secret')

    expect(mockMatrixResetPassword).toHaveBeenCalledWith('new-pass', 's', 'm.login.recaptcha', 't', 'secret')
    expect(result).toEqual({ ok: true })
  })

  it('does not fall back when SDK setPassword throws a Matrix standard error', async () => {
    const auth = { type: 'm.login.recaptcha', session: 's', token: 't' }
    mockBuildResetPasswordAuth.mockReturnValue(auth)
    sdkSetPassword.mockRejectedValue(
      Object.assign(new Error('rate limited'), { errcode: 'M_LIMIT_EXCEEDED', httpStatus: 429 })
    )

    await expect(resetPassword('new-pass', 's', 'm.login.recaptcha', 't')).rejects.toThrow()
    expect(mockMatrixResetPassword).not.toHaveBeenCalled()
  })
})
