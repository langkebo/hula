<template>
  <div class="captcha-verify-mobile w-full">
    <!-- 已通过状态 -->
    <div v-if="internalVerified" class="flex items-center gap-8px py-6px">
      <svg class="size-16px color-[--tjg-color-success-500]"><use href="#success"></use></svg>
      <span class="text-13px color-[--tjg-color-success-500]">{{ t('captcha.verify_success') }}</span>
    </div>

    <!-- 验证输入区 -->
    <div v-else class="flex flex-col gap-10px">
      <div class="flex items-center gap-10px">
        <!-- 验证码输入 -->
        <van-field
          v-model="captchaInput"
          class="flex-1 captcha-input"
          :placeholder="t('captcha.input_placeholder')"
          :disabled="loading || verifying"
          maxlength="8"
          clearable
          autocomplete="off"
          :spellcheck="false"
          autocorrect="off"
          autocapitalize="off" />

        <!-- 验证码图片(点击刷新) -->
        <div
          class="captcha-img-wrap h-36px w-100px flex-shrink-0 cursor-pointer rounded-6px overflow-hidden"
          :title="t('captcha.click_image_to_refresh')"
          @click="refresh">
          <van-image
            v-if="captchaImage"
            :src="captchaImage"
            :alt="t('captcha.image_alt')"
            fit="cover"
            width="100"
            height="36" />
          <div
            v-else-if="loading"
            class="size-full flex items-center justify-center bg-[--tjg-overlay-mobile-sheet] text-12px color-[--tjg-text-tertiary]">
            ...
          </div>
          <div
            v-else
            class="size-full flex items-center justify-center bg-[--tjg-overlay-mobile-sheet] text-12px color-[--tjg-text-tertiary]">
            {{ t('captcha.not_verified') }}
          </div>
        </div>
      </div>

      <div class="flex items-center gap-10px">
        <van-button
          class="flex-1 captcha-btn"
          size="small"
          plain
          :loading="loading"
          :disabled="verifying"
          @click="refresh">
          {{ t('captcha.refresh') }}
        </van-button>
        <van-button
          class="flex-1 captcha-btn gradient-button"
          size="small"
          type="primary"
          :loading="verifying"
          :disabled="loading || !captchaInput"
          @click="handleVerify">
          {{ t('captcha.verify') }}
        </van-button>
      </div>

      <p v-if="errorMessage" class="text-12px color-[--tjg-color-danger-500] m-0">{{ errorMessage }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRegisterCaptcha } from '@/composables/auth/useRegisterCaptcha'

const props = defineProps<{
  /** 是否已通过验证(v-model) */
  verified?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:verified', value: boolean): void
  (e: 'verified-change', value: boolean): void
  (e: 'session-ready', session: string): void
}>()

const { t } = useI18n()
const captcha = useRegisterCaptcha()

const {
  captchaImage,
  captchaInput,
  loading,
  verifying,
  errorMessage,
  session,
  verified: internalVerified,
  load,
  refresh,
  verify
} = captcha

// 同步内部 verified 到 v-model
watch(internalVerified, (val) => {
  if (val !== props.verified) {
    emit('update:verified', val)
    emit('verified-change', val)
  }
})

// session 就绪后通知父组件
watch(session, (val) => {
  if (val) {
    emit('session-ready', val)
  }
})

const handleVerify = async () => {
  await verify()
}

onMounted(() => {
  void load()
})
</script>

<style scoped lang="scss">
:deep(.captcha-input.van-cell.van-field) {
  padding: 8px 12px;
  background: var(--tjg-overlay-mobile-sheet);
  border-radius: 8px;
}

:deep(.captcha-input.van-cell.van-field::after) {
  display: none;
}

:deep(.captcha-btn.van-button) {
  height: 32px;
  border-radius: 8px;
}
</style>
