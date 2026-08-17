import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '../../MatrixClientService'
import { authedRequestWithPath } from '../../MatrixHttpClient'
import { PREFIX_V3 } from '../../paths'
import { normalizeSdkMatrixError } from '../authErrors'
import { createTemporaryMatrixClient, matrixGetCaptcha, postMatrixJson } from '../authHelpers'
import {
  cleanupExpiredCaptchas,
  getCaptcha,
  getCaptchaStatus,
  startRegistrationSession,
  verifyCaptcha
} from '../MatrixAuthCaptcha'

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: { getClient: vi.fn() }
}))

vi.mock('../../MatrixHttpClient', () => ({
  authedRequestWithPath: vi.fn()
}))

vi.mock('../../paths', () => ({
  PREFIX_V3: '/_matrix/client/v3'
}))

vi.mock('../authErrors', () => ({
  normalizeSdkMatrixError: vi.fn((_err: unknown, label: string) => new Error(label))
}))

vi.mock('../authHelpers', () => ({
  createTemporaryMatrixClient: vi.fn(),
  matrixGetCaptcha: vi.fn(),
  postMatrixJson: vi.fn()
}))

const mockGetClient = vi.mocked(matrixClientService.getClient)
const mockAuthedRequestWithPath = vi.mocked(authedRequestWithPath)
const mockPostMatrixJson = vi.mocked(postMatrixJson)
const mockNormalizeSdkMatrixError = vi.mocked(normalizeSdkMatrixError)
const mockMatrixGetCaptcha = vi.mocked(matrixGetCaptcha)
const mockCreateTemporaryMatrixClient = vi.mocked(createTemporaryMatrixClient)

const registerRequest = vi.fn()
const mockCaptchaManager = {
  deleteExpiredCaptchas: vi.fn(),
  getCaptchaStatus: vi.fn()
}
const dummyClient = {
  some: 'client',
  getCaptchaManager: () => mockCaptchaManager
} as unknown as Parameters<typeof authedRequestWithPath>[0]

beforeEach(() => {
  vi.clearAllMocks()
  mockGetClient.mockReturnValue(dummyClient)
  mockCreateTemporaryMatrixClient.mockReturnValue({
    registerRequest
  } as unknown as ReturnType<typeof createTemporaryMatrixClient>)
})

describe('getCaptcha', () => {
  it('delegates to matrixGetCaptcha with the given options', async () => {
    mockMatrixGetCaptcha.mockResolvedValue({ session: 's', api_path: '/captcha', mxc_url: 'mxc://x' })
    const result = await getCaptcha({ session: 's', captchaType: 'sms', length: 4 })
    expect(mockMatrixGetCaptcha).toHaveBeenCalledWith({ session: 's', captchaType: 'sms', length: 4 })
    expect(result).toEqual({ session: 's', api_path: '/captcha', mxc_url: 'mxc://x' })
  })

  it('delegates to matrixGetCaptcha without options when none given', async () => {
    mockMatrixGetCaptcha.mockResolvedValue({ session: 's', api_path: '/captcha', mxc_url: 'mxc://x' })
    await getCaptcha()
    expect(mockMatrixGetCaptcha).toHaveBeenCalledWith(undefined)
  })
})

describe('startRegistrationSession', () => {
  it('returns session and flows from the SDK register response', async () => {
    registerRequest.mockResolvedValue({
      session: 'reg-session',
      flows: [{ type: 'm.login.dummy' }]
    })
    const result = await startRegistrationSession()
    expect(result).toEqual({ session: 'reg-session', flows: [{ type: 'm.login.dummy' }] })
  })

  it('defaults flows to an empty array when the SDK omits them', async () => {
    registerRequest.mockResolvedValue({ session: 'reg-session' })
    const result = await startRegistrationSession()
    expect(result).toEqual({ session: 'reg-session', flows: [] })
  })

  it('throws a normalized error when the SDK response has no session', async () => {
    registerRequest.mockResolvedValue({})
    await expect(startRegistrationSession()).rejects.toThrow('启动注册会话失败')
    expect(mockNormalizeSdkMatrixError).toHaveBeenCalled()
  })

  it('recovers session and flows from a rejected Matrix error that carries them', async () => {
    registerRequest.mockRejectedValue({ errcode: 'M_UNAUTHORIZED', session: 'err-session', flows: [{ type: 'x' }] })
    const result = await startRegistrationSession()
    expect(result).toEqual({ session: 'err-session', flows: [{ type: 'x' }] })
  })

  it('normalizes the error when the rejected error carries no session', async () => {
    registerRequest.mockRejectedValue(new Error('down'))
    await expect(startRegistrationSession()).rejects.toThrow('启动注册会话失败')
    expect(mockNormalizeSdkMatrixError).toHaveBeenCalled()
  })
})

describe('verifyCaptcha', () => {
  it('posts the session and response to the verify endpoint', async () => {
    mockPostMatrixJson.mockResolvedValue({ success: true })
    const result = await verifyCaptcha('sess-1', 'resp-1')
    expect(result).toEqual({ success: true })
    expect(mockPostMatrixJson).toHaveBeenCalledWith(
      `${PREFIX_V3}/register/captcha/verify`,
      { session: 'sess-1', response: 'resp-1' },
      '验证验证码失败'
    )
  })
})

describe('getCaptchaStatus', () => {
  it('throws when the client is not initialized', async () => {
    mockGetClient.mockReturnValue(null)
    await expect(getCaptchaStatus('sess-1')).rejects.toThrow('matrix_error.common.client_not_initialized')
  })

  it('returns the verified flag from the homeserver', async () => {
    mockAuthedRequestWithPath.mockResolvedValue({ verified: true })
    const result = await getCaptchaStatus('sess-1')
    expect(result).toEqual({ verified: true })
    expect(mockAuthedRequestWithPath).toHaveBeenCalledWith(dummyClient, 'GET', '/register/captcha/status', {
      session: 'sess-1'
    })
  })

  it('throws query_code_status_failed when the request fails', async () => {
    mockAuthedRequestWithPath.mockRejectedValue(new Error('boom'))
    await expect(getCaptchaStatus('sess-1')).rejects.toThrow('matrix_error.auth.query_code_status_failed')
    expect(mockNormalizeSdkMatrixError).not.toHaveBeenCalled()
  })
})

describe('cleanupExpiredCaptchas', () => {
  it('throws when the client is not initialized', async () => {
    mockGetClient.mockReturnValue(null)
    await expect(cleanupExpiredCaptchas()).rejects.toThrow('matrix_error.common.client_not_initialized')
  })

  it('returns the cleaned count from the homeserver', async () => {
    mockCaptchaManager.deleteExpiredCaptchas.mockResolvedValue({ cleaned_count: 3, message: 'ok' })
    const result = await cleanupExpiredCaptchas()
    expect(result).toEqual({ cleaned: 3 })
    expect(mockCaptchaManager.deleteExpiredCaptchas).toHaveBeenCalled()
  })

  it('defaults cleaned to 0 when absent', async () => {
    mockCaptchaManager.deleteExpiredCaptchas.mockResolvedValue({})
    await expect(cleanupExpiredCaptchas()).resolves.toEqual({ cleaned: 0 })
  })

  it('normalizes the error when cleanup fails', async () => {
    mockCaptchaManager.deleteExpiredCaptchas.mockRejectedValue(new Error('boom'))
    await expect(cleanupExpiredCaptchas()).rejects.toThrow('清理过期验证码失败')
    expect(mockNormalizeSdkMatrixError).toHaveBeenCalled()
  })
})
