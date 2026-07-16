import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { MatrixAuthService } from '@/services/matrix/auth/MatrixAuthService'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useRegisterCaptcha')

/**
 * 跨端注册 CAPTCHA composable
 *
 * PC 端 CaptchaVerify.vue 与移动端 CaptchaVerify.vue 共用此逻辑。
 *
 * 使用方式:
 * 1. 组件挂载后调用 load() 启动注册会话并拉取验证码图片
 * 2. captchaInput 通过 v-model 绑定输入框
 * 3. 用户点击「确认」调用 verify(),成功后 verified 变为 true
 * 4. 用户点击「刷新」调用 refresh()(保持 session 不变)
 * 5. 父组件读取 session 与 verified 状态用于注册提交
 */
export function useRegisterCaptcha() {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()

  /** 验证码图片可访问 URL(http),null 表示尚未加载 */
  const captchaImage = ref<string | null>(null)
  /** 注册会话 ID,贯穿 startRegistrationSession / getCaptcha / verifyCaptcha */
  const session = ref<string | null>(null)
  /** 用户输入的验证码,通过 v-model 绑定输入框 */
  const captchaInput = ref('')
  /** 拉取验证码中 */
  const loading = ref(false)
  /** 验证中 */
  const verifying = ref(false)
  /** 是否已通过验证 */
  const verified = ref(false)
  /** 错误信息 */
  const errorMessage = ref<string | null>(null)
  /** 验证码提交 API 路径(由 getCaptcha 返回) */
  const apiPath = ref<string | null>(null)

  /** 将 mxc:// URI 转为可访问 http URL,转换失败时回退到原值 */
  const resolveImageUrl = (mxcUrl: string): string => {
    try {
      const url = matrixMediaService.getMediaUrl(mxcUrl)
      return url || mxcUrl
    } catch (err) {
      logger.warn('mxc URL 转换失败,回退原值', err)
      return mxcUrl
    }
  }

  /** 应用 getCaptcha 返回结果到状态 */
  const applyCaptchaResult = (result: { session: string; api_path: string; mxc_url: string }) => {
    apiPath.value = result.api_path
    if (!session.value) {
      session.value = result.session
    }
    captchaImage.value = result.mxc_url ? resolveImageUrl(result.mxc_url) : null
    captchaInput.value = ''
    verified.value = false
  }

  /**
   * 启动注册会话并获取 CAPTCHA
   * 成功后设置 session/captchaImage/apiPath,并清空输入与 verified 状态
   */
  const load = async (): Promise<void> => {
    loading.value = true
    errorMessage.value = null
    try {
      const regSession = await MatrixAuthService.startRegistrationSession()
      session.value = regSession.session
      const captcha = await MatrixAuthService.getCaptcha({ session: regSession.session })
      applyCaptchaResult(captcha)
    } catch (err) {
      logger.error('获取验证码失败', err)
      errorMessage.value = t('captcha.load_failed')
      showFeedback(errorMessage.value, 'error')
    } finally {
      loading.value = false
    }
  }

  /**
   * 重新获取 CAPTCHA,保持 session 不变
   * 若尚无 session,则回退到 load()
   */
  const refresh = async (): Promise<void> => {
    if (!session.value) {
      await load()
      return
    }
    loading.value = true
    errorMessage.value = null
    try {
      const captcha = await MatrixAuthService.getCaptcha({ session: session.value })
      applyCaptchaResult(captcha)
    } catch (err) {
      logger.error('刷新验证码失败', err)
      errorMessage.value = t('captcha.load_failed')
      showFeedback(errorMessage.value, 'error')
    } finally {
      loading.value = false
    }
  }

  /**
   * 验证用户输入
   * 成功:verified=true,返回 true
   * 失败:清空输入,verified=false,返回 false
   */
  const verify = async (): Promise<boolean> => {
    if (!session.value) {
      errorMessage.value = t('captcha.load_failed')
      showFeedback(errorMessage.value, 'error')
      return false
    }
    const response = captchaInput.value.trim()
    if (!response) {
      return false
    }
    verifying.value = true
    errorMessage.value = null
    try {
      const result = await MatrixAuthService.verifyCaptcha(session.value, response)
      if (result.success) {
        verified.value = true
        showFeedback(t('captcha.verify_success'), 'success')
        return true
      }
      verified.value = false
      errorMessage.value = t('captcha.verify_failed')
      showFeedback(errorMessage.value, 'error')
      captchaInput.value = ''
      return false
    } catch (err) {
      logger.error('验证码验证失败', err)
      verified.value = false
      errorMessage.value = t('captcha.verify_failed')
      showFeedback(errorMessage.value, 'error')
      captchaInput.value = ''
      return false
    } finally {
      verifying.value = false
    }
  }

  /** 清空输入与验证状态(保留 session 与图片) */
  const reset = (): void => {
    captchaInput.value = ''
    verified.value = false
    errorMessage.value = null
  }

  return {
    captchaImage,
    session,
    captchaInput,
    loading,
    verifying,
    verified,
    errorMessage,
    apiPath,
    load,
    refresh,
    verify,
    reset
  }
}
