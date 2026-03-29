<template>
  <!-- 单独使用n-config-provider来包裹不需要主题切换的界面 -->
  <n-config-provider
    :theme="naiveTheme"
    data-tauri-drag-region
    class="login-box size-full rounded-8px select-none flex flex-col">
    <!--顶部操作栏-->
    <ActionBar :max-w="false" :shrink="false" />

    <n-flex vertical justify="center" :size="24" class="w-full px-20px flex-1 overflow-y-auto pb-80px">
      <!-- 注册菜单 -->
      <n-flex class="ma text-center w-full max-w-320px pointer-events-auto" vertical :size="16">
        <n-flex justify="center" align="center" :size="12">
          <span class="text-(24px #70938c) textFont">{{ t('auth.register.title') }}</span>
          <img class="w-100px h-40px" src="/hula.png" alt="" />
        </n-flex>
        
        <div class="overflow-y-auto max-h-380px px-10px">
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
                  clearable>
                </n-input>
                <div 
                  v-if="showNamePrefix || info.nickName"
                  class="absolute left-12px top-1/2 transform -translate-y-1/2 text-12px color-#70938c pointer-events-none z-10"
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
                  clearable>
                </n-input>
                <div 
                  v-if="showPasswordPrefix || info.password"
                  class="absolute left-12px top-1/2 transform -translate-y-1/2 text-12px color-#70938c pointer-events-none z-10"
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
                  clearable>
                </n-input>
                <div 
                  v-if="showConfirmPasswordPrefix || confirmPassword"
                  class="absolute left-12px top-1/2 transform -translate-y-1/2 text-12px color-#70938c pointer-events-none z-10"
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
                  autoCapitalize="off">
                </n-auto-complete>
                <div 
                  v-if="showemailPrefix || info.email"
                  class="absolute left-12px top-1/2 transform -translate-y-1/2 text-12px color-#70938c pointer-events-none z-10"
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
              <div class="text-12px color-#909090 cursor-default lh-14px">
                <span>{{ t('login.term.checkout.text1') }}</span>
                <span class="color-#13987f cursor-pointer" @click.stop="openServiceAgreement">
                  {{ t('login.term.checkout.text2') }}
                </span>
                <span>{{ t('login.term.checkout.text3') }}</span>
                <span class="color-#13987f cursor-pointer" @click.stop="openPrivacyAgreement">
                  {{ t('login.term.checkout.text4') }}
                </span>
              </div>
            </n-flex>
          </div>
        </n-form>
        </div>

        <n-button
          :loading="loading"
          :disabled="btnEnable"
          tertiary
          class="w-full mt-20px gradient-button"
          @click="handleStepAction">
          {{ btnText }}
        </n-button>
        <p v-if="sendCodeCooldown > 0" class="text-(12px #13987f) mt-6px whitespace-nowrap">
          {{ t('auth.register.tips.reopen_code') }}
        </p>
      </n-flex>
    </n-flex>

    <!-- 底部栏 -->
    <n-flex
      class="text-(12px #909090) w-full absolute bottom-20px left-1/2 transform -translate-x-1/2"
      :size="8"
      justify="center">
      <span>Copyright {{ currentYear - 1 }}-{{ currentYear }} HuLaSpark All Rights Reserved.</span>
    </n-flex>

    <!-- 星标提示框 -->
    <n-modal v-model:show="starTipsModal" :mask-closable="false" class="rounded-8px" transform-origin="center">
      <div class="bg-[--bg-edit] w-380px h-fit box-border flex flex-col">
        <n-flex vertical class="w-full h-fit">
          <video class="w-full h-240px rounded-t-8px object-cover" src="@/assets/video/star.mp4" autoplay loop />
          <n-flex vertical :size="10" class="p-14px">
            <p class="text-(16px #303030)">{{ t('auth.register.modal.title') }}</p>
            <p class="text-(12px #808080) leading-5">{{ t('auth.register.modal.desc') }}</p>

            <n-flex :size="10" class="ml-auto">
              <a
                target="_blank"
                rel="noopener noreferrer"
                @click="handleStar"
                href="https://gitee.com/llangkebo/hula/"
                class="bg-#363636 cursor-pointer w-70px h-30px rounded-8px flex-center text-(12px #f1f1f1) outline-none no-underline">
                {{ t('auth.register.modal.cta') }}
              </a>
            </n-flex>
          </n-flex>
        </n-flex>
      </div>
    </n-modal>

    <!-- 邮箱验证码输入弹窗 -->
    <n-modal v-model:show="emailCodeModal" :mask-closable="false" class="rounded-8px" transform-origin="center">
      <div class="bg-#f0f0f0 dark:bg-#303030 w-380px h-fit box-border flex flex-col">
        <div
          v-if="isMac()"
          @click="emailCodeModal = false"
          class="mac-close z-999 size-13px shadow-inner bg-#ed6a5eff rounded-50% select-none absolute top-3px left-4px">
          <svg class="hidden size-7px color-#000 select-none absolute top-3px left-3px">
            <use href="#close"></use>
          </svg>
        </div>

        <svg
          v-if="isWindows()"
          @click="emailCodeModal = false"
          class="w-12px h-12px ml-a mr-4px mt-4px cursor-pointer select-none">
          <use href="#close"></use>
        </svg>
        <n-flex vertical class="w-full h-fit">
          <n-flex vertical :size="10" class="p-24px">
            <p class="text-(16px [--text-color]) mb-10px">{{ t('auth.register.email_modal.title') }}</p>
            <p class="text-(12px #808080) leading-5 mb-10px">
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
              style="color: #fff"
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
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import dayjs from 'dayjs'
import { darkTheme, lightTheme, type FormInst } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import PinInput from '@/components/atomic/PinInput.vue'
import Validation from '@/components/common/Validation.vue'
import { useWindow } from '@/hooks/useWindow'
import type { RegisterUserReq } from '@/services/types.ts'
import { useSettingStore } from '@/stores/setting'
import { MatrixAuthService } from '@/services/matrix/MatrixAuthService'
import { isMac, isWindows } from '@/utils/PlatformConstants'
import { validateAlphaNumeric, validateSpecialChar } from '@/utils/Validate'

// 输入框类型定义
type InputType = 'nickName' | 'email' | 'password' | 'confirmPassword'

const settingStore = useSettingStore()
const { themes } = storeToRefs(settingStore)
const naiveTheme = computed(() => (themes.value.content === 'dark' ? darkTheme : lightTheme))
const { t } = useI18n()

/** 注册信息 */
const info = unref(
  ref<RegisterUserReq>({
    avatar: '',
    email: '',
    password: '',
    nickName: '',
    code: '',
    uuid: '',
    key: 'REGISTER_EMAIL',
    confirmPassword: '',
    systemType: 2
  })
)

/** 确认密码 */
const confirmPassword = ref('')

/** 协议 */
const protocol = ref(true)
const btnEnable = ref(false)
const loading = ref(false)
const registerLoading = ref(false)

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
const timerWorker = new Worker(new URL('@/workers/timer.worker.ts', import.meta.url))
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
const starTipsModal = ref(false)
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
  if (!hasEmail.value) {
    btnEnable.value = loading.value || !canSkipEmail.value
  } else {
    btnEnable.value = loading.value || !canSendCode.value
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
  if (btnEnable.value || loading.value) return

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
    emailClientSecret.value = generateClientSecret()
    const result = await MatrixAuthService.requestEmailToken(email, 1)
    emailSessionId.value = result.sid
    startSendCodeCountdown()
    window.$message.success(t('auth.register.messages.code_sent'))
    emailCodeModal.value = true
    emailCode.value = ''
    nextTick(() => {
      pinInputRef.value?.focus()
    })
  } catch (error) {
    console.error('发送验证码失败', error)
  } finally {
    loading.value = false
  }
}

const generateClientSecret = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 43; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
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

/** 无邮箱直接注册 */
const handleDirectRegister = async () => {
  registerLoading.value = true
  try {
    const avatarNum = Math.floor(Math.random() * 21) + 1
    const avatarId = avatarNum.toString().padStart(3, '0')
    info.avatar = avatarId

    await MatrixAuthService.register(info.nickName, info.password)
    window.$message.success(t('auth.register.messages.register_success'))

    starTipsModal.value = localStorage.getItem('star') !== '1'
  } catch (error) {
    window.$message.error(t('auth.register.messages.register_fail'))
  } finally {
    registerLoading.value = false
  }
}

/** 邮箱注册 */
const register = async () => {
  registerLoading.value = true

  info.code = emailCode.value
  info.email = info.email.trim()

  try {
    const avatarNum = Math.floor(Math.random() * 21) + 1
    const avatarId = avatarNum.toString().padStart(3, '0')
    info.avatar = avatarId

    info.confirmPassword = confirmPassword.value

    await MatrixAuthService.register(
      info.nickName,
      info.password,
      emailSessionId.value || undefined,
      emailSessionId.value ? 'm.login.email.identity' : undefined,
      emailCode.value || undefined
    )
    window.$message.success(t('auth.register.messages.register_success'))

    emailCodeModal.value = false
    starTipsModal.value = localStorage.getItem('star') !== '1'
  } catch (error) {
    window.$message.error(t('auth.register.messages.register_fail'))
  } finally {
    registerLoading.value = false
  }
}

const handleStar = () => {
  starTipsModal.value = false
  localStorage.setItem('star', '1')
}

onMounted(async () => {
  await getCurrentWebviewWindow().show()
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
