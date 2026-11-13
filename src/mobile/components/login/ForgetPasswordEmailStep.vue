<template>
  <!-- 第一步：验证邮箱 -->
  <div class="w-full max-w-300px mx-auto mt-30px">
    <!-- 邮箱输入 -->
    <van-field
      v-model="emailModel"
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
      v-model="codeModel"
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
        <van-button size="small" type="primary" :disabled="sendDisabled" :loading="sending" @click="emit('send-code')">
          {{ codeButtonText }}
        </van-button>
      </template>
    </van-field>

    <van-button
      :loading="loading"
      :disabled="nextDisabled"
      block
      class="mt-10px gradient-button"
      @click="emit('submit')">
      {{ t('mobile_forget_code.button.next') }}
    </van-button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  email: string
  code: string
  loading: boolean
  sending: boolean
  sendDisabled: boolean
  codeButtonText: string
  nextDisabled: boolean
}>()

const emit = defineEmits<{
  (e: 'update:email', value: string): void
  (e: 'update:code', value: string): void
  (e: 'send-code'): void
  (e: 'submit'): void
}>()

const { t } = useI18n()

const filterNoSideSpace = (value: string) => value.replace(/^\s+|\s+$/g, '')

const emailModel = computed({
  get: () => props.email,
  set: (value: string) => emit('update:email', value)
})

const codeModel = computed({
  get: () => props.code,
  set: (value: string) => emit('update:code', value)
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/login';
</style>
