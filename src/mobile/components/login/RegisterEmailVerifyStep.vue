<template>
  <!-- 第二步：邮箱和验证码 -->
  <div class="text-center w-80% flex flex-col gap-16px">
    <van-field
      v-model="emailModel"
      :placeholder="registerEmailPH"
      @focus="registerEmailPH = ''"
      @blur="handleEmailBlur"
      @update:model-value="handleEmailInput"
      clearable
      autocomplete="off"
      :spellcheck="false"
      autocorrect="off"
      autocapitalize="off" />

    <!-- 邮箱域名建议 -->
    <div
      v-if="showEmailSuggestions"
      class="border-[1px] border-solid border-[--login-dropdown-border] absolute w-80% bg-[--tjg-surface-elevated] z-99 rounded-8px p-4px box-border">
      <div
        v-for="option in commonEmailDomains"
        :key="option.value"
        @click="selectEmailSuggestion(option.value)"
        class="p-8px hover:bg-[--tjg-surface-panel-muted] hover:rounded-[var(--tjg-radius-md)] text-14px color-[--chat-text-color] text-left cursor-pointer">
        {{ option.label }}
      </div>
    </div>

    <!-- 邮箱验证码 -->
    <div class="flex justify-between items-center gap-10px">
      <van-field
        v-model="codeModel"
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
        :loading="sendLoading"
        :disabled="sendCodeDisabled"
        size="small"
        @click="emit('send-code')">
        <span>{{ sendCodeButtonText }}</span>
      </van-button>
    </div>

    <van-button
      :loading="loading"
      :disabled="!submitDisabled"
      block
      class="mt-8px mb-50px gradient-button"
      @click="emit('submit')">
      <span>{{ t('login.mobile.register.btn.register') }}</span>
    </van-button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  email: string
  code: string
  loading: boolean
  sendLoading: boolean
  countdown: number
  submitDisabled: boolean
}>()

const emit = defineEmits<{
  (e: 'update:email', value: string): void
  (e: 'update:code', value: string): void
  (e: 'send-code'): void
  (e: 'submit'): void
}>()

const { t } = useI18n()

const registerEmailPH = ref(t('login.mobile.register.input.email'))
const registerCodePH = ref(t('login.mobile.register.input.email_verification_code'))
const showEmailSuggestions = ref(false)

const filterNoSideSpace = (value: string) => value.replace(/^\s+|\s+$/g, '')

const isEmailValid = computed(() => {
  const email = props.email.trim()
  if (!email) return false
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)
})

const sendCodeButtonText = computed(() => {
  if (props.countdown > 0) {
    return t('login.mobile.register.btn.resend_in', { seconds: props.countdown })
  }
  return t('login.mobile.register.btn.send_email_code')
})

const sendCodeDisabled = computed(() => {
  return props.sendLoading || props.countdown > 0 || !props.email || !isEmailValid.value
})

const commonEmailDomains = computed(() => {
  return ['@gmail.com', '@163.com', '@qq.com'].map((suffix) => {
    const prefix = props.email.split('@')[0]
    return { label: prefix + suffix, value: prefix + suffix }
  })
})

const emailModel = computed({
  get: () => props.email,
  set: (value: string) => emit('update:email', value)
})

const codeModel = computed({
  get: () => props.code,
  set: (value: string) => emit('update:code', value)
})

const handleEmailInput = (value: string) => {
  showEmailSuggestions.value = value.endsWith('@')
}

const handleEmailBlur = () => {
  registerEmailPH.value = t('login.mobile.register.input.email')
  setTimeout(() => {
    showEmailSuggestions.value = false
  }, 150)
}

const selectEmailSuggestion = (value: string) => {
  emit('update:email', value)
  showEmailSuggestions.value = false
}
</script>

<style scoped lang="scss">
@use '@/styles/scss/login';
</style>
