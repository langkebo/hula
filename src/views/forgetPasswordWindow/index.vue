<template>
  <n-config-provider
    :theme="naiveTheme"
    class="size-full bg-[--login-surface-bg] rounded-8px select-none cursor-default">
    <!--顶部操作栏-->
    <ActionBar :max-w="false" :shrink="false" />

    <n-flex vertical class="w-full size-full">
      <!-- 标题 -->
      <n-flex justify="center" class="w-full">
        <p class="text-(18px [--tjg-text-primary]) select-none">{{ t('auth.forget.title') }}</p>
      </n-flex>

      <!-- 步骤条 -->
      <n-steps size="small" class="w-full px-40px mt-20px" :current="currentStep" :status="stepStatus">
        <n-step :title="t('auth.forget.steps.verify.title')" :description="t('auth.forget.steps.verify.desc')" />
        <n-step :title="t('auth.forget.steps.reset.title')" :description="t('auth.forget.steps.reset.desc')" />
        <n-step :title="t('auth.forget.steps.done.title')" :description="t('auth.forget.steps.done.desc')" />
      </n-steps>

      <!-- 第一步：验证邮箱 -->
      <div v-if="currentStep === 1" class="w-full max-w-300px mx-auto mt-30px">
        <n-form ref="formRef" :model="formData" :rules="emailRules">
          <!-- 邮箱输入 -->
          <n-form-item path="email" :label="t('auth.forget.form.email_label')">
            <n-input
              :allow-input="noSideSpace"
              class="border-(1px solid var(--tjg-text-tertiary)/80) no-indent-input w-300px!"
              v-model:value="formData.email"
              :placeholder="t('auth.forget.form.email_placeholder')"
              spellCheck="false"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              clearable />
          </n-form-item>

          <!-- 图片验证码 -->
          <n-form-item v-if="captchaImage" path="captchaCode" :label="t('auth.forget.form.captcha_label')">
            <n-flex :size="8" align="center">
              <n-input
                :allow-input="noSideSpace"
                class="border-(1px solid var(--tjg-text-tertiary)/80) no-indent-input w-160px!"
                v-model:value="formData.captchaCode"
                :placeholder="t('auth.forget.form.captcha_placeholder')"
                spellCheck="false"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                maxlength="6" />
              <div class="relative cursor-pointer flex-shrink-0" @click="getCaptchaImage">
                <img
                  v-if="captchaImageUrl"
                  :src="captchaImageUrl"
                  :alt="t('auth.forget.form.captcha_label')"
                  class="h-34px w-100px rounded-4px border-(1px solid var(--tjg-text-tertiary)/30) object-cover" />
                <n-button v-else size="small" quaternary :loading="captchaLoading">
                  {{ t('auth.forget.actions.refresh_captcha') }}
                </n-button>
                <div
                  v-if="captchaInCooldown"
                  class="absolute inset-0 flex items-center justify-center bg-black/30 rounded-4px text-12px text-white">
                  {{ captchaCooldownRemaining }}s
                </div>
              </div>
            </n-flex>
          </n-form-item>

          <!-- 邮箱验证码 -->
          <n-form-item path="emailCode" :label="t('auth.forget.form.code_label')">
            <n-flex :size="8">
              <n-input
                :allow-input="noSideSpace"
                class="border-(1px solid var(--tjg-text-tertiary)/80) no-indent-input w-300px!"
                v-model:value="formData.emailCode"
                :placeholder="t('auth.forget.form.code_placeholder')"
                spellCheck="false"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                maxlength="6" />
              <n-button
                color="var(--tjg-color-primary-500)"
                ghost
                :disabled="sendBtnDisabled"
                :loading="sendingEmailCode"
                @click="sendEmailCode"
                class="min-w-100px w-fit h-34px">
                {{ emailCodeBtnText }}
              </n-button>
            </n-flex>
          </n-form-item>

          <n-button
            :loading="verifyLoading"
            :disabled="nextDisabled"
            tertiary
            style="color: var(--tjg-text-inverse)"
            @click="verifyEmail"
            class="mt-10px w-full gradient-button">
            {{ t('auth.forget.buttons.next') }}
          </n-button>
        </n-form>
      </div>

      <!-- 第二步：设置新密码 -->
      <div v-if="currentStep === 2" class="w-full max-w-300px mx-auto mt-30px">
        <n-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules">
          <!-- 新密码 -->
          <n-form-item path="password" :label="t('auth.forget.form.password_label')">
            <n-flex vertical :size="8" class="w-full">
              <n-input
                :allow-input="noSideSpace"
                class="border-(1px solid var(--tjg-text-tertiary)/80) w-full no-indent-input"
                v-model:value="passwordForm.password"
                type="password"
                show-password-on="click"
                :placeholder="t('auth.forget.form.password_placeholder')"
                maxlength="16"
                spellCheck="false"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                minlength="6" />
              <n-flex vertical :size="4" class="space-y-4px">
                <Validation
                  :value="passwordForm.password"
                  :message="t('auth.forget.password_hints.length')"
                  :validator="validateMinLength" />
                <Validation
                  :value="passwordForm.password"
                  :message="t('auth.forget.password_hints.alpha_numeric')"
                  :validator="validateAlphaNumeric" />
                <Validation
                  :value="passwordForm.password"
                  :message="t('auth.forget.password_hints.special_char')"
                  :validator="validateSpecialChar" />
              </n-flex>
            </n-flex>
          </n-form-item>

          <!-- 确认密码 -->
          <n-form-item path="confirmPassword" :label="t('auth.forget.form.confirm_label')">
            <n-flex vertical :size="8" class="w-full">
              <n-input
                :allow-input="noSideSpace"
                class="border-(1px solid var(--tjg-text-tertiary)/80) w-full no-indent-input"
                v-model:value="passwordForm.confirmPassword"
                type="password"
                show-password-on="click"
                :placeholder="t('auth.forget.form.confirm_placeholder')"
                spellCheck="false"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                maxlength="16"
                minlength="6" />
              <n-flex vertical :size="4">
                <Validation
                  :value="passwordForm.confirmPassword"
                  :message="t('auth.forget.password_hints.confirm_match')"
                  :validator="(value: string) => value === passwordForm.password && value !== ''" />
              </n-flex>
            </n-flex>
          </n-form-item>

          <n-flex :size="16" class="mt-30px">
            <n-button @click="goBack" class="flex-1">{{ t('auth.forget.buttons.prev') }}</n-button>
            <n-button
              :loading="submitLoading"
              tertiary
              style="color: var(--tjg-text-inverse)"
              @click="submitNewPassword"
              class="flex-1 gradient-button">
              {{ t('auth.forget.buttons.submit') }}
            </n-button>
          </n-flex>
        </n-form>
      </div>

      <!-- 第三步：完成 -->
      <div v-if="currentStep === 3" class="w-full max-w-300px mx-auto mt-100px text-center">
        <!-- <n-icon size="64" class="text-[--tjg-color-primary-500]">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path fill="currentColor" d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z" />
          </svg>
        </n-icon> -->
        <img class="size-98px" src="/emoji/party-popper.webp" alt="庆祝" />

        <div class="mt-16px text-18px">{{ t('auth.forget.success.title') }}</div>
        <div class="mt-16px text-14px text-[--tjg-text-secondary]">{{ t('auth.forget.success.desc') }}</div>
      </div>
    </n-flex>
  </n-config-provider>
</template>

<script setup lang="ts">
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { darkTheme, type FormInst, lightTheme } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import Validation from '@/components/common/Validation.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { MatrixAuthService } from '@/services/matrix/auth/MatrixAuthService'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { validateAlphaNumeric, validateSpecialChar } from '@/utils/Validate'

const settingStore = useSettingStore()
const logger = createLogger('ForgetPassword')
const naiveTheme = computed(() => (settingStore.themeContent === 'dark' ? darkTheme : lightTheme))
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

// 导入Web Worker
const timerWorker = new Worker(new URL('../../workers/timer.worker.ts', import.meta.url), { type: 'module' })

// 步骤状态
const currentStep = ref(1)
const stepStatus = ref<'error' | 'finish' | 'process' | 'wait' | undefined>('process')

// 第一步表单数据
const formRef = ref<FormInst | null>(null)
const formData = ref({
  email: '',
  emailCode: '',
  uuid: '',
  captchaCode: ''
})

// 图片验证码相关
const captchaImage = ref('')
const captchaImageUrl = ref('')
const captchaLoading = ref(false)
const captchaVerified = ref(false)
const sendBtnDisabled = ref(false)
const emailCodeBtnText = ref(t('auth.forget.actions.send_code'))
const countDown = ref(60)
const verifyLoading = ref(false)
// 发送验证码loading状态
const sendingEmailCode = ref(false)
const emailSessionId = ref('')
const emailClientSecret = ref('')
const emailSendAttempt = ref(1)
const emailVerified = ref(false)
// 上次获取图片验证码的时间
const lastCaptchaTime = ref(0)
// 图片验证码获取间隔时间(毫秒)
const captchaInterval = 10000
// 图片验证码是否在冷却中
const captchaInCooldown = ref(false)
// 图片验证码冷却剩余时间
const captchaCooldownRemaining = ref(0)
// 验证码计时器的唯一ID
const EMAIL_TIMER_ID = 'email_verification_timer'
// 图片验证码限制计时器ID
const CAPTCHA_TIMER_ID = 'captcha_cooldown_timer'

// 邮箱校验规则
const emailRules = {
  email: [
    { required: true, message: t('auth.forget.rules.email_required'), trigger: 'blur' },
    {
      pattern: /^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/,
      message: t('auth.forget.rules.email_format'),
      trigger: 'blur'
    }
  ],
  emailCode: [
    { required: true, message: t('auth.forget.rules.code_required'), trigger: 'input' },
    { min: 6, max: 6, message: t('auth.forget.rules.code_length'), trigger: 'blur' }
  ]
}

// 第二步密码表单
const passwordFormRef = ref<FormInst | null>(null)
const passwordForm = ref({
  password: '',
  confirmPassword: ''
})
const submitLoading = ref(false)

// 密码校验规则
const passwordRules = {
  password: [
    { required: true, message: t('auth.forget.rules.password_required'), trigger: 'blur' },
    { min: 6, max: 16, message: t('auth.forget.rules.password_length'), trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: t('auth.forget.rules.confirm_required'), trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string) => {
        return value === passwordForm.value.password
      },
      message: t('auth.forget.rules.confirm_mismatch'),
      trigger: 'blur'
    }
  ]
}

// 下一步按钮禁用状态
const nextDisabled = computed(() => {
  return !(formData.value.email && formData.value.emailCode)
})

/** 不允许输入空格 */
const noSideSpace = (value: string) => !value.startsWith(' ') && !value.endsWith(' ')

/** 密码验证函数 */
const validateMinLength = (value: string) => value.length >= 6

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error && error.message ? error.message : fallback
}

// 获取图片验证码
const getCaptchaImage = async () => {
  if (captchaInCooldown.value) {
    showFeedback(t('auth.forget.messages.captcha_cooldown', { seconds: captchaCooldownRemaining.value }), 'warning')
    return
  }

  try {
    captchaLoading.value = true
    lastCaptchaTime.value = Date.now()
    captchaInCooldown.value = true
    captchaVerified.value = false

    const result = await MatrixAuthService.getCaptcha()
    captchaImage.value = result.mxc_url
    formData.value.uuid = result.session

    if (result.mxc_url) {
      try {
        const url = matrixMediaService.getMediaUrl(result.mxc_url)
        captchaImageUrl.value = url || result.mxc_url
      } catch {
        captchaImageUrl.value = result.mxc_url
      }
    }

    timerWorker.postMessage({
      type: 'startTimer',
      msgId: CAPTCHA_TIMER_ID,
      duration: captchaInterval
    })
  } catch (error) {
    logger.error('获取验证码失败', error)
    showFeedback(getErrorMessage(error, '获取验证码失败，请稍后重试'), 'error')
    captchaInCooldown.value = false
  } finally {
    captchaLoading.value = false
  }
}

// 发送邮箱验证码
const sendEmailCode = async () => {
  if (!formData.value.email) {
    showFeedback(t('auth.forget.messages.enter_email'), 'warning')
    return
  }

  if (!/^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/.test(formData.value.email)) {
    showFeedback(t('auth.forget.messages.email_format'), 'warning')
    return
  }

  if (captchaImage.value && !captchaVerified.value && formData.value.captchaCode) {
    try {
      const result = await MatrixAuthService.verifyCaptcha(formData.value.uuid, formData.value.captchaCode)
      if (!result.success) {
        showFeedback(t('auth.forget.messages.captcha_invalid'), 'error')
        getCaptchaImage()
        return
      }
      captchaVerified.value = true
    } catch (error) {
      logger.error('验证码校验失败', error)
      showFeedback(getErrorMessage(error, t('auth.forget.messages.captcha_invalid')), 'error')
      getCaptchaImage()
      return
    }
  }

  sendingEmailCode.value = true

  try {
    const email = formData.value.email.trim()
    formData.value.email = email

    const result = await MatrixAuthService.requestPasswordEmailToken(email, emailSendAttempt.value)
    emailSessionId.value = result.sid
    emailClientSecret.value = result.client_secret
    emailVerified.value = false
    emailSendAttempt.value += 1

    showFeedback(t('auth.forget.messages.code_sent'), 'success')

    sendBtnDisabled.value = true
    countDown.value = 60
    emailCodeBtnText.value = t('auth.forget.actions.retry_in', { seconds: countDown.value })

    timerWorker.postMessage({
      type: 'startTimer',
      msgId: EMAIL_TIMER_ID,
      duration: 60 * 1000
    })
  } catch (error) {
    logger.error('发送验证码失败', error)
    showFeedback(getErrorMessage(error, '发送验证码失败，请稍后重试'), 'error')
    getCaptchaImage()
  } finally {
    sendingEmailCode.value = false
  }
}

// 验证邮箱
const verifyEmail = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    verifyLoading.value = true
    if (!emailSessionId.value || !emailClientSecret.value) {
      throw new Error('请先发送邮箱验证码')
    }

    formData.value.emailCode = formData.value.emailCode.trim()
    await MatrixAuthService.submitEmailToken(
      formData.value.emailCode,
      emailClientSecret.value,
      emailSessionId.value,
      'password_reset'
    )

    emailVerified.value = true
    currentStep.value = 2
  } catch (error) {
    logger.error('表单验证失败', error)
    showFeedback(getErrorMessage(error, '邮箱验证码校验失败，请稍后重试'), 'error')
  } finally {
    verifyLoading.value = false
  }
}

// 返回上一步
const goBack = () => {
  emailVerified.value = false
  currentStep.value = 1
}

// 提交新密码
const submitNewPassword = async () => {
  if (!passwordFormRef.value) return

  try {
    await passwordFormRef.value.validate()
    submitLoading.value = true

    if (!emailVerified.value || !emailSessionId.value || !emailClientSecret.value) {
      throw new Error('请先完成邮箱验证码校验')
    }

    await MatrixAuthService.resetPassword(
      passwordForm.value.password,
      emailSessionId.value,
      'm.login.email.identity',
      undefined,
      emailClientSecret.value
    )

    currentStep.value = 3
    stepStatus.value = 'finish'
  } catch (error) {
    logger.error('重置密码失败', error)
    showFeedback(getErrorMessage(error, '重置密码失败，请稍后重试'), 'error')
  } finally {
    submitLoading.value = false
  }
}

// 监听 Worker 消息
timerWorker.onmessage = (e) => {
  const { type, msgId, remainingTime } = e.data

  if (msgId === EMAIL_TIMER_ID) {
    // 邮箱验证码计时器消息处理
    if (type === 'debug') {
      // 更新倒计时显示
      const secondsRemaining = Math.ceil(remainingTime / 1000)
      countDown.value = secondsRemaining
      emailCodeBtnText.value = t('auth.forget.actions.retry_in', { seconds: secondsRemaining })
    } else if (type === 'timeout') {
      // 计时结束
      sendBtnDisabled.value = false
      emailCodeBtnText.value = t('auth.forget.actions.resend')
    }
  } else if (msgId === CAPTCHA_TIMER_ID) {
    // 图片验证码冷却计时器消息处理
    if (type === 'debug') {
      // 更新剩余冷却时间，供用户点击时显示
      captchaCooldownRemaining.value = Math.ceil(remainingTime / 1000)
    } else if (type === 'timeout') {
      // 冷却结束
      captchaInCooldown.value = false
      captchaCooldownRemaining.value = 0
    }
  }
}

// Worker 错误处理
timerWorker.onerror = (error) => {
  logger.error('Timer Worker Error', error)
  sendBtnDisabled.value = false
  emailCodeBtnText.value = t('auth.forget.actions.resend')
}

// 页面加载时获取验证码
onMounted(async () => {
  if (hasTauriRuntime()) {
    await getCurrentWebviewWindow().show()
  }
  getCaptchaImage()
})

// 组件销毁时清除定时器
onBeforeUnmount(() => {
  // 清除Web Worker计时器
  timerWorker.postMessage({
    type: 'clearTimer',
    msgId: EMAIL_TIMER_ID
  })

  // 清除图片验证码冷却计时器
  timerWorker.postMessage({
    type: 'clearTimer',
    msgId: CAPTCHA_TIMER_ID
  })

  // 可选：终止Worker (如果不需要在其他地方使用)
  timerWorker.terminate()
})
</script>
<style scoped lang="scss">
@use '@/styles/scss/login';

:deep(.no-indent-input.n-input .n-input__input),
:deep(.no-indent-input.n-input .n-input__textarea) {
  margin-left: 0 !important;
}
</style>
