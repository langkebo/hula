<template>
  <div class="captcha-verify w-full">
    <!-- 已通过状态 -->
    <div v-if="internalVerified" class="flex items-center gap-8px py-6px">
      <svg class="size-16px color-[--tjg-color-success-500]"><use href="#success"></use></svg>
      <span class="text-13px color-[--tjg-color-success-500]">{{ t('captcha.verify_success') }}</span>
    </div>

    <!-- 验证输入区 -->
    <div v-else class="flex flex-col gap-8px">
      <div class="flex items-center gap-8px">
        <!-- 验证码图片 -->
        <div
          class="captcha-img-wrap relative h-36px w-100px flex-shrink-0 cursor-pointer rounded-4px overflow-hidden border-(1px solid var(--tjg-text-tertiary)/30)"
          :title="t('captcha.click_image_to_refresh')"
          @click="refresh">
          <n-image
            v-if="captchaImage"
            :src="captchaImage"
            :alt="t('captcha.image_alt')"
            preview-disabled
            object-fit="cover"
            class="size-full"
            :img-props="{ style: 'width:100%;height:100%' }" />
          <div
            v-else-if="loading"
            class="size-full flex items-center justify-center bg-[--tjg-surface-sidebar-selected] text-12px color-[--tjg-text-tertiary]">
            ...
          </div>
          <div
            v-else
            class="size-full flex items-center justify-center bg-[--tjg-surface-sidebar-selected] text-12px color-[--tjg-text-tertiary]">
            {{ t('captcha.not_verified') }}
          </div>
        </div>

        <!-- 验证码输入 -->
        <n-input
          v-model:value="captchaInput"
          class="flex-1"
          :placeholder="t('captcha.input_placeholder')"
          :loading="verifying"
          :disabled="loading || verifying"
          maxlength="8"
          spellcheck="false"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          @keyup.enter="handleVerify" />

        <!-- 刷新按钮 -->
        <n-button quaternary :loading="loading" :disabled="verifying" @click="refresh">
          {{ t('captcha.refresh') }}
        </n-button>

        <!-- 确认按钮 -->
        <n-button type="primary" :loading="verifying" :disabled="loading || !captchaInput" @click="handleVerify">
          {{ t('captcha.verify') }}
        </n-button>
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
.captcha-verify {
  :deep(.n-image) {
    width: 100%;
    height: 100%;
    border-radius: 4px;
    cursor: pointer !important;
  }
}
</style>
