<template>
  <!-- 单独使用n-config-provider来包裹不需要主题切换的界面 -->
  <n-config-provider
    :theme="naiveTheme"
    data-tauri-drag-region
    class="login-box size-full rounded-8px select-none flex flex-col">
    <!--顶部操作栏-->
    <ActionBar :max-w="false" :shrink="false" />

    <div class="flex-1 min-h-0 w-full overflow-hidden relative z-10">
      <!-- 返回登录链接（对齐原型 auth-back-link） -->
      <RegisterBackLink @back="router.replace('/login')" />
      <div class="min-h-full w-full box-border flex flex-col items-center justify-center py-12px px-20px pb-40px">
        <!-- 注册菜单 -->
        <div class="w-full w-340px pointer-events-auto flex flex-col gap-12px text-center">
          <!-- Logo + 标题（对齐原型 auth-logo 结构） -->
          <RegisterBrandLogo />

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
                      class="absolute left-12px top-1/2 transform -translate-y-1/2 text-12px color-[--tjg-color-primary-500] pointer-events-none z-10"
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
                      minlength="8"
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
                      class="absolute left-12px top-1/2 transform -translate-y-1/2 text-12px color-[--tjg-color-primary-500] pointer-events-none z-10"
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
                      minlength="8"
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
                      class="absolute left-12px top-1/2 transform -translate-y-1/2 text-12px color-[--tjg-color-primary-500] pointer-events-none z-10"
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
                      class="absolute left-12px top-1/2 transform -translate-y-1/2 text-12px color-[--tjg-color-primary-500] pointer-events-none z-10"
                      :class="{ 'top-8px transform-none text-10px': showemailPrefix }">
                      {{ t('auth.register.labels.email') }}
                    </div>
                  </div>
                </n-form-item>

                <!-- 密码强度提示（对齐原型 pwd-hints 结构） -->
                <RegisterPasswordHints :password="info.password" />

                <!-- 协议 -->
                <n-flex align="center" justify="center" :size="6" class="mt-10px">
                  <n-checkbox v-model:checked="protocol" />
                  <div class="text-12px color-[--tjg-text-tertiary] cursor-default lh-14px">
                    <span>{{ t('login.term.checkout.text1') }}</span>
                    <span class="color-[--tjg-color-primary-500] cursor-pointer" @click.stop="openServiceAgreement">
                      {{ t('login.term.checkout.text2') }}
                    </span>
                    <span>{{ t('login.term.checkout.text3') }}</span>
                    <span class="color-[--tjg-color-primary-500] cursor-pointer" @click.stop="openPrivacyAgreement">
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
          <p v-if="sendCodeCooldown > 0" class="text-(12px var(--tjg-color-primary-500)) mt-6px whitespace-nowrap">
            {{ t('auth.register.tips.reopen_code') }}
          </p>
        </div>
      </div>
    </div>

    <!-- 邮箱验证码输入弹窗 -->
    <RegisterEmailCodeModal
      ref="emailCodeModalRef"
      v-model:show="emailCodeModal"
      v-model:code="emailCode"
      :email="info.email"
      :loading="registerLoading"
      @submit="register" />
  </n-config-provider>
</template>

<script setup lang="ts">
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { darkTheme, type FormInst, lightTheme } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSessionActions } from '@/composables/user/useSessionActions'
import { resolveMatrixRuntimeEndpointConfig, saveMatrixSessionEndpointConfig } from '@/services/backend'
import { useCountdown } from '@/shared/composables/useCountdown'
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

import { useWindow } from '@/composables/common/useWindow'
import router from '@/router'
import type { RegisterUserReq } from '@/services/types.ts'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { padZero } from '@/utils/StringUtils'
import {
  validateAlphaNumeric,
  validatePasswordMinLength,
  validateSpecialChar,
  validateUsername
} from '@/utils/Validate'
import RegisterBackLink from './RegisterBackLink.vue'
import RegisterBrandLogo from './RegisterBrandLogo.vue'
import RegisterEmailCodeModal from './RegisterEmailCodeModal.vue'
import RegisterPasswordHints from './RegisterPasswordHints.vue'

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

/** 验证码倒计时消息ID */
const EMAIL_TIMER_ID = 'register_window_email_timer'
/** 发送验证码冷却时间(秒) — 委托给共享 useCountdown */
const { countdown: sendCodeCooldown, start: startCountdown } = useCountdown(EMAIL_TIMER_ID)
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
const registerForm = ref<FormInst | null>(null)
const emailCodeModal = ref(false)

// 邮箱验证码PIN输入
const emailCode = ref('')
const emailCodeModalRef = ref<{ focus: () => void } | null>(null)
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** 服务端用户名规则（synapse-rust）：仅小写字母、数字和 . _ = - 符号 */
const isEmailValid = computed(() => !info.email || emailPattern.test(info.email.trim()))

/** 检查是否填写了邮箱 */
const hasEmail = computed(() => !!info.email.trim())

// 校验规则
const rules = {
  nickName: {
    required: true,
    trigger: ['blur', 'input'],
    validator(_: unknown, value: string) {
      const nickname = (value || '').trim()
      if (!nickname) {
        return new Error(t('auth.register.form.rules.nickname_required'))
      }
      if (!validateUsername(nickname)) {
        return new Error(t('auth.register.form.rules.nickname_invalid_chars'))
      }
      return true
    }
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

/** 密码验证函数（对齐服务端：最少 8 位） */
const validateMinLength = validatePasswordMinLength

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
      emailCodeModalRef.value?.focus()
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
      emailCodeModalRef.value?.focus()
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
  startCountdown(60)
}

/** 生成随机头像 */
const generateRandomAvatar = () => {
  const avatarNum = Math.floor(Math.random() * 21) + 1
  return padZero(avatarNum, 3)
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
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/login-bg';
@use '@/styles/scss/login';

:deep(.n-form-item.n-form-item--top-labelled) {
  grid-template-rows: none;
}
</style>
