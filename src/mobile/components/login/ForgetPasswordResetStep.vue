<template>
  <!-- 第二步：设置新密码 -->
  <div class="w-full max-w-300px mx-auto mt-30px">
    <!-- 新密码 -->
    <van-field
      v-model="passwordModel"
      :type="showNewPassword ? 'text' : 'password'"
      :placeholder="t('mobile_forget_code.input.new_pass', { len: '8-16' })"
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
        :value="password"
        :message="t('mobile_forget_code.validation.minlength', { len: '8-16' })"
        :validator="validateMinLength" />
      <Validation
        :value="password"
        :message="t('mobile_forget_code.validation.valid_characters')"
        :validator="validateAlphaNumeric" />
      <Validation
        :value="password"
        :message="t('mobile_forget_code.validation.must_special_char')"
        :validator="validateSpecialChar" />
    </div>

    <!-- 确认密码 -->
    <van-field
      v-model="confirmPasswordModel"
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
        :value="confirmPassword"
        :message="t('mobile_forget_code.validation.passwords_match')"
        :validator="validatePasswordMatch" />
    </div>

    <div class="flex gap-16px mt-30px px-16px">
      <van-button block @click="emit('back')">{{ t('mobile_forget_code.button.go_back_setp') }}</van-button>
      <van-button :loading="loading" block class="gradient-button" @click="emit('submit')">
        {{ t('mobile_forget_code.button.submit') }}
      </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Validation from '@/components/common/Validation.vue'
import { validateAlphaNumeric, validateSpecialChar } from '@/utils/Validate'

const props = defineProps<{
  password: string
  confirmPassword: string
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'update:password', value: string): void
  (e: 'update:confirmPassword', value: string): void
  (e: 'back'): void
  (e: 'submit'): void
}>()

const { t } = useI18n()

const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

const filterNoSideSpace = (value: string) => value.replace(/^\s+|\s+$/g, '')

const validateMinLength = (value: string) => value.length >= 8

const validatePasswordMatch = (value: string) => value === props.password && value !== ''

const passwordModel = computed({
  get: () => props.password,
  set: (value: string) => emit('update:password', value)
})

const confirmPasswordModel = computed({
  get: () => props.confirmPassword,
  set: (value: string) => emit('update:confirmPassword', value)
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/login';
</style>
