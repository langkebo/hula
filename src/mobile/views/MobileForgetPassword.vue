<template>
  <MobileLayout :safeAreaTop="true" class="overflow-hidden" :safeAreaBottom="true">
    <HeaderBar
      :isOfficial="false"
      :hidden-right="true"
      :enable-default-background="false"
      :enable-shadow="false"
      :room-name="t('mobile_forget_code.title')" />
    <div class="w-full size-full flex flex-col">
      <!-- 步骤条 -->
      <van-steps :active="currentStep - 1" class="w-full px-40px mt-20px">
        <van-step>{{ t('mobile_forget_code.steps.verify_email') }}</van-step>
        <van-step>{{ t('mobile_forget_code.steps.set_new_password') }}</van-step>
        <van-step>{{ t('mobile_forget_code.steps.done') }}</van-step>
      </van-steps>

      <!-- 第一步：验证邮箱 -->
      <div v-if="currentStep === 1" class="w-full max-w-300px mx-auto mt-30px">
        <!-- 邮箱输入 -->
        <van-field
          v-model="formData.email"
          :placeholder="t('mobile_forget_code.input.email')"
          :formatter="filterNoSideSpace"
          format-trigger="onChange"
          clearable
          autocomplete="off"
          :spellcheck="false"
          autocorrect="off"
          autocapitalize="off"
          :label="t('mobile_forget_code.input.label.email')" />

        <!-- 邮箱验证码 -->
        <van-field
          v-model="formData.emailCode"
          :placeholder="t('mobile_forget_code.input.email_code')"
          :formatter="filterNoSideSpace"
          format-trigger="onChange"
          maxlength="6"
          clearable
          autocomplete="off"
          :spellcheck="false"
          autocorrect="off"
          autocapitalize="off"
          :label="t('mobile_forget_code.input.label.email_verification_code')">
          <template #button>
            <van-button
              size="small"
              type="primary"
              :disabled="sendBtnDisabled"
              :loading="sendingEmailCode"
              @click="sendEmailCode">
              {{ emailCodeBtnText }}
            </van-button>
          </template>
        </van-field>

        <van-button
          :loading="verifyLoading"
          :disabled="nextDisabled"
          block
          class="mt-10px gradient-button"
          @click="verifyEmail">
          {{ t('mobile_forget_code.button.next') }}
        </van-button>
      </div>

      <!-- 第二步：设置新密码 -->
      <div v-if="currentStep === 2" class="w-full max-w-300px mx-auto mt-30px">
        <!-- 新密码 -->
        <van-field
          v-model="passwordForm.password"
          :type="showNewPassword ? 'text' : 'password'"
          :placeholder="t('mobile_forget_code.input.new_pass', { len: '6-16' })"
          :formatter="filterNoSideSpace"
          format-trigger="onChange"
          maxlength="16"
          clearable
          autocomplete="off"
          :spellcheck="false"
          autocorrect="off"
          autocapitalize="off"
          :right-icon="showNewPassword ? 'eye-o' : 'closed-eye'"
          @click-right-icon="showNewPassword = !showNewPassword"
          :label="t('mobile_forget_code.input.label.new_pass')" />

        <div class="flex flex-col gap-4px px-16px mt-4px">
          <Validation
            :value="passwordForm.password"
            :message="t('mobile_forget_code.validation.minlength', { len: '6-16' })"
            :validator="validateMinLength" />
          <Validation
            :value="passwordForm.password"
            :message="t('mobile_forget_code.validation.valid_characters')"
            :validator="validateAlphaNumeric" />
          <Validation
            :value="passwordForm.password"
            :message="t('mobile_forget_code.validation.must_special_char')"
            :validator="validateSpecialChar" />
        </div>

        <!-- 确认密码 -->
        <van-field
          v-model="passwordForm.confirmPassword"
          :type="showConfirmPassword ? 'text' : 'password'"
          :placeholder="t('mobile_forget_code.input.confirm_password')"
          :formatter="filterNoSideSpace"
          format-trigger="onChange"
          maxlength="16"
          clearable
          autocomplete="off"
          :spellcheck="false"
          autocorrect="off"
          autocapitalize="off"
          :right-icon="showConfirmPassword ? 'eye-o' : 'closed-eye'"
          @click-right-icon="showConfirmPassword = !showConfirmPassword"
          :label="t('mobile_forget_code.input.label.confirm_password')" />

        <div class="flex flex-col gap-4px px-16px mt-4px">
          <Validation
            :value="passwordForm.confirmPassword"
            :message="t('mobile_forget_code.validation.passwords_match')"
            :validator="(value: string) => value === passwordForm.password && value !== ''" />
        </div>

        <div class="flex gap-16px mt-30px px-16px">
          <van-button block @click="goBack">{{ t('mobile_forget_code.button.go_back_setp') }}</van-button>
          <van-button :loading="submitLoading" block class="gradient-button" @click="submitNewPassword">
            {{ t('mobile_forget_code.button.submit') }}
          </van-button>
        </div>
      </div>

      <!-- 第三步：完成 -->
      <div v-if="currentStep === 3" class="w-full max-w-300px mx-auto mt-100px text-center">
        <img class="size-98px" src="/emoji/party-popper.webp" alt="" />
        <div class="mt-16px text-18px">{{ t('mobile_forget_code.password_reset_success') }}</div>
        <div class="mt-16px text-14px text-#666">{{ t('mobile_forget_code.password_reset_success_desc') }}</div>
      </div>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Validation from '@/components/common/Validation.vue'
import router from '@/router'
import { MatrixAuthService } from '@/services/matrix/auth/MatrixAuthService'
import { createLogger } from '@/utils/Logger'
import { validateAlphaNumeric, validateSpecialChar } from '@/utils/Validate'

const logger = createLogger('MobileForgetPassword')

const timerWorker = new Worker(new URL('../../workers/timer.worker.ts', import.meta.url), { type: 'module' })

const { t } = useI18n()

const currentStep = ref(1)

const formData = ref({
  email: '',
  emailCode: '',
  uuid: ''
})

const captchaImage = ref('')
const sendBtnDisabled = ref(false)
const emailCodeBtnText = ref(t('mobile_forget_code.button.send_email_code'))
const countDown = ref(60)
const verifyLoading = ref(false)
const sendingEmailCode = ref(false)
const emailSessionId = ref('')
const emailClientSecret = ref('')
const emailSendAttempt = ref(1)
const emailVerified = ref(false)
const lastCaptchaTime = ref(0)
const captchaInterval = 10000
const captchaInCooldown = ref(false)
const captchaCooldownRemaining = ref(0)
const EMAIL_TIMER_ID = 'email_verification_timer'
const CAPTCHA_TIMER_ID = 'captcha_cooldown_timer'

const passwordForm = ref({
  password: '',
  confirmPassword: ''
})
const submitLoading = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

const nextDisabled = computed(() => {
  return !(formData.value.email && formData.value.emailCode)
})

const filterNoSideSpace = (value: string) => value.replace(/^\s+|\s+$/g, '')

const validateMinLength = (value: string) => value.length >= 6

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error && error.message ? error.message : fallback
}

const getCaptchaImage = async () => {
  if (captchaInCooldown.value) {
    window.$message.warning(t('mobile_forget_code.too_many_requests', { s: captchaCooldownRemaining.value }))
    return
  }

  try {
    lastCaptchaTime.value = Date.now()
    captchaInCooldown.value = true

    const result = await MatrixAuthService.getCaptcha()
    captchaImage.value = result.mxc_url
    formData.value.uuid = result.session

    timerWorker.postMessage({
      type: 'startTimer',
      msgId: CAPTCHA_TIMER_ID,
      duration: captchaInterval
    })
  } catch (error) {
    logger.error('获取验证码失败', error)
    window.$message.error(getErrorMessage(error, '获取验证码失败，请稍后重试'))
    captchaInCooldown.value = false
  }
}

const sendEmailCode = async () => {
  if (!formData.value.email) {
    window.$message.warning(t('mobile_forget_code.rules.email_require'))
    return
  }

  if (!/^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/.test(formData.value.email)) {
    window.$message.warning(t('mobile_forget_code.rules.email_invalid'))
    return
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

    window.$message.success(t('mobile_forget_code.code_sent_email'))

    sendBtnDisabled.value = true
    countDown.value = 60
    emailCodeBtnText.value = t('mobile_forget_code.email_resend_in', { seconds: countDown.value })

    timerWorker.postMessage({
      type: 'startTimer',
      msgId: EMAIL_TIMER_ID,
      duration: 60 * 1000
    })
  } catch (error) {
    logger.error('发送验证码失败', error)
    window.$message.error(getErrorMessage(error, '发送验证码失败，请稍后重试'))
    getCaptchaImage()
  } finally {
    sendingEmailCode.value = false
  }
}

const verifyEmail = async () => {
  if (!formData.value.email || !formData.value.emailCode) {
    window.$message.warning(t('mobile_forget_code.rules.email_require'))
    return
  }

  try {
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
    window.$message.error(getErrorMessage(error, '邮箱验证码校验失败，请稍后重试'))
  } finally {
    verifyLoading.value = false
  }
}

const goBack = () => {
  emailVerified.value = false
  currentStep.value = 1
}

const submitNewPassword = async () => {
  if (!passwordForm.value.password || !passwordForm.value.confirmPassword) {
    window.$message.warning(t('mobile_forget_code.rules.new_pass_require'))
    return
  }

  if (passwordForm.value.password !== passwordForm.value.confirmPassword) {
    window.$message.warning(t('mobile_forget_code.rules.pass_not_match'))
    return
  }

  try {
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

    setTimeout(() => {
      router.push('/mobile/login')
    }, 2000)
  } catch (error) {
    logger.error('重置密码失败', error)
    window.$message.error(getErrorMessage(error, '重置密码失败，请稍后重试'))
  } finally {
    submitLoading.value = false
  }
}

timerWorker.onmessage = (e) => {
  const { type, msgId, remainingTime } = e.data

  if (msgId === EMAIL_TIMER_ID) {
    if (type === 'debug') {
      const secondsRemaining = Math.ceil(remainingTime / 1000)
      countDown.value = secondsRemaining
      emailCodeBtnText.value = t('mobile_forget_code.email_resend_in', { seconds: secondsRemaining })
    } else if (type === 'timeout') {
      sendBtnDisabled.value = false
      emailCodeBtnText.value = t('mobile_forget_code.button.send_email_code')
    }
  } else if (msgId === CAPTCHA_TIMER_ID) {
    if (type === 'debug') {
      captchaCooldownRemaining.value = Math.ceil(remainingTime / 1000)
    } else if (type === 'timeout') {
      captchaInCooldown.value = false
      captchaCooldownRemaining.value = 0
    }
  }
}

timerWorker.onerror = (error) => {
  logger.error('Timer Worker Error', error)
  sendBtnDisabled.value = false
  emailCodeBtnText.value = t('mobile_forget_code.button.send_email_code')
}

onMounted(async () => {
  getCaptchaImage()
})

onBeforeUnmount(() => {
  timerWorker.postMessage({
    type: 'clearTimer',
    msgId: EMAIL_TIMER_ID
  })

  timerWorker.postMessage({
    type: 'clearTimer',
    msgId: CAPTCHA_TIMER_ID
  })

  timerWorker.terminate()
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/login';

:deep(.van-cell.van-field) {
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 8px;
  margin-bottom: 8px;
}

:deep(.van-cell.van-field::after) {
  display: none;
}

:deep(.van-field__control) {
  font-size: 16px;
}

:deep(.van-field__right-icon) {
  color: #505050;
  cursor: pointer;
}

:deep(.van-field__clear) {
  color: #909090;
}

:deep(.van-steps) {
  background: transparent;
}

:deep(.van-step__title) {
  font-size: 12px;
}
</style>
