<template>
  <MobileLayout :backgroundImage="'/login_bg.png'" :safeAreaTop="false" :safeAreaBottom="false">
    <div class="h-full flex-col-center gap-40px">
      <div class="flex-center absolute top-13vh left-36px">
        <p class="text-(20px [--hula-text-primary])">{{ t('login.mobile.welcome_title') }}</p>
        <img src="@/assets/mobile/2.svg" alt="HuLa" class="w-80px h-20px" />
      </div>

      <!-- 选项卡导航 -->
      <div class="w-80% h-40px absolute top-20vh flex-center">
        <div class="flex w-200px relative">
          <div
            @click="activeTab = 'login'"
            :class="[
              'z-999 w-100px text-center transition-all duration-300 ease-out',
              activeTab === 'login' ? 'text-(18px [--hula-text-primary])' : 'text-(16px [--hula-text-secondary])'
            ]">
            {{ t('login.mobile.tabs.login') }}
          </div>
          <div
            @click="activeTab = 'register'"
            :class="[
              'z-999 w-100px text-center transition-all duration-300 ease-out',
              activeTab === 'register' ? 'text-(18px [--hula-text-primary])' : 'text-(16px [--hula-text-secondary])'
            ]">
            {{ t('login.mobile.tabs.register') }}
          </div>
          <div
            style="border-radius: 24px 42px 4px 24px"
            :class="[
              'z-10 absolute bottom--4px h-6px w-34px bg-[--hula-color-primary-500] transition-all duration-300 ease-out',
              activeTab === 'login' ? 'left-[33px]' : 'left-[133px]'
            ]"></div>
        </div>
      </div>

      <!-- 头像 -->
      <img v-if="activeTab === 'login'" :src="userInfo.avatar" alt="logo" class="size-86px rounded-full" />

      <!-- 登录表单 -->
      <div v-if="activeTab === 'login'" class="text-center w-80% flex flex-col gap-16px">
        <van-field
          :class="{ 'pl-22px': loginHistories.length > 0 }"
          v-model="userInfo.account"
          :placeholder="accountPH"
          @focus="accountPH = ''"
          @blur="accountPH = t('login.mobile.input.account_placeholder')"
          clearable
          autocomplete="off"
          :spellcheck="false"
          autocorrect="off"
          autocapitalize="off">
          <template #right-icon>
            <div v-if="loginHistories.length > 0" @click="arrowStatus = !arrowStatus">
              <svg v-if="!arrowStatus" class="down w-18px h-18px color-[--chat-text-color]">
                <use href="#down"></use>
              </svg>
              <svg v-else class="down w-18px h-18px color-[--chat-text-color]"><use href="#up"></use></svg>
            </div>
          </template>
        </van-field>

        <!-- 账号选择框 -->
        <div
          style="border: 1px solid rgba(70, 70, 70, 0.1)"
          v-if="loginHistories.length > 0 && arrowStatus"
          class="account-box absolute w-80% max-h-140px bg-[--hula-surface-elevated] mt-45px z-99 rounded-8px p-8px box-border">
          <div style="max-height: 120px; overflow-y: auto">
            <div
              v-for="item in loginHistories"
              :key="item.account"
              @click="giveAccount(item)"
              class="p-8px hover:bg-[--bg-msg-hover] hover:rounded-6px">
              <div class="flex-between-center">
                <img
                  :src="AvatarUtils.getAvatarUrl(item.avatar)"
                  alt="用户头像"
                  class="size-28px bg-[--hula-text-disabled] rounded-50% object-cover" />
                <p class="text-14px color-[--chat-text-color]">{{ item.account }}</p>
                <svg @click.stop="delAccount(item)" class="w-12px h-12px">
                  <use href="#close"></use>
                </svg>
              </div>
            </div>
          </div>
        </div>

        <van-field
          class="pl-22px mt-8px"
          v-model="userInfo.password"
          :type="showLoginPassword ? 'text' : 'password'"
          :placeholder="passwordPH"
          @focus="passwordPH = ''"
          @blur="passwordPH = t('login.mobile.input.code_placeholder')"
          clearable
          autocomplete="off"
          :spellcheck="false"
          autocorrect="off"
          autocapitalize="off"
          :right-icon="showLoginPassword ? 'eye-o' : 'closed-eye'"
          @click-right-icon="showLoginPassword = !showLoginPassword" />

        <div class="flex justify-end">
          <van-button size="small" plain type="primary" @click="handleForgetPassword">
            {{ t('login.mobile.forget_code') }}
          </van-button>
        </div>

        <van-button
          :loading="loading"
          :disabled="loginDisabled"
          block
          class="mt-8px mb-50px gradient-button"
          @click="normalLogin('MOBILE', true, false)">
          <span>{{ loginText }}</span>
        </van-button>

        <!-- 协议 -->
        <div class="flex items-center justify-center gap-6px absolute bottom-0 w-[80%]" :style="agreementStyle">
          <van-checkbox v-model="protocol" shape="square" icon-size="16px" />
          <div class="text-12px color-[--hula-text-tertiary] cursor-default lh-14px">
            <span>{{ t('login.term.checkout.text1') }}</span>
            <span @click.stop="toServiceAgreement" class="color-[--hula-color-primary-500] cursor-pointer">
              {{ t('login.term.checkout.text2') }}
            </span>
            <span>{{ t('login.term.checkout.text3') }}</span>
            <span @click.stop="toPrivacyAgreement" class="color-[--hula-color-primary-500] cursor-pointer">
              {{ t('login.term.checkout.text4') }}
            </span>
          </div>
        </div>
      </div>

      <!-- 注册表单 - 第一步：昵称和密码 -->
      <div v-if="activeTab === 'register' && currentStep === 1" class="text-center w-80% flex flex-col gap-16px">
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
          <div class="text-12px color-[--hula-text-tertiary] cursor-default lh-14px">
            <span>{{ t('login.term.checkout.text1') }}</span>
            <span @click.stop="toServiceAgreement" class="color-[--hula-color-primary-500] cursor-pointer">
              {{ t('login.term.checkout.text2') }}
            </span>
            <span>{{ t('login.term.checkout.text3') }}</span>
            <span @click.stop="toPrivacyAgreement" class="color-[--hula-color-primary-500] cursor-pointer">
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

      <!-- 注册表单 - 第二步：邮箱和图片验证码 -->
      <div v-if="activeTab === 'register' && currentStep === 2" class="text-center w-80% flex flex-col gap-16px">
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
          class="absolute w-80% bg-[--hula-surface-elevated] z-99 rounded-8px p-4px box-border">
          <div
            v-for="option in commonEmailDomains"
            :key="option.value"
            @click="selectEmailSuggestion(option.value)"
            class="p-8px hover:bg-[--bg-msg-hover] hover:rounded-6px text-14px color-[--chat-text-color] text-left cursor-pointer">
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
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { showFailToast } from 'vant'
import { useI18n } from 'vue-i18n'
import Validation from '@/components/common/Validation.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSessionActions } from '@/composables/user/useSessionActions'
import { MittEnum } from '@/enums'
import router from '@/router'
import type { RegisterUserReq, UserInfoType } from '@/services/types'
import { useMobileStore } from '@/stores/domains/settings/mobile'
import { useLoginHistoriesStore } from '@/stores/domains/user/loginHistory'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'
import { isAndroid, isIOS } from '@/utils/PlatformConstants'
import { invokeSilently } from '@/utils/TauriInvokeHandler'
import { validateAlphaNumeric, validateSpecialChar } from '@/utils/Validate'
import { useLoginFlow } from '../hooks/useLoginFlow'
import { useMitt } from '../hooks/useMitt'
import { WsResponseMessageType } from '../services/wsType'
import { useSettingStore } from '../stores/domains/settings/setting'

const logger = createLogger('MobileLogin')
const { loginWithSsoToken, register: registerAccount, requestEmailToken, submitEmailToken } = useSessionActions()

interface LocalRegisterInfo extends RegisterUserReq {}

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const loginHistoriesStore = useLoginHistoriesStore()
const { loginHistories } = storeToRefs(loginHistoriesStore)
const mobileStore = useMobileStore()
const safeArea = computed(() => mobileStore.safeArea)
const settingStore = useSettingStore()

const isJumpDirectly = ref(false)

const activeTab = ref<'login' | 'register'>('login')

const currentStep = ref(1)
const GENERAL_USER_SYSTEM_TYPE = 2

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

const accountPH = ref(t('login.mobile.input.account_placeholder'))
const passwordPH = ref(t('login.mobile.input.code_placeholder'))
const protocol = ref(true)
const arrowStatus = ref(false)

const registerNamePH = ref(t('login.mobile.register.input.nickname'))
const registerEmailPH = ref(t('login.mobile.register.input.email'))
const registerPasswordPH = ref(t('login.mobile.register.input.password'))
const confirmPasswordPH = ref(t('login.mobile.register.input.confirm_password'))
const registerCodePH = ref(t('login.mobile.register.input.email_verification_code'))
const registerProtocol = ref(true)
const registerLoading = ref(false)
const sendCodeLoading = ref(false)
const sendCodeCountdown = ref(0)
const emailSessionId = ref('')
const emailClientSecret = ref('')
const MOBILE_EMAIL_TIMER_ID = 'mobile_register_email_timer'
const timerWorker = new Worker(new URL('../workers/timer.worker.ts', import.meta.url), { type: 'module' })
const { normalLogin, loading, loginText, loginDisabled, info: userInfo } = useLoginFlow()

const showLoginPassword = ref(false)
const showRegPassword = ref(false)
const showConfirmPassword = ref(false)
const showEmailSuggestions = ref(false)

const sendCodeButtonText = computed(() => {
  if (sendCodeCountdown.value > 0) {
    const s = sendCodeCountdown.value
    return t('login.mobile.register.btn.resend_in', { seconds: s })
  }
  return t('login.mobile.register.btn.send_email_code')
})

const sendCodeDisabled = computed(() => {
  return sendCodeLoading.value || sendCodeCountdown.value > 0 || !registerInfo.value.email || !isEmailValid.value
})

const agreementStyle = computed(() => {
  const inset = safeArea.value.bottom || 0
  if (isAndroid()) {
    return { bottom: `${inset + 10}px` }
  }
  if (inset > 0) {
    return { bottom: `${inset}px` }
  }
  return { bottom: 'var(--safe-area-inset-bottom)' }
})

const handleSsoLoginCallback = async (): Promise<boolean> => {
  const urlParams = new URLSearchParams(window.location.search)
  const loginToken = urlParams.get('loginToken') || urlParams.get('login_token')
  if (!loginToken) {
    return false
  }

  loading.value = true
  loginText.value = t('login.status.logging_in')
  loginDisabled.value = true

  try {
    await loginWithSsoToken({
      loginToken,
      client: 'MOBILE'
    })

    useMitt.emit(MittEnum.MSG_INIT)

    const callbackUrl = new URL(window.location.href)
    callbackUrl.searchParams.delete('loginToken')
    callbackUrl.searchParams.delete('login_token')
    window.history.replaceState({}, '', callbackUrl.toString())

    await router.push('/mobile/home')
    return true
  } catch (error) {
    logger.error('Failed to complete mobile SSO login callback', error)
    showFailToast(t('login.sso_login_failed'))
    loading.value = false
    loginDisabled.value = false
    loginText.value = t('login.button.login.default')
    return false
  }
}

const stopSendCodeCountdown = () => {
  timerWorker.postMessage({
    type: 'clearTimer',
    msgId: MOBILE_EMAIL_TIMER_ID
  })
  sendCodeCountdown.value = 0
}

const startSendCodeCountdown = () => {
  sendCodeCountdown.value = 60
  timerWorker.postMessage({
    type: 'startTimer',
    msgId: MOBILE_EMAIL_TIMER_ID,
    duration: 60 * 1000
  })
}

timerWorker.onmessage = (e) => {
  const { type, msgId, remainingTime } = e.data
  if (msgId !== MOBILE_EMAIL_TIMER_ID) return

  if (type === 'debug') {
    sendCodeCountdown.value = Math.max(0, Math.ceil(remainingTime / 1000))
  } else if (type === 'timeout') {
    sendCodeCountdown.value = 0
  }
}

timerWorker.onerror = () => {
  sendCodeCountdown.value = 0
}

watch(activeTab, () => {
  stopSendCodeCountdown()
  sendCodeLoading.value = false
})

const commonEmailDomains = computed(() => {
  return ['@gmail.com', '@163.com', '@qq.com'].map((suffix) => {
    const prefix = registerInfo.value.email.split('@')[0]
    return {
      label: prefix + suffix,
      value: prefix + suffix
    }
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
  const password = registerInfo.value.password
  return validateMinLength(password) && validateAlphaNumeric(password) && validateSpecialChar(password)
})

const isStep1Valid = computed(() => {
  return (
    registerInfo.value.nickName &&
    isPasswordValid.value &&
    registerInfo.value.confirmPassword === registerInfo.value.password &&
    registerProtocol.value
  )
})

const isStep2Valid = computed(() => {
  return isEmailValid.value && !!registerInfo.value.code.trim()
})

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

watchEffect(() => {
  loginDisabled.value = !(userInfo.value.account && userInfo.value.password && protocol.value)
  if (!userInfo.value.account) {
    userInfo.value.avatar = '/logo.png'
  }
})

watch(activeTab, (newTab) => {
  if (newTab === 'login') {
    resetRegisterForm()
  } else {
    resetLoginForm()
  }
})

watch(
  () => userInfo.value.account,
  (newAccount) => {
    if (!newAccount) {
      userInfo.value.avatar = '/logo.png'
      return
    }

    refreshAvatar(newAccount)
  }
)

const resetLoginForm = () => {
  userInfo.value = {
    account: '',
    password: '',
    avatar: '',
    uid: '',
    name: ''
  }
  accountPH.value = t('login.mobile.input.account_placeholder')
  passwordPH.value = t('login.mobile.input.code_placeholder')
  arrowStatus.value = false
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

  if (sendCodeCountdown.value > 0 || sendCodeLoading.value) {
    return
  }

  sendCodeLoading.value = true
  try {
    const result = await requestEmailToken(registerInfo.value.email, 1)
    emailSessionId.value = result.sid
    emailClientSecret.value = result.client_secret
    showFeedback(t('login.mobile.code_sent_email'), 'success')
    startSendCodeCountdown()
  } catch (error) {
    logger.error(t('login.mobile.code_send_failed_with_reason', { reason: error }))
    showFeedback(getErrorMessage(error, t('login.mobile.code_send_failed_retry')), 'error')
  } finally {
    sendCodeLoading.value = false
  }
}

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error && error.message ? error.message : fallback
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
    const avatarId = avatarNum.toString().padStart(3, '0')
    registerInfo.value.avatar = avatarId

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

    activeTab.value = 'login'
    userInfo.value.account = registerInfo.value.nickName || registerInfo.value.email
    showFeedback(t('login.mobile.register_success'), 'success')

    resetRegisterForm()
  } catch (error) {
    showFeedback(getErrorMessage(error, t('login.mobile.register_fail')), 'error')
    logger.error('注册失败:', error)
  } finally {
    registerLoading.value = false
  }
}

const giveAccount = (item: UserInfoType) => {
  const { account, avatar, name, uid } = item
  userInfo.value.account = account || ''
  userInfo.value.avatar = avatar
  userInfo.value.name = name
  userInfo.value.uid = uid
  arrowStatus.value = false
}

const delAccount = (item: UserInfoType) => {
  const lengthBeforeDelete = loginHistories.value.length
  loginHistoriesStore.removeLoginHistory(item)
  if (lengthBeforeDelete === 1 && loginHistories.value.length === 0) {
    arrowStatus.value = false
  }
  userInfo.value.account = ''
  userInfo.value.password = ''
  userInfo.value.avatar = '/logo.png'
}

const handleForgetPassword = () => {
  router.push({
    name: 'mobileForgetPassword'
  })
}

const closeMenu = (event: MouseEvent) => {
  const target = event.target as Element
  if (!target.matches('.account-box, .account-box *, .down')) {
    arrowStatus.value = false
  }
}

onBeforeMount(async () => {
  if (!settingStore.autoLoginEnabled) {
    localStorage.removeItem('TOKEN')
    localStorage.removeItem('REFRESH_TOKEN')
    return
  }
})

const toServiceAgreement = () => {
  router.push({
    name: 'mobileServiceAgreement'
  })
}

const toPrivacyAgreement = () => {
  router.push({
    name: 'mobilePrivacyAgreement'
  })
}

const refreshAvatar = useDebounceFn((newAccount: string) => {
  const matchedAccount = loginHistories.value.find(
    (history) => history.account === newAccount || history.email === newAccount
  )
  if (matchedAccount) {
    userInfo.value.avatar = AvatarUtils.getAvatarUrl(matchedAccount.avatar)
  } else {
    userInfo.value.avatar = '/logo.png'
  }
}, 300)

onMounted(async () => {
  window.addEventListener('click', closeMenu, true)
  if (isIOS()) {
    invokeSilently('set_webview_keyboard_adjustment', { enabled: false })
  }
  if (isJumpDirectly.value) {
    loading.value = false
    router.push('/mobile/message')
    return
  }

  await invokeSilently('hide_splash_screen')

  if (await handleSsoLoginCallback()) {
    return
  }

  useMitt.on(WsResponseMessageType.NO_INTERNET, () => {
    loginDisabled.value = true
    loginText.value = t('login.status.service_disconnected')
  })

  if (settingStore.autoLoginEnabled) {
    normalLogin('MOBILE', true, true)
  } else {
    loginHistories.value.length > 0 && giveAccount(loginHistories.value[0])
  }
})

onUnmounted(() => {
  window.removeEventListener('click', closeMenu, true)
  stopSendCodeCountdown()
  timerWorker.terminate()
  if (isIOS()) {
    invokeSilently('set_webview_keyboard_adjustment', { enabled: false })
  }
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/login';

:deep(.van-cell.van-field) {
  padding: 10px 16px;
  background: var(--login-field-bg, rgba(255, 255, 255, 0.85));
  border-radius: 8px;
}

:deep(.van-cell.van-field::after) {
  display: none;
}

:deep(.van-field__control) {
  font-size: 16px;
}

:deep(.van-field__right-icon) {
  color: var(--hula-text-secondary);
  cursor: pointer;
}

:deep(.van-field__clear) {
  color: var(--hula-text-tertiary);
}
</style>
