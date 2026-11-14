<template>
  <!-- 第一步：昵称和密码 -->
  <div v-if="currentStep === 1" class="text-center w-80% max-w-375px flex flex-col gap-16px">
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

    <Validation
      v-if="registerInfo.nickName"
      :value="registerInfo.nickName"
      :message="t('login.mobile.register.pass_validate_info.valid_nickname')"
      :validator="validateUsername" />

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
        :message="t('login.mobile.register.pass_validate_info.minlength', { len: 8 })"
        :validator="validatePasswordMinLength" />
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
      <van-checkbox
        v-model="registerProtocol"
        shape="square"
        icon-size="16px"
        :aria-label="t('login.term.checkout.agree_label')" />
      <div class="text-12px color-[--tjg-text-secondary] cursor-default lh-14px">
        <span>{{ t('login.term.checkout.text1') }}</span>
        <span
          v-clickable
          @click.stop="emit('to-service-agreement')"
          class="color-[--tjg-color-primary-600] cursor-pointer">
          {{ t('login.term.checkout.text2') }}
        </span>
        <span>{{ t('login.term.checkout.text3') }}</span>
        <span
          v-clickable
          @click.stop="emit('to-privacy-agreement')"
          class="color-[--tjg-color-primary-600] cursor-pointer">
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
  <RegisterEmailVerifyStep
    v-else-if="currentStep === 2"
    v-model:email="registerInfo.email"
    v-model:code="registerInfo.code"
    :loading="registerLoading"
    :send-loading="sendCodeLoading"
    :countdown="sendCodeCountdown"
    :submit-disabled="isStep2Valid"
    @send-code="handleSendEmailCode"
    @submit="handleRegisterComplete" />
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Validation from '@/components/common/Validation.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSessionActions } from '@/composables/user/useSessionActions'
import type { RegisterUserReq } from '@/services/types'
import { createLogger } from '@/utils/Logger'
import { padZero } from '@/utils/StringUtils'
import {
  validateAlphaNumeric,
  validatePasswordMinLength,
  validateSpecialChar,
  validateUsername
} from '@/utils/Validate'
import { useSendCodeCountdown } from '../../composables/useSendCodeCountdown'
import RegisterEmailVerifyStep from './RegisterEmailVerifyStep.vue'

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
const registerPasswordPH = ref(t('login.mobile.register.input.password'))
const confirmPasswordPH = ref(t('login.mobile.register.input.confirm_password'))
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

const filterNoSideSpace = (value: string) => value.replace(/^\s+|\s+$/g, '')

const isEmailValid = computed(() => {
  const email = registerInfo.value.email.trim()
  if (!email) return false
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)
})

const isNicknameValid = computed(() => validateUsername(registerInfo.value.nickName))

const isPasswordValid = computed(() => {
  return (
    validatePasswordMinLength(registerInfo.value.password) &&
    validateAlphaNumeric(registerInfo.value.password) &&
    validateSpecialChar(registerInfo.value.password)
  )
})

const isStep1Valid = computed(() => {
  return (
    registerInfo.value.nickName &&
    isNicknameValid.value &&
    isPasswordValid.value &&
    registerInfo.value.confirmPassword === registerInfo.value.password &&
    registerProtocol.value
  )
})

/**
 * 第二步必须同时具备「邮箱格式合法 + 已填验证码 + 已拿到邮箱会话」。
 * 只用验证码判断会绕过邮箱身份校验：空 session 时直接注册成功。
 */
const isStep2Valid = computed(
  () => isEmailValid.value && !!registerInfo.value.code.trim() && !!emailSessionId.value && !!emailClientSecret.value
)

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
  registerPasswordPH.value = t('login.mobile.register.input.password')
  confirmPasswordPH.value = t('login.mobile.register.input.confirm_password')
  sendCodeLoading.value = false
  emailSessionId.value = ''
  emailClientSecret.value = ''
  stopSendCodeCountdown()
}

const handleRegisterStep = () => {
  currentStep.value = 2
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
    registerInfo.value.avatar = padZero(avatarNum, 3)

    await submitEmailToken(registerInfo.value.code, emailClientSecret.value, emailSessionId.value)

    await registerAccount(
      registerInfo.value.nickName,
      registerInfo.value.password,
      emailSessionId.value,
      'm.login.email.identity',
      undefined,
      emailClientSecret.value
    )

    showFeedback(t('login.mobile.register_success'), 'success')
    emit('registered', registerInfo.value.nickName || registerInfo.value.email)
  } catch (error) {
    showFeedback(error instanceof Error && error.message ? error.message : t('login.mobile.register_fail'), 'error')
    logger.error('Registration failed:', error)
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
