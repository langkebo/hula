<template>
  <div :class="['mb-24px flex flex-col items-center', shouldCenter ? 'absolute-center' : 'relative']">
    <n-avatar
      :size="140"
      :src="avatarSrc"
      :color="cssVar('--avatar-fallback-color')"
      :fallback-src="cssVar('--avatar-fallback-src')"
      class="rounded-22px mb-16px" />

    <!-- 用户名 -->
    <div class="text-20px font-medium text-white mb-8px text-center">
      {{ remoteUserName }}
    </div>

    <!-- 状态文本 -->
    <div class="text-14px text-gray-300 text-center">
      {{ callStatusText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { cssVar } from '@/utils/CssUtils'

defineProps<{
  avatarSrc: string
  remoteUserName: string
  callStatusText: string
  shouldCenter: boolean
}>()
</script>
