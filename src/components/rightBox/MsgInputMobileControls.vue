<template>
  <!-- 移动端语音按钮 -->
  <div class="flex items-center justify-center w-6 ms-5px h-2.5rem">
    <svg
      @click="$emit('handleVoiceClick')"
      :class="mobilePanelState === MobilePanelStateEnum.VOICE ? 'text-[--tjg-color-primary-500]' : ''"
      class="w-25px h-25px mt-2px outline-none">
      <use href="#voice"></use>
    </svg>
  </div>

  <!-- 移动端底部操作栏 -->
  <div class="grid gap-2 h-2.5rem items-center" :class="hasInput ? 'grid-cols-[2rem_3rem]' : 'grid-cols-[2rem_2rem]'">
    <div class="w-full flex-center h-full">
      <svg @click="$emit('handleEmojiClick')" class="w-25px h-25px mt-2px outline-none iconpark-icon">
        <use :href="mobilePanelState === MobilePanelStateEnum.EMOJI ? '#face' : '#smiling-face'"></use>
      </svg>
    </div>
    <div
      v-if="hasInput"
      class="flex-shrink-0 max-h-62px h-full border-t border-[--tjg-border-default] flex items-center justify-end">
      <n-button-group size="small" class="h-full">
        <n-button
          type="primary"
          :disabled="isAIMode && isAIStreaming ? false : disabledSend"
          class="w-3rem h-full"
          @click="$emit('handleMobileSend')">
          {{ isAIMode && isAIStreaming ? '停止思考' : t('editor.send') }}
        </n-button>
      </n-button-group>
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
  (event: 'handleVoiceClick'): void
  (event: 'handleEmojiClick'): void
  (event: 'handleMoreClick'): void
  (event: 'handleMobileSend'): void
}>()

const { t } = useI18n()
</script>
