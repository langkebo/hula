<template>
  <!-- 移动端底部操作栏（位于输入框右侧，与微信一致） -->
  <div class="grid gap-2 h-2.5rem items-center" :class="hasInput ? 'grid-cols-[2rem_3.5rem]' : 'grid-cols-[2rem_2rem]'">
    <div class="w-full flex-center h-full">
      <svg @click="$emit('handleEmojiClick')" class="w-25px h-25px mt-2px outline-none iconpark-icon">
        <use :href="mobilePanelState === MobilePanelStateEnum.EMOJI ? '#face' : '#smiling-face'"></use>
      </svg>
    </div>
    <!-- 有输入时“+”让位给发送按钮，与微信一致 -->
    <div v-if="hasInput" class="flex-shrink-0 h-full flex items-center justify-end">
      <n-button
        type="primary"
        size="small"
        :disabled="isAIMode && isAIStreaming ? false : disabledSend"
        class="mobile-send-btn"
        @click="$emit('handleMobileSend')">
        {{ isAIMode && isAIStreaming ? t('ai_assistant.stop_thinking') : t('editor.send') }}
      </n-button>
    </div>
    <div v-if="!hasInput" class="flex items-center justify-start h-full">
      <svg
        @click="$emit('handleMoreClick')"
        :class="mobilePanelState === MobilePanelStateEnum.MORE ? 'rotate-45' : 'rotate-0'"
        class="w-25px h-25px mt-2px outline-none iconpark-icon transition-transform duration-300 ease">
        <use href="#add-one"></use>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
// biome-ignore lint/style/useImportType: MobilePanelStateEnum 是 enum，在模板中作为值使用
import { MobilePanelStateEnum } from '@/enums'

defineProps<{
  mobilePanelState: MobilePanelStateEnum
  hasInput: string
  disabledSend: boolean
  isAIMode: boolean
  isAIStreaming: boolean
}>()

defineEmits<{
  (event: 'handleEmojiClick'): void
  (event: 'handleMoreClick'): void
  (event: 'handleMobileSend'): void
}>()

const { t } = useI18n()
</script>

<style scoped lang="scss">
/* 微信式发送按钮：32px 高、6px 圆角，避免整高胶囊按钮抢占输入栏视觉 */
.mobile-send-btn.n-button {
  height: 32px;
  min-width: 54px;
  padding: 0 12px;
  border-radius: 6px;
  font-size: var(--tjg-font-size-sm);
}
</style>
