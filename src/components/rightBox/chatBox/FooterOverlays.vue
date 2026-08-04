<template>
  <!-- 会话准备中 -->
  <div
    v-if="isSingleChat && isSessionTargetPending"
    :style="{ height: `${footerHeight}px` }"
    class="absolute inset-0 z-997 backdrop-blur-md cursor-default flex-center select-none pointer-events-auto bg-[--tjg-surface-overlay]">
    <n-flex align="center" justify="center" class="pb-60px">
      <span class="text-(14px [--tjg-text-tertiary])">{{ t('editor.preparing_session') }}</span>
    </n-flex>
  </div>
  <!-- 非好友 -->
  <div
    v-else-if="isSingleChat && !isFriend"
    :style="{ height: `${footerHeight}px` }"
    class="absolute inset-0 z-997 backdrop-blur-md cursor-default flex-center select-none pointer-events-auto bg-[--tjg-surface-overlay]">
    <n-flex align="center" justify="center" class="pb-60px">
      <svg class="size-24px">
        <use href="#cloudError"></use>
      </svg>
      <span class="text-(14px [--tjg-text-tertiary])">{{ t('editor.relation.not_friends') }}</span>
    </n-flex>
  </div>
  <!-- 只读房间 -->
  <div
    v-else-if="isRoomReadonly"
    :style="{ height: `${footerHeight}px` }"
    class="absolute inset-0 z-997 backdrop-blur-md cursor-default flex-center select-none pointer-events-auto bg-[--tjg-surface-overlay]">
    <n-flex align="center" justify="center" class="pb-60px">
      <svg class="size-24px">
        <use href="#lock"></use>
      </svg>
      <span class="text-(14px [--tjg-text-tertiary])">{{ t('editor.room_readonly') }}</span>
    </n-flex>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  isSingleChat: boolean
  isSessionTargetPending: boolean
  isFriend: boolean
  isRoomReadonly: boolean
  footerHeight: number
}>()

const { t } = useI18n()
</script>
