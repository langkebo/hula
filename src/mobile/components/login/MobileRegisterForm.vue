<template>
  <!-- 第一步：昵称和密码 -->
  <div v-if="currentStep === 1" class="text-center w-80% flex flex-col gap-16px">
    <van-field
      v-model="registerInfo.nickName"
      maxlength="8"
      :formatter="filterNoSideSpace"
      format-trigger="onChange"
      :placeholder="registerNamePH"
      @focus="registerNamePH = ''"
      @blur="registerNamePH = t('login.mobile.register.input.nickname')"
      clearable
      autocomplete="off"
      :spellcheck="false"
      autocorrect="off"
      autocapitalize="off" />

    <van-field
      class="pl-16px"
      v-model="registerInfo.password"
      :type="showRegPassword ? 'text' : 'password'"
      :formatter="filterNoSideSpace"
      format-trigger="onChange"
      :placeholder="registerPasswordPH"
      @focus="registerPasswordPH = ''"
      @blur="registerPasswordPH = t('login.mobile.register.input.password')"
      clearable
      autocomplete="off"
      :spellcheck="false"
      autocorrect="off"
      autocapitalize="off"
      :right-icon="showRegPassword ? 'eye-o' : 'closed-eye'"
      @click-right-icon="showRegPassword = !showRegPassword" />

    <van-field
      class="pl-16px"
      v-model="registerInfo.confirmPassword"
      :type="showConfirmPassword ? 'text' : 'password'"
      :formatter="filterNoSideSpace"
      format-trigger="onChange"
      :placeholder="confirmPasswordPH"
      @focus="confirmPasswordPH = ''"
      @blur="confirmPasswordPH = t('login.mobile.register.input.confirm_password')"
      clearable
      autocomplete="off"
      :spellcheck="false"
      autocorrect="off"
      autocapitalize="off"
      :right-icon="showConfirmPassword ? 'eye-o' : 'closed-eye'"
      @click-right-icon="showConfirmPassword = !showConfirmPassword" />

    <!-- 密码提示信息 -->
    <div v-if="registerInfo.password" class="flex flex-col gap-10px mt-8px">
      <Validation
        :value="registerInfo.password"
        :message="t('login.mobile.register.pass_validate_info.minlength', { len: 6 })"
        :validator="validateMinLength" />
      <Validation
        :value="registerInfo.password"
        :message="t('login.mobile.register.pass_validate_info.valid_characters')"
        :validator="validateAlphaNumeric" />
      <Validation
        :value="registerInfo.password"
        :message="t('login.mobile.register.pass_validate_info.must_special_char')"
        :validator="validateSpecialChar" />
    </div>

    <!-- 协议 -->
    <div class="flex items-center justify-center gap-6px mt-10px">
      <van-checkbox v-model="registerProtocol" shape="square" icon-size="16px" />
      <div class="text-12px color-[--tjg-text-tertiary] cursor-default lh-14px">
        <span>{{ t('login.term.checkout.text1') }}</span>
        <span @click.stop="emit('to-service-agreement')" class="color-[--tjg-color-primary-500] cursor-pointer">
          {{ t('login.term.checkout.text2') }}
        </span>
        <span>{{ t('login.term.checkout.text3') }}</span>
        <span @click.stop="emit('to-privacy-agreement')" class="color-[--tjg-color-primary-500] cursor-pointer">
          {{ t('login.term.checkout.text4') }}
        </span>
      </div>
    </div>

    <van-button
      :loading="registerLoading"
      :disabled="!isStep1Valid"
      block
      class="mt-8px mb-50px gradient-button"
      @click="handleRegisterStep">
      <span>{{ t('login.mobile.register.btn.next') }}</span>
    </van-button>
  </div>

  <!-- 第二步：邮箱和验证码 -->
  <div v-else-if="currentStep === 2" class="text-center w-80% flex flex-col gap-16px">
    <van-field
      v-model="registerInfo.email"
      :placeholder="registerEmailPH"
      @focus="registerEmailPH = ''"
      @blur="handleEmailBlur"
      @update:model-value="onEmailInput"
      clearable
      autocomplete="off"
      :spellcheck="false"
      autocorrect="off"
      autocapitalize="off" />

    <!-- 邮箱域名建议 -->
    <div
      v-if="showEmailSuggestions"
      style="border: 1px solid rgba(70, 70, 70, 0.1)"
      class="absolute w-80% bg-[--tjg-surface-elevated] z-99 rounded-8px p-4px box-border">
      <div
        v-for="option in commonEmailDomains"
        :key="option.value"
        @click="selectEmailSuggestion(option.value)"
        class="p-8px hover:bg-[--tjg-surface-panel-muted] hover:rounded-6px text-14px color-[--chat-text-color] text-left cursor-pointer">
        {{ option.label }}
      </div>
    </div>

    <!-- 邮箱验证码 -->
    <div class="flex justify-between items-center gap-10px">
      <van-field
        v-model="registerInfo.code"
        maxlength="6"
        :formatter="filterNoSideSpace"
        format-trigger="onChange"
        :placeholder="registerCodePH"
        @focus="registerCodePH = ''"
        @blur="registerCodePH = t('login.mobile.register.input.email_verification_code')"
        clearable
        autocomplete="off"
        :spellcheck="false"
        autocorrect="off"
        autocapitalize="off"
        class="flex-1" />

      <van-button
        class="flex-shrink-0 gradient-button"
        :loading="sendCodeLoading"
        :disabled="sendCodeDisabled"
        size="small"
        @click="handleSendEmailCode">
        <span>{{ sendCodeButtonText }}</span>
      </van-button>
    </div>

    <van-button
      :loading="registerLoading"
      :disabled="!isStep2Valid"
      block
      class="mt-8px mb-50px gradient-button"
      @click="handleRegisterStep">
      <span>{{ t('login.mobile.register.btn.register') }}</span>
    </van-button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Validation from '@/components/common/Validation.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSessionActions } from '@/composables/user/useSessionActions'
import type { RegisterUserReq } from '@/services/types'
import { createLogger } from '@/utils/Logger'
import { validateAlphaNumeric, validateSpecialChar } from '@/utils/Validate'
import { useSendCodeCountdown } from '../../composables/useSendCodeCountdown'

const logger = createLogger('MobileRegisterForm')
const { register: registerAccount, requestEmailToken, submitEmailToken } = useSessionActions()

interface LocalRegisterInfo extends RegisterUserReq {}

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const props = defineProps<{
  activeTab: 'login' | 'register'
}>()

const emit = defineEmits<{
  (e: 'registered', account: string): void
  (e: 'to-service-agreement'): void
  (e: 'to-privacy-agreement'): void
}>()

const GENERAL_USER_SYSTEM_TYPE = 2
const currentStep = ref(1)

const registerInfo = ref<LocalRegisterInfo>({
  nickName: '',
  email: '',
  password: '',
  confirmPassword: '',
  code: '',
  uuid: '',
  avatar: '',
  key: 'REGISTER_EMAIL',
  systemType: GENERAL_USER_SYSTEM_TYPE
})

const registerNamePH = ref(t('login.mobile.register.input.nickname'))
const registerEmailPH = ref(t('login.mobile.register.input.email'))
const registerPasswordPH = ref(t('login.mobile.register.input.password'))
const confirmPasswordPH = ref(t('login.mobile.register.input.confirm_password'))
const registerCodePH = ref(t('login.mobile.register.input.email_verification_code'))
const registerProtocol = ref(true)
const registerLoading = ref(false)
const sendCodeLoading = ref(false)
const emailSessionId = ref('')
const emailClientSecret = ref('')

const {
  sendCodeCountdown,
  startCountdown: startSendCodeCountdown,
  stopCountdown: stopSendCodeCountdown
} = useSendCodeCountdown('mobile_register_email_timer')

const showRegPassword = ref(false)
const showConfirmPassword = ref(false)
const showEmailSuggestions = ref(false)

const sendCodeButtonText = computed(() => {
  if (sendCodeCountdown.value > 0) {
    return t('login.mobile.register.btn.resend_in', { seconds: sendCodeCountdown.value })
  }
  return t('login.mobile.register.btn.send_email_code')
})

const sendCodeDisabled = computed(() => {
  return sendCodeLoading.value || sendCodeCountdown.value > 0 || !registerInfo.value.email || !isEmailValid.value
})

const commonEmailDomains = computed(() => {
  return ['@gmail.com', '@163.com', '@qq.com'].map((suffix) => {
    const prefix = registerInfo.value.email.split('@')[0]
    return { label: prefix + suffix, value: prefix + suffix }
  })
})

const filterNoSideSpace = (value: string) => value.replace(/^\s+|\s+$/g, '')

const isEmailValid = computed(() => {
  const email = registerInfo.value.email.trim()
  if (!email) return false
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)
})

const validateMinLength = (value: string) => value.length >= 6

const isPasswordValid = computed(() => {
  return (
    validateMinLength(registerInfo.value.password) &&
    validateAlphaNumeric(registerInfo.value.password) &&
    validateSpecialChar(registerInfo.value.password)
  )
})

const isStep1Valid = computed(() => {
  return (
    registerInfo.value.nickName &&
    isPasswordValid.value &&
    registerInfo.value.confirmPassword === registerInfo.value.password &&
    registerProtocol.value
  )
})

const isStep2Valid = computed(() => isEmailValid.value && !!registerInfo.value.code.trim())

const onEmailInput = (value: string) => {
  showEmailSuggestions.value = value.endsWith('@')
}

const handleEmailBlur = () => {
  registerEmailPH.value = t('login.mobile.register.input.email')
  setTimeout(() => {
    showEmailSuggestions.value = false
  }, 150)
}

const selectEmailSuggestion = (value: string) => {
  registerInfo.value.email = value
  showEmailSuggestions.value = false
}

const resetRegisterForm = () => {
  registerInfo.value = {
    nickName: '',
    email: '',
    password: '',
    confirmPassword: '',
    code: '',
    uuid: '',
    avatar: '',
    systemType: GENERAL_USER_SYSTEM_TYPE,
    key: 'REGISTER_EMAIL'
  } as LocalRegisterInfo
  currentStep.value = 1
  registerNamePH.value = t('login.mobile.register.input.nickname')
  registerEmailPH.value = t('login.mobile.register.input.email')
  registerPasswordPH.value = t('login.mobile.register.input.password')
  confirmPasswordPH.value = t('login.mobile.register.input.confirm_password')
  registerCodePH.value = t('login.mobile.register.input.email_verification_code')
  sendCodeLoading.value = false
  emailSessionId.value = ''
  emailClientSecret.value = ''
  stopSendCodeCountdown()
}

const handleRegisterStep = async () => {
  if (currentStep.value === 1) {
    currentStep.value = 2
    return
  }
  await handleRegisterComplete()
}

const handleSendEmailCode = async () => {
  if (!isEmailValid.value) {
    showFeedback(t('login.mobile.email_invalid'), 'warning')
    return
  }
  if (sendCodeCountdown.value > 0 || sendCodeLoading.value) return

  sendCodeLoading.value = true
  try {
    const result = await requestEmailToken(registerInfo.value.email, 1)
    emailSessionId.value = result.sid
    emailClientSecret.value = result.client_secret
    showFeedback(t('login.mobile.code_sent_email'), 'success')
    startSendCodeCountdown()
  } catch (error) {
    logger.error(t('login.mobile.code_send_failed_with_reason', { reason: error }))
    showFeedback(
      error instanceof Error && error.message ? error.message : t('login.mobile.code_send_failed_retry'),
      'error'
    )
  } finally {
    sendCodeLoading.value = false
  }
}

const handleRegisterComplete = async () => {
  if (!isStep2Valid.value) {
    showFeedback(t('login.mobile.complete_info_before_register'), 'warning')
    return
  }

  try {
    registerLoading.value = true
    registerInfo.value.email = registerInfo.value.email.trim()
    registerInfo.value.code = registerInfo.value.code.trim()
    registerInfo.value.systemType = GENERAL_USER_SYSTEM_TYPE
    const avatarNum = Math.floor(Math.random() * 21) + 1
    registerInfo.value.avatar = avatarNum.toString().padStart(3, '0')

    if (emailSessionId.value && emailClientSecret.value && registerInfo.value.code) {
      await submitEmailToken(registerInfo.value.code, emailClientSecret.value, emailSessionId.value)
    }

    await registerAccount(
      registerInfo.value.nickName,
      registerInfo.value.password,
      emailSessionId.value || undefined,
      emailSessionId.value ? 'm.login.email.identity' : undefined,
      undefined,
      emailClientSecret.value || undefined
    )

    showFeedback(t('login.mobile.register_success'), 'success')
    emit('registered', registerInfo.value.nickName || registerInfo.value.email)
  } catch (error) {
    showFeedback(error instanceof Error && error.message ? error.message : t('login.mobile.register_fail'), 'error')
    logger.error('注册失败:', error)
  } finally {
    registerLoading.value = false
  }
}

watch(
  () => props.activeTab,
  (newTab) => {
    stopSendCodeCountdown()
    sendCodeLoading.value = false
    if (newTab === 'login') {
      resetRegisterForm()
    }
  }
)
</script>

<style scoped lang="scss">
@use '@/styles/scss/login';
</style>
