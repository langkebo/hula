import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockStartRegistrationSession,
  mockGetCaptcha,
  mockVerifyCaptcha,
  mockGetMediaUrl,
  mockShowFeedback,
  mockLoggerError,
  mockLoggerWarn
} = vi.hoisted(() => ({
  mockStartRegistrationSession: vi.fn(),
  mockGetCaptcha: vi.fn(),
  mockVerifyCaptcha: vi.fn(),
  mockGetMediaUrl: vi.fn(),
  mockShowFeedback: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerWarn: vi.fn()
}))

vi.mock('@/services/matrix/auth/MatrixAuthService', () => ({
  MatrixAuthService: {
    startRegistrationSession: mockStartRegistrationSession,
    getCaptcha: mockGetCaptcha,
    verifyCaptcha: mockVerifyCaptcha
  }
}))

vi.mock('@/services/matrix/media/MatrixMediaService', () => ({
  matrixMediaService: {
    getMediaUrl: mockGetMediaUrl
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: mockShowFeedback
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: mockLoggerError,
    warn: mockLoggerWarn,
    info: vi.fn()
  })
}))

import { useRegisterCaptcha } from '../useRegisterCaptcha'

const REG_SESSION = 'reg-session-001'
const CAPTCHA_SESSION = 'captcha-session-001'
const CAPTCHA_MXC = 'mxc://localhost/abcdef'
const CAPTCHA_HTTP = 'http://localhost/_matrix/media/abcdef'
const CAPTCHA_API_PATH = '/_matrix/client/v3/register/captcha/verify'

const captchaFixture = {
  session: CAPTCHA_SESSION,
  api_path: CAPTCHA_API_PATH,
  mxc_url: CAPTCHA_MXC
}

describe('useRegisterCaptcha', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStartRegistrationSession.mockResolvedValue({
      session: REG_SESSION,
      flows: [{ type: 'm.login.dummy' }]
    })
    mockGetCaptcha.mockResolvedValue(captchaFixture)
    mockVerifyCaptcha.mockResolvedValue({ success: true })
    mockGetMediaUrl.mockReturnValue(CAPTCHA_HTTP)
  })

  describe('初始状态', () => {
    it('captchaImage 初始为 null', () => {
      const captcha = useRegisterCaptcha()
      expect(captcha.captchaImage.value).toBeNull()
    })

    it('session 初始为 null', () => {
      const captcha = useRegisterCaptcha()
      expect(captcha.session.value).toBeNull()
    })

    it('captchaInput 初始为空字符串', () => {
      const captcha = useRegisterCaptcha()
      expect(captcha.captchaInput.value).toBe('')
    })

    it('loading 与 verifying 初始为 false', () => {
      const captcha = useRegisterCaptcha()
      expect(captcha.loading.value).toBe(false)
      expect(captcha.verifying.value).toBe(false)
    })

    it('verified 初始为 false,errorMessage 与 apiPath 初始为 null', () => {
      const captcha = useRegisterCaptcha()
      expect(captcha.verified.value).toBe(false)
      expect(captcha.errorMessage.value).toBeNull()
      expect(captcha.apiPath.value).toBeNull()
    })
  })

  describe('load', () => {
    it('load 成功后设置 session 为注册会话 ID', async () => {
      const captcha = useRegisterCaptcha()
      await captcha.load()
      expect(captcha.session.value).toBe(REG_SESSION)
      expect(mockStartRegistrationSession).toHaveBeenCalledTimes(1)
    })

    it('load 成功后 captchaImage 被设置为可访问 http URL', async () => {
      const captcha = useRegisterCaptcha()
      await captcha.load()
      expect(mockGetMediaUrl).toHaveBeenCalledWith(CAPTCHA_MXC)
      expect(captcha.captchaImage.value).toBe(CAPTCHA_HTTP)
    })

    it('load 成功后 apiPath 被设置', async () => {
      const captcha = useRegisterCaptcha()
      await captcha.load()
      expect(captcha.apiPath.value).toBe(CAPTCHA_API_PATH)
    })

    it('load 成功后清空输入并重置 verified', async () => {
      const captcha = useRegisterCaptcha()
      captcha.captchaInput.value = '旧输入'
      captcha.verified.value = true
      await captcha.load()
      expect(captcha.captchaInput.value).toBe('')
      expect(captcha.verified.value).toBe(false)
    })

    it('load 成功后 loading 回到 false', async () => {
      const captcha = useRegisterCaptcha()
      await captcha.load()
      expect(captcha.loading.value).toBe(false)
    })

    it('startRegistrationSession 失败时设置 errorMessage 并反馈错误', async () => {
      mockStartRegistrationSession.mockRejectedValueOnce(new Error('网络错误'))
      const captcha = useRegisterCaptcha()
      await captcha.load()
      expect(captcha.session.value).toBeNull()
      expect(captcha.errorMessage.value).toBe('captcha.load_failed')
      expect(mockShowFeedback).toHaveBeenCalledWith('captcha.load_failed', 'error')
      expect(mockLoggerError).toHaveBeenCalled()
      expect(captcha.loading.value).toBe(false)
    })

    it('getCaptcha 失败时设置 errorMessage 且 session 仍保留注册会话 ID', async () => {
      mockGetCaptcha.mockRejectedValueOnce(new Error('获取验证码失败'))
      const captcha = useRegisterCaptcha()
      await captcha.load()
      expect(captcha.session.value).toBe(REG_SESSION)
      expect(captcha.captchaImage.value).toBeNull()
      expect(captcha.errorMessage.value).toBe('captcha.load_failed')
      expect(mockShowFeedback).toHaveBeenCalledWith('captcha.load_failed', 'error')
    })

    it('mxc URL 转换失败时回退到原 mxc 值', async () => {
      mockGetMediaUrl.mockImplementation(() => {
        throw new Error('client 未初始化')
      })
      const captcha = useRegisterCaptcha()
      await captcha.load()
      expect(captcha.captchaImage.value).toBe(CAPTCHA_MXC)
      expect(mockLoggerWarn).toHaveBeenCalled()
    })

    it('mxc_url 为空字符串时 captchaImage 为 null', async () => {
      mockGetCaptcha.mockResolvedValueOnce({
        session: CAPTCHA_SESSION,
        api_path: CAPTCHA_API_PATH,
        mxc_url: ''
      })
      const captcha = useRegisterCaptcha()
      await captcha.load()
      expect(captcha.captchaImage.value).toBeNull()
    })
  })

  describe('refresh', () => {
    it('refresh 保持 session 不变并更新图片', async () => {
      const captcha = useRegisterCaptcha()
      await captcha.load()
      const newMxc = 'mxc://localhost/newimg'
      const newHttp = 'http://localhost/_matrix/media/newimg'
      mockGetCaptcha.mockResolvedValueOnce({
        session: CAPTCHA_SESSION,
        api_path: CAPTCHA_API_PATH,
        mxc_url: newMxc
      })
      mockGetMediaUrl.mockReturnValueOnce(newHttp)
      await captcha.refresh()
      expect(captcha.session.value).toBe(REG_SESSION)
      expect(captcha.captchaImage.value).toBe(newHttp)
      expect(mockGetCaptcha).toHaveBeenCalledWith({ session: REG_SESSION })
    })

    it('refresh 清空输入并重置 verified', async () => {
      const captcha = useRegisterCaptcha()
      await captcha.load()
      captcha.captchaInput.value = '旧输入'
      captcha.verified.value = true
      await captcha.refresh()
      expect(captcha.captchaInput.value).toBe('')
      expect(captcha.verified.value).toBe(false)
    })

    it('refresh 在无 session 时回退到 load', async () => {
      const captcha = useRegisterCaptcha()
      await captcha.refresh()
      expect(mockStartRegistrationSession).toHaveBeenCalledTimes(1)
      expect(captcha.session.value).toBe(REG_SESSION)
    })

    it('refresh 失败时反馈错误', async () => {
      const captcha = useRegisterCaptcha()
      await captcha.load()
      mockGetCaptcha.mockRejectedValueOnce(new Error('刷新失败'))
      await captcha.refresh()
      expect(captcha.errorMessage.value).toBe('captcha.load_failed')
      expect(mockShowFeedback).toHaveBeenCalledWith('captcha.load_failed', 'error')
      expect(captcha.loading.value).toBe(false)
    })
  })

  describe('verify', () => {
    it('verify 成功时 verified 切换为 true 并返回 true', async () => {
      const captcha = useRegisterCaptcha()
      await captcha.load()
      captcha.captchaInput.value = 'ABCD'
      const ok = await captcha.verify()
      expect(ok).toBe(true)
      expect(captcha.verified.value).toBe(true)
      expect(mockVerifyCaptcha).toHaveBeenCalledWith(REG_SESSION, 'ABCD')
      expect(mockShowFeedback).toHaveBeenCalledWith('captcha.verify_success', 'success')
    })

    it('verify 成功后 verifying 回到 false', async () => {
      const captcha = useRegisterCaptcha()
      await captcha.load()
      captcha.captchaInput.value = 'ABCD'
      await captcha.verify()
      expect(captcha.verifying.value).toBe(false)
    })

    it('verify 返回 success=false 时清空输入并反馈失败', async () => {
      const captcha = useRegisterCaptcha()
      await captcha.load()
      captcha.captchaInput.value = 'WRONG'
      mockVerifyCaptcha.mockResolvedValueOnce({ success: false })
      const ok = await captcha.verify()
      expect(ok).toBe(false)
      expect(captcha.verified.value).toBe(false)
      expect(captcha.captchaInput.value).toBe('')
      expect(captcha.errorMessage.value).toBe('captcha.verify_failed')
      expect(mockShowFeedback).toHaveBeenCalledWith('captcha.verify_failed', 'error')
    })

    it('verify 抛错时清空输入并反馈失败', async () => {
      const captcha = useRegisterCaptcha()
      await captcha.load()
      captcha.captchaInput.value = 'ABCD'
      mockVerifyCaptcha.mockRejectedValueOnce(new Error('服务异常'))
      const ok = await captcha.verify()
      expect(ok).toBe(false)
      expect(captcha.verified.value).toBe(false)
      expect(captcha.captchaInput.value).toBe('')
      expect(mockLoggerError).toHaveBeenCalled()
      expect(captcha.verifying.value).toBe(false)
    })

    it('verify 时对输入做 trim', async () => {
      const captcha = useRegisterCaptcha()
      await captcha.load()
      captcha.captchaInput.value = '  ABCD  '
      await captcha.verify()
      expect(mockVerifyCaptcha).toHaveBeenCalledWith(REG_SESSION, 'ABCD')
    })

    it('verify 在无 session 时反馈错误并返回 false', async () => {
      const captcha = useRegisterCaptcha()
      captcha.captchaInput.value = 'ABCD'
      const ok = await captcha.verify()
      expect(ok).toBe(false)
      expect(mockVerifyCaptcha).not.toHaveBeenCalled()
      expect(captcha.errorMessage.value).toBe('captcha.load_failed')
    })

    it('verify 在输入为空时直接返回 false 且不调用 verifyCaptcha', async () => {
      const captcha = useRegisterCaptcha()
      await captcha.load()
      const ok = await captcha.verify()
      expect(ok).toBe(false)
      expect(mockVerifyCaptcha).not.toHaveBeenCalled()
    })
  })

  describe('reset', () => {
    it('reset 清空输入、verified 与 errorMessage,但保留 session 与图片', async () => {
      const captcha = useRegisterCaptcha()
      await captcha.load()
      captcha.captchaInput.value = 'ABCD'
      captcha.verified.value = true
      captcha.errorMessage.value = 'some error'
      const imageBeforeReset = captcha.captchaImage.value
      const sessionBeforeReset = captcha.session.value

      captcha.reset()

      expect(captcha.captchaInput.value).toBe('')
      expect(captcha.verified.value).toBe(false)
      expect(captcha.errorMessage.value).toBeNull()
      expect(captcha.session.value).toBe(sessionBeforeReset)
      expect(captcha.captchaImage.value).toBe(imageBeforeReset)
    })
  })

  describe('verified 状态切换', () => {
    it('verified 在 verify 成功后由 false 切换为 true', async () => {
      const captcha = useRegisterCaptcha()
      await captcha.load()
      expect(captcha.verified.value).toBe(false)
      captcha.captchaInput.value = 'ABCD'
      await captcha.verify()
      expect(captcha.verified.value).toBe(true)
    })

    it('load 后 verified 被重置为 false', async () => {
      const captcha = useRegisterCaptcha()
      await captcha.load()
      captcha.captchaInput.value = 'ABCD'
      await captcha.verify()
      expect(captcha.verified.value).toBe(true)
      await captcha.load()
      expect(captcha.verified.value).toBe(false)
    })
  })
})
