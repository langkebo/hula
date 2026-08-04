<template>
  <!-- 单独使用n-config-provider来包裹不需要主题切换的界面 -->
  <n-config-provider
    :theme="naiveTheme"
    data-tauri-drag-region
    class="login-box size-full rounded-8px select-none flex flex-col">
    <!--顶部操作栏-->
    <ActionBar :max-w="false" :shrink="false" />

    <div class="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden relative z-10">
      <div class="min-h-full w-full flex flex-col items-center justify-center py-20px px-20px pb-60px">
        <!-- 注册菜单 -->
        <div class="w-full max-w-260px pointer-events-auto flex flex-col gap-16px text-center">
          <div class="flex justify-center items-center gap-12px">
            <span class="text-24px color-[--color-primary] textFont">{{ t('auth.register.title') }}</span>
            <img class="w-100px h-40px" src="/tjg.png" alt="Tjg" />
          </div>

          <div class="w-full">
            <n-form :model="info" :rules="rules" ref="registerForm">
              <!-- 注册信息 -->
              <div>
                <n-form-item path="name">
                  <div class="relative w-full">
                    <n-input
                      class="w-full"
                      maxlength="8"
                      minlength="1"
                      size="large"
                      v-model:value="info.nickName"
                      type="text"
                      spellCheck="false"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      :allow-input="noSideSpace"
                      :placeholder="t('auth.register.placeholders.nickname')"
                      @focus="handleInputState($event, 'nickName')"
                      @blur="handleInputState($event, 'nickName')"
                      clearable></n-input>
                    <div
                      v-if="showNamePrefix || info.nickName"
                      class="absolute left-12px top-1/2 transform -translate-y-1/2 text-12px color-[--color-primary] pointer-events-none z-10"
                      :class="{ 'top-8px transform-none text-10px': showNamePrefix }">
                      {{ t('auth.register.labels.nickname') }}
                    </div>
                  </div>
                </n-form-item>

                <n-form-item path="password">
                  <div class="relative w-full">
                    <n-input
                      class="w-full"
                      maxlength="16"
                      minlength="6"
                      size="large"
                      spellCheck="false"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      show-password-on="click"
                      v-model:value="info.password"
                      type="password"
                      :allow-input="noSideSpace"
                      :placeholder="t('auth.register.placeholders.password')"
                      @focus="handleInputState($event, 'password')"
                      @blur="handleInputState($event, 'password')"
                      clearable></n-input>
                    <div
                      v-if="showPasswordPrefix || info.password"
                      class="absolute left-12px top-1/2 transform -translate-y-1/2 text-12px color-[--color-primary] pointer-events-none z-10"
                      :class="{ 'top-8px transform-none text-10px': showPasswordPrefix }">
                      {{ t('auth.register.labels.password') }}
                    </div>
                  </div>
                </n-form-item>

                <n-form-item path="confirmPassword">
                  <div class="relative w-full">
                    <n-input
                      class="w-full"
                      maxlength="16"
                      minlength="6"
                      size="large"
                      spellCheck="false"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      show-password-on="click"
                      v-model:value="confirmPassword"
                      type="password"
                      :allow-input="noSideSpace"
                      :placeholder="t('auth.register.placeholders.confirm_placeholder')"
                      @focus="handleInputState($event, 'confirmPassword')"
                      @blur="handleInputState($event, 'confirmPassword')"
                      clearable></n-input>
                    <div
                      v-if="showConfirmPasswordPrefix || confirmPassword"
                      class="absolute left-12px top-1/2 transform -translate-y-1/2 text-12px color-[--color-primary] pointer-events-none z-10"
                      :class="{ 'top-8px transform-none text-10px': showConfirmPasswordPrefix }">
                      {{ t('auth.register.labels.confirm') }}
                    </div>
                  </div>
                </n-form-item>

                <n-form-item path="email">
                  <div class="relative w-full">
                    <n-auto-complete
                      class="w-full"
                      size="large"
                      v-model:value="info.email"
                      :placeholder="t('auth.register.placeholders.email')"
                      :options="commonEmailDomains"
                      :get-show="getShow"
                      :append="true"
                      clearable
                      type="text"
                      spellCheck="false"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      @focus="handleInputState($event, 'email')"
                      @blur="handleInputState($event, 'email')"></n-auto-complete>
                    <div
                      v-if="showemailPrefix || info.email"
                      class="absolute left-12px top-1/2 transform -translate-y-1/2 text-12px color-[--color-primary] pointer-events-none z-10"
                      :class="{ 'top-8px transform-none text-10px': showemailPrefix }">
                      {{ t('auth.register.labels.email') }}
                    </div>
                  </div>
                </n-form-item>

                <!-- 密码提示信息 -->
                <n-flex vertical v-if="info.password">
                  <n-flex vertical :size="4">
                    <Validation
                      :value="info.password"
                      :message="t('auth.register.password_hints.min_length')"
                      :validator="validateMinLength" />
                    <Validation
                      :value="info.password"
                      :message="t('auth.register.password_hints.alpha_numeric')"
                      :validator="validateAlphaNumeric" />
                    <Validation
                      :value="info.password"
                      :message="t('auth.register.password_hints.special_char')"
                      :validator="validateSpecialChar" />
                  </n-flex>
                </n-flex>

                <!-- 协议 -->
                <n-flex align="center" justify="center" :size="6" class="mt-10px">
                  <n-checkbox v-model:checked="protocol" />
                  <div class="text-12px color-[--tjg-text-tertiary] cursor-default lh-14px">
                    <span>{{ t('login.term.checkout.text1') }}</span>
                    <span class="color-[--color-primary] cursor-pointer" @click.stop="openServiceAgreement">
                      {{ t('login.term.checkout.text2') }}
                    </span>
                    <span>{{ t('login.term.checkout.text3') }}</span>
                    <span class="color-[--color-primary] cursor-pointer" @click.stop="openPrivacyAgreement">
                      {{ t('login.term.checkout.text4') }}
                    </span>
                  </div>
                </n-flex>
              </div>
            </n-form>
          </div>

          <n-button
            :loading="loading || registerLoading"
            :disabled="btnDisabled"
            tertiary
            class="w-full mt-20px gradient-button"
            @click="handleStepAction">
            {{ btnText }}
          </n-button>
          <n-button class="w-full mt-10px" @click="router.replace('/login')">
            {{ t('auth.register.actions.back_to_login') }}
          </n-button>
          <p v-if="sendCodeCooldown > 0" class="text-(12px --color-primary) mt-6px whitespace-nowrap">
            {{ t('auth.register.tips.reopen_code') }}
          </p>
        </div>
      </div>
    </div>

    <!-- 底部栏 -->
    <div class="text-(12px --tjg-text-tertiary) w-full absolute bottom-20px left-0 text-center pointer-events-none z-0">
      <span>Copyright {{ currentYear - 1 }}-{{ currentYear }} 龙卷风 All Rights Reserved.</span>
    </div>

    <!-- 邮箱验证码输入弹窗 -->
    <n-modal v-model:show="emailCodeModal" :mask-closable="false" class="rounded-8px" transform-origin="center">
      <div class="bg-[--tjg-surface-elevated] w-380px h-fit box-border flex flex-col">
        <MacCloseButton v-if="isMac()" class="z-999 absolute top-3px left-4px" @click="emailCodeModal = false" />

        <svg
          v-if="isWindows()"
          @click="emailCodeModal = false"
          class="w-12px h-12px ml-a mr-4px mt-4px cursor-pointer select-none">
          <use href="#close"></use>
        </svg>
        <n-flex vertical class="w-full h-fit">
          <n-flex vertical :size="10" class="p-24px">
            <p class="text-(16px [--tjg-text-primary]) mb-10px">{{ t('auth.register.email_modal.title') }}</p>
            <p class="text-(12px [--tjg-text-tertiary]) leading-5 mb-10px">
              {{ t('auth.register.email_modal.desc', { email: info.email }) }}
            </p>

            <!-- PIN 输入框 -->
            <div class="mb-20px">
              <PinInput v-model="emailCode" @complete="register" ref="pinInputRef" />
            </div>

            <n-button
              :loading="registerLoading"
              :disabled="!isEmailCodeComplete"
              tertiary
              style="color: var(--tjg-text-inverse)"
              class="w-full gradient-button"
              @click="register">
              {{ t('auth.register.actions.submit') }}
            </n-button>
          </n-flex>
        </n-flex>
      </div>
    </n-modal>
  </n-config-provider>
</template>

<script setup lang="ts">
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import dayjs from 'dayjs'
import { darkTheme, type FormInst, lightTheme } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSessionActions } from '@/composables/user/useSessionActions'
import { resolveMatrixRuntimeEndpointConfig, saveMatrixSessionEndpointConfig } from '@/services/backend'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('Register')
const {
  register: registerAccount,
  requestEmailToken,
  submitEmailToken,
  restoreWithAccessToken,
  loginWithPassword,
  completeDesktopLoginTransition
} = useSessionActions()

import PinInput from '@/components/atomic/PinInput.vue'
import MacCloseButton from '@/components/common/MacCloseButton.vue'
import Validation from '@/components/common/Validation.vue'
import { useWindow } from '@/composables/common/useWindow'
import router from '@/router'
import type { RegisterUserReq } from '@/services/types.ts'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { isMac, isWindows } from '@/utils/PlatformConstants'
import { validateAlphaNumeric, validateSpecialChar } from '@/utils/Validate'

// 输入框类型定义
type InputType = 'nickName' | 'email' | 'password' | 'confirmPassword'
const GENERAL_USER_SYSTEM_TYPE = 2

const settingStore = useSettingStore()
const naiveTheme = computed(() => (settingStore.themeContent === 'dark' ? darkTheme : lightTheme))
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

/** 注册信息 */
const info = reactive<RegisterUserReq>({
  avatar: '',
  email: '',
  password: '',
  nickName: '',
  code: '',
  uuid: '',
  key: 'REGISTER_EMAIL',
  confirmPassword: '',
  systemType: GENERAL_USER_SYSTEM_TYPE
})

/** 确认密码 */
const confirmPassword = ref('')

/** 协议 */
const protocol = ref(false)
const btnDisabled = ref(false)
const loading = ref(false)
const registerLoading = ref(false)
const matrixEndpointConfig = resolveMatrixRuntimeEndpointConfig()

// 占位符
// 前缀显示状态
const showNamePrefix = ref(false)
const showemailPrefix = ref(false)
const showPasswordPrefix = ref(false)
const showConfirmPasswordPrefix = ref(false)
const { createModalWindow } = useWindow()
// 常用邮箱后缀
const commonEmailDomains = computed(() => {
  return ['gmail.com', '163.com', 'qq.com'].map((suffix) => {
    return {
      label: suffix,
      value: suffix
    }
  })
})

/** 发送验证码冷却时间(秒) */
const sendCodeCooldown = ref(0)
/** 验证码倒计时消息ID */
const EMAIL_TIMER_ID = 'register_window_email_timer'
/** 倒计时定时器 Worker */
const timerWorker = new Worker(new URL('../../workers/timer.worker.ts', import.meta.url), { type: 'module' })
/** 发送验证码按钮文本 */
const btnText = computed(() => {
  if (loading.value) {
    return t('auth.register.actions.sending')
  }
  if (!hasEmail.value) {
    return t('auth.register.actions.submit')
  }
  if (sendCodeCooldown.value > 0) {
    return t('auth.register.actions.retry_in', { seconds: sendCodeCooldown.value })
  }
  return t('auth.register.actions.send_code')
})
// 使用day.js获取当前年份
const currentYear = dayjs().year()
const registerForm = ref<FormInst | null>(null)
const emailCodeModal = ref(false)

// 邮箱验证码PIN输入
const emailCode = ref('')
const pinInputRef = ref()
const isEmailCodeComplete = computed(() => emailCode.value.length === 6)
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const isEmailValid = computed(() => !info.email || emailPattern.test(info.email.trim()))

/** 检查是否填写了邮箱 */
const hasEmail = computed(() => !!info.email.trim())

// 校验规则
const rules = {
  nickName: {
    required: true,
    message: t('auth.register.form.rules.nickname_required'),
    trigger: 'blur'
  },
  email: {
    required: false,
    trigger: ['blur', 'input'],
    validator(_: unknown, value: string) {
      const email = (value || '').trim()
      if (email && !emailPattern.test(email)) {
        return new Error(t('auth.register.form.rules.email_format'))
      }
      return true
    }
  },
  password: {
    required: true,
    message: t('auth.register.form.rules.password_required'),
    trigger: ['blur', 'input']
  },
  confirmPassword: {
    required: true,
    message: t('auth.register.form.rules.confirm_mismatch'),
    trigger: 'blur',
    validator() {
      if (confirmPassword.value !== info.password) {
        return false
      }
      return true
    }
  }
}

const getShow = (value: string) => {
  if (value.endsWith('@')) {
    return true
  }
  return false
}

/** 打开服务协议窗口 */
const openServiceAgreement = async () => {
  await createModalWindow(t('login.term.checkout.text2'), 'modal-serviceAgreement', 600, 600, 'login')
}

/** 打开隐私保护协议窗口 */
const openPrivacyAgreement = async () => {
  await createModalWindow(t('login.term.checkout.text4'), 'modal-privacyAgreement', 600, 600, 'login')
}

/** 不允许输入空格 */
const noSideSpace = (value: string) => !value.startsWith(' ') && !value.endsWith(' ')

/** 密码验证函数 */
const validateMinLength = (value: string) => value.length >= 6

/** 检查密码是否满足所有条件 */
const isPasswordValid = computed(() => {
  const password = info.password
  return validateMinLength(password) && validateAlphaNumeric(password) && validateSpecialChar(password)
})

/** 检查是否可以发送邮箱验证码 */
const canSendCode = computed(() => {
  return (
    !!info.nickName &&
    isPasswordValid.value &&
    confirmPassword.value === info.password &&
    protocol.value &&
    (!hasEmail.value || isEmailValid.value)
  )
})

/** 检查是否可以跳过邮箱直接注册 */
const canSkipEmail = computed(() => {
  return (
    !!info.nickName &&
    isPasswordValid.value &&
    confirmPassword.value === info.password &&
    protocol.value &&
    !hasEmail.value
  )
})

watchEffect(() => {
  const isBusy = loading.value || registerLoading.value
  if (!hasEmail.value) {
    btnDisabled.value = isBusy || !canSkipEmail.value
  } else {
    btnDisabled.value = isBusy || !canSendCode.value
  }
})

/**
 * 处理输入框状态变化
 * @param type 输入框类型：name-昵称 / email-邮箱 / password-密码 / confirmPassword-确认密码
 * @param event 事件对象
 */
const handleInputState = (event: FocusEvent, type: InputType): void => {
  const prefixMap: Record<InputType, Ref<boolean>> = {
    nickName: showNamePrefix,
    email: showemailPrefix,
    password: showPasswordPrefix,
    confirmPassword: showConfirmPasswordPrefix
  }
  prefixMap[type].value = event.type === 'focus'
}

/** 邮箱验证码会话 ID */
const emailSessionId = ref('')
/** 邮箱验证码客户端密钥 */
const emailClientSecret = ref('')

/** 处理步骤操作 */
const handleStepAction = async () => {
  if (btnDisabled.value || loading.value) return

  try {
    await registerForm.value?.validate?.()
  } catch (error) {
    return
  }

  // 如果没有邮箱，直接注册
  if (!hasEmail.value) {
    await handleDirectRegister()
    return
  }

  // 有邮箱，发送验证码
  if (sendCodeCooldown.value > 0) {
    emailCodeModal.value = true
    nextTick(() => {
      pinInputRef.value?.focus()
    })
    return
  }

  loading.value = true
  try {
    const email = info.email.trim()
    info.email = email
    const result = await requestEmailToken(email, 1)
    emailSessionId.value = result.sid
    emailClientSecret.value = result.client_secret
    startSendCodeCountdown()
    showFeedback(t('auth.register.messages.code_sent'), 'success')
    emailCodeModal.value = true
    emailCode.value = ''
    nextTick(() => {
      pinInputRef.value?.focus()
    })
  } catch (error) {
    logger.error('发送验证码失败', error)
    showFeedback(getErrorMessage(error, t('auth.register.messages.register_fail')), 'error')
  } finally {
    loading.value = false
  }
}

const getErrorMessage = (error: unknown, fallback: string) => {
  return error instanceof Error && error.message ? error.message : fallback
}

const finishRegistrationAndEnterHome = async (registerResult: Awaited<ReturnType<typeof registerAccount>>) => {
  const account = info.nickName.trim()
  const displayName = account

  if (registerResult.user_id && registerResult.access_token) {
    saveMatrixSessionEndpointConfig({
      homeserverUrl: matrixEndpointConfig.homeserverUrl,
      identityServerUrl: matrixEndpointConfig.identityServerUrl
    })
    await restoreWithAccessToken({
      uid: registerResult.user_id,
      accessToken: registerResult.access_token,
      refreshToken: registerResult.refresh_token,
      account,
      displayName,
      avatar: info.avatar,
      client: 'PC',
      persistTokens: true,
      bootstrapAfterRestore: true
    })
  } else {
    await loginWithPassword({
      username: account,
      password: info.password,
      homeserverUrl: matrixEndpointConfig.homeserverUrl,
      identityServerUrl: matrixEndpointConfig.identityServerUrl,
      deviceName: 'Tjg Client',
      account,
      displayName,
      avatar: info.avatar,
      client: 'PC'
    })
  }

  await completeDesktopLoginTransition()
}

const startSendCodeCountdown = () => {
  sendCodeCooldown.value = 60
  timerWorker.postMessage({
    type: 'startTimer',
    msgId: EMAIL_TIMER_ID,
    duration: 60 * 1000
  })
}

timerWorker.onmessage = (e) => {
  const { type, msgId, remainingTime } = e.data
  if (msgId !== EMAIL_TIMER_ID) return

  if (type === 'debug') {
    sendCodeCooldown.value = Math.max(0, Math.ceil(remainingTime / 1000))
  } else if (type === 'timeout') {
    sendCodeCooldown.value = 0
  }
}

timerWorker.onerror = () => {
  sendCodeCooldown.value = 0
}

/** 生成随机头像 */
const generateRandomAvatar = () => {
  const avatarNum = Math.floor(Math.random() * 21) + 1
  return avatarNum.toString().padStart(3, '0')
}

/** 无邮箱直接注册 */
const handleDirectRegister = async () => {
  registerLoading.value = true
  try {
    info.systemType = GENERAL_USER_SYSTEM_TYPE
    info.avatar = generateRandomAvatar()

    const registerResult = await registerAccount(info.nickName.trim(), info.password)
    await finishRegistrationAndEnterHome(registerResult)
    showFeedback(t('auth.register.messages.register_success'), 'success')
  } catch (error) {
    showFeedback(getErrorMessage(error, t('auth.register.messages.register_fail')), 'error')
  } finally {
    registerLoading.value = false
  }
}

/** 邮箱注册 */
const register = async () => {
  registerLoading.value = true

  info.email = info.email.trim()
  info.code = emailCode.value.trim()
  info.confirmPassword = confirmPassword.value

  try {
    info.systemType = GENERAL_USER_SYSTEM_TYPE
    info.avatar = generateRandomAvatar()

    if (emailSessionId.value && emailClientSecret.value && info.code) {
      await submitEmailToken(info.code, emailClientSecret.value, emailSessionId.value)
    }

    const registerResult = await registerAccount(
      info.nickName.trim(),
      info.password,
      emailSessionId.value || undefined,
      emailSessionId.value ? 'm.login.email.identity' : undefined,
      undefined,
      emailClientSecret.value || undefined
    )
    await finishRegistrationAndEnterHome(registerResult)
    showFeedback(t('auth.register.messages.register_success'), 'success')

    emailCodeModal.value = false
  } catch (error) {
    showFeedback(getErrorMessage(error, t('auth.register.messages.register_fail')), 'error')
  } finally {
    registerLoading.value = false
  }
}

onMounted(async () => {
  if (hasTauriRuntime()) {
    await getCurrentWebviewWindow().show()
  }
})

// 组件卸载时清理计时器
onUnmounted(() => {
  timerWorker.postMessage({
    type: 'clearTimer',
    msgId: EMAIL_TIMER_ID
  })
  timerWorker.terminate()
  sendCodeCooldown.value = 0
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/login-bg';
@use '@/styles/scss/login';

.textFont {
  font-family: AliFangYuan, sans-serif !important;
}

:deep(.n-form-item.n-form-item--top-labelled) {
  grid-template-rows: none;
}
</style>
