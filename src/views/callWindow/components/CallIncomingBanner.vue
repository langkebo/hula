<template>
  <div class="w-360px h-full bg-[--tjg-surface-panel] dark:bg-[--tjg-surface-panel] flex-y-center px-12px select-none">
    <!-- 用户头像 -->
    <div class="relative mr-12px">
      <n-avatar
        :size="56"
        :src="avatarSrc"
        :color="cssVar('--avatar-fallback-color')"
        :fallback-src="cssVar('--avatar-fallback-src')"
        class="rounded-12px shadow-md" />
      <!-- 通话类型指示器 -->
      <div
        class="absolute -bottom-2px -right-2px w-20px h-20px rounded-full bg-[--tjg-color-primary-500] flex-center shadow-lg">
        <svg class="size-14px text-[--tjg-text-inverse]">
          <use :href="callType === CallTypeEnum.VIDEO ? '#video-one' : '#phone-telephone'"></use>
        </svg>
      </div>
    </div>

    <!-- 用户信息和状态 -->
    <div class="flex-1 min-w-0">
      <div class="text-15px font-semibold text-[--tjg-text-primary] dark:text-white mb-12px truncate">
        {{ remoteUserName || t('message.call_window.unknown_user') }}
      </div>
      <div class="text-12px text-[--tjg-text-tertiary] dark:text-[--tjg-text-tertiary] flex items-center">
        <div class="w-6px h-6px rounded-full bg-[--tjg-color-primary-500] mr-6px animate-pulse"></div>
        {{ t('message.call_window.incoming') }} ·
        {{
          callType === CallTypeEnum.VIDEO ? t('message.call_window.video_call') : t('message.call_window.voice_call')
        }}
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="flex gap-16px mr-8">
      <!-- 拒绝按钮 -->
      <div
        @click="emit('reject')"
        class="size-40px rounded-full bg-[--tjg-color-danger-500] hover:bg-[--tjg-color-danger-500] flex-center cursor-pointer shadow-lg">
        <svg class="text-[--tjg-text-inverse] size-20px">
          <use href="#PhoneHangup"></use>
        </svg>
      </div>
      <!-- 接听按钮 -->
      <div
        @click="emit('accept')"
        class="size-40px rounded-full bg-[--tjg-color-primary-500] hover:bg-[--tjg-color-primary-500] flex-center cursor-pointer shadow-lg">
        <svg class="text-[--tjg-text-inverse] size-20px">
          <use href="#phone-telephone-entity"></use>
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
// biome-ignore lint/style/useImportType: enum used in template
import { CallTypeEnum } from '@/enums'
import { cssVar } from '@/utils/CssUtils'

defineProps<{
  avatarSrc: string
  callType: CallTypeEnum
  remoteUserName: string
}>()

const emit = defineEmits<{
  accept: []
  reject: []
}>()

const { t } = useI18n()
</script>

<style scoped>
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}
</style>
