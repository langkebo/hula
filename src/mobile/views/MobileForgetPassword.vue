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

      <ForgetPasswordEmailStep
        v-if="currentStep === 1"
        v-model:email="formData.email"
        v-model:code="formData.emailCode"
        :loading="verifyLoading"
        :sending="sendingEmailCode"
        :send-disabled="sendBtnDisabled"
        :code-button-text="emailCodeBtnText"
        :next-disabled="nextDisabled"
        @send-code="sendEmailCode"
        @submit="verifyEmail" />

      <ForgetPasswordResetStep
        v-if="currentStep === 2"
        v-model:password="passwordForm.password"
        v-model:confirm-password="passwordForm.confirmPassword"
        :loading="submitLoading"
        @back="goBack"
        @submit="submitNewPassword" />

      <!-- 第三步：完成 -->
      <div v-if="currentStep === 3" class="w-full max-w-300px mx-auto mt-100px text-center">
        <img class="size-98px" src="/emoji/party-popper.webp" :alt="t('common.celebration')" />
        <div class="mt-16px text-18px">{{ t('mobile_forget_code.password_reset_success') }}</div>
        <div class="mt-16px text-14px text-[--tjg-text-secondary]">
          {{ t('mobile_forget_code.password_reset_success_desc') }}
        </div>
      </div>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ForgetPasswordEmailStep from '#/components/login/ForgetPasswordEmailStep.vue'
import ForgetPasswordResetStep from '#/components/login/ForgetPasswordResetStep.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import router from '@/router'
import { MatrixAuthService } from '@/services/matrix/auth/MatrixAuthService'
import { acquireTimerWorker } from '@/services/timerWorkerHost'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileForgetPassword')

const timerWorker = acquireTimerWorker()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

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

const nextDisabled = computed(() => {
  return !(formData.value.email && formData.value.emailCode)
})

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error && error.message ? error.message : fallback
}

const getCaptchaImage = async () => {
  if (captchaInCooldown.value) {
    showFeedback(t('mobile_forget_code.too_many_requests', { s: captchaCooldownRemaining.value }), 'warning')
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
    logger.error('Failed to fetch verification code', error)
    showFeedback(getErrorMessage(error, t('mobile_forget_code.captcha_failed')), 'error')
    captchaInCooldown.value = false
  }
}

const sendEmailCode = async () => {
  if (!formData.value.email) {
    showFeedback(t('mobile_forget_code.rules.email_require'), 'warning')
    return
  }

  if (!/^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/.test(formData.value.email)) {
    showFeedback(t('mobile_forget_code.rules.email_invalid'), 'warning')
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

    showFeedback(t('mobile_forget_code.code_sent_email'), 'success')

    sendBtnDisabled.value = true
    countDown.value = 60
    emailCodeBtnText.value = t('mobile_forget_code.email_resend_in', { seconds: countDown.value })

    timerWorker.postMessage({
      type: 'startTimer',
      msgId: EMAIL_TIMER_ID,
      duration: 60 * 1000
    })
  } catch (error) {
    logger.error('Failed to send verification code', error)
    showFeedback(getErrorMessage(error, t('mobile_forget_code.send_code_failed')), 'error')
    getCaptchaImage()
  } finally {
    sendingEmailCode.value = false
  }
}

const verifyEmail = async () => {
  if (!formData.value.email || !formData.value.emailCode) {
    showFeedback(t('mobile_forget_code.rules.email_require'), 'warning')
    return
  }

  try {
    verifyLoading.value = true
    if (!emailSessionId.value || !emailClientSecret.value) {
      throw new Error(t('mobile_forget_code.send_email_code_first'))
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
    logger.error('Form validation failed', error)
    showFeedback(getErrorMessage(error, t('mobile_forget_code.verify_email_failed')), 'error')
  } finally {
    verifyLoading.value = false
  }
}

const goBack = () => {
  emailVerified.value = false
  formData.value.emailCode = ''
  passwordForm.value.password = ''
  passwordForm.value.confirmPassword = ''
  currentStep.value = 1
}

const submitNewPassword = async () => {
  if (!passwordForm.value.password || !passwordForm.value.confirmPassword) {
    showFeedback(t('mobile_forget_code.rules.new_pass_require'), 'warning')
    return
  }

  if (passwordForm.value.password !== passwordForm.value.confirmPassword) {
    showFeedback(t('mobile_forget_code.rules.pass_not_match'), 'warning')
    return
  }

  try {
    submitLoading.value = true

    if (!emailVerified.value || !emailSessionId.value || !emailClientSecret.value) {
      throw new Error(t('mobile_forget_code.complete_email_verify_first'))
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
    logger.error('Failed to reset password', error)
    showFeedback(getErrorMessage(error, t('mobile_forget_code.reset_password_failed')), 'error')
  } finally {
    submitLoading.value = false
  }
}

timerWorker.onMessage((event) => {
  if (event.type === 'allTimersCompleted') return
  const { msgId } = event

  if (msgId === EMAIL_TIMER_ID) {
    if (event.type === 'debug') {
      const secondsRemaining = Math.ceil(event.remainingTime / 1000)
      countDown.value = secondsRemaining
      emailCodeBtnText.value = t('mobile_forget_code.email_resend_in', { seconds: secondsRemaining })
    } else {
      sendBtnDisabled.value = false
      emailCodeBtnText.value = t('mobile_forget_code.button.send_email_code')
    }
  } else if (msgId === CAPTCHA_TIMER_ID) {
    if (event.type === 'debug') {
      captchaCooldownRemaining.value = Math.ceil(event.remainingTime / 1000)
    } else {
      captchaInCooldown.value = false
      captchaCooldownRemaining.value = 0
    }
  }
})

timerWorker.onError((error) => {
  logger.error('Timer Worker Error', error)
  sendBtnDisabled.value = false
  emailCodeBtnText.value = t('mobile_forget_code.button.send_email_code')
})

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

  timerWorker.release()
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/login';

:deep(.van-cell.van-field) {
  padding: 10px 16px;
  background: var(--tjg-overlay-mobile-sheet);
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
  color: var(--tjg-text-secondary);
  cursor: pointer;
}

:deep(.van-field__clear) {
  color: var(--tjg-text-tertiary);
}

:deep(.van-steps) {
  background: transparent;
}

:deep(.van-step__title) {
  font-size: 12px;
}
</style>
