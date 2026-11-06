<template>
  <Transition name="panel-slide">
    <div v-show="isPanelVisible" class="panel-container panel-container--fixed">
      <Transition name="panel-content" mode="out-in">
        <div v-if="mobilePanelState === MobilePanelStateEnum.EMOJI" key="emoji" class="panel-content">
          <Emoticon @emojiHandle="onEmojiHandle" :all="false" />
        </div>
        <div v-else-if="mobilePanelState === MobilePanelStateEnum.VOICE" key="voice" class="panel-content">
          <VoicePanel @cancel="emit('mobileVoiceCancel')" @send="emit('mobileVoiceSend', $event)" />
        </div>
        <div v-else-if="mobilePanelState === MobilePanelStateEnum.MORE" key="more" class="panel-content">
          <More
            @sendFiles="emit('moreSendFiles', $event)"
            @location="emit('moreLocation')"
            @linkPreview="emit('moreLinkPreview')" />
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { VoiceRecordPayload } from '@/components/rightBox/VoiceRecorder.vue'
import type { EmojiUrlPayload } from '@/composables/chat/useFooterEmoji'
// biome-ignore lint/style/useImportType: MobilePanelStateEnum 是 enum，在模板中作为值使用
import { MobilePanelStateEnum } from '@/enums'

const Emoticon = defineAsyncComponent(() => import('@/components/rightBox/emoticon/index.vue'))
const More = defineAsyncComponent(() => import('@/mobile/components/chat-room/panel/More.vue'))
const VoicePanel = defineAsyncComponent(() => import('@/mobile/components/chat-room/panel/VoicePanel.vue'))

defineProps<{
  isPanelVisible: boolean
  mobilePanelState: MobilePanelStateEnum
}>()

const emit = defineEmits<{
  (event: 'emojiHandle', item: string | EmojiUrlPayload, type: 'emoji' | 'emoji-url'): void
  (event: 'mobileVoiceCancel'): void
  (event: 'mobileVoiceSend', voiceData: VoiceRecordPayload): void
  (event: 'moreSendFiles', files: File[]): void
  (event: 'moreLocation'): void
  (event: 'moreLinkPreview'): void
}>()

const onEmojiHandle = (item: unknown, type?: unknown) => {
  emit('emojiHandle', item as string | EmojiUrlPayload, (type ?? 'emoji') as 'emoji' | 'emoji-url')
}
</script>

<style scoped lang="scss">
.panel-container {
  width: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  /* 功能面板：一块从输入坞下方升起的玻璃抽屉 */
  background: var(--tjg-glass-sheet-bg);
  -webkit-backdrop-filter: blur(var(--tjg-glass-blur-strong)) saturate(var(--tjg-glass-saturate-soft));
  backdrop-filter: blur(var(--tjg-glass-blur-strong)) saturate(var(--tjg-glass-saturate-soft));
  border-top: var(--tjg-glass-border-soft);
  border-radius: var(--tjg-radius-2xl) var(--tjg-radius-2xl) 0 0;
  box-shadow: var(--tjg-glass-inner-highlight);
  transition: height var(--tjg-motion-duration-overlay) var(--tjg-motion-ease-standard);
}

/* 不支持模糊时退回实色抽屉 */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .panel-container {
    background: var(--tjg-surface-panel);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}

.panel-container--fixed {
  height: 18rem;
}

.panel-slide-enter-active,
.panel-slide-leave-active {
  transition:
    color var(--tjg-motion-duration-normal) var(--tjg-motion-ease-standard),
    background-color var(--tjg-motion-duration-normal) var(--tjg-motion-ease-standard),
    border-color var(--tjg-motion-duration-normal) var(--tjg-motion-ease-standard),
    box-shadow var(--tjg-motion-duration-normal) var(--tjg-motion-ease-standard),
    opacity var(--tjg-motion-duration-normal) var(--tjg-motion-ease-standard),
    transform var(--tjg-motion-duration-normal) var(--tjg-motion-ease-standard);
  transform-origin: bottom;
}

.panel-slide-enter-from {
  opacity: 0;
  transform: translateY(100%);
}

.panel-slide-enter-to {
  opacity: 1;
  transform: translateY(0);
}

.panel-slide-leave-from {
  opacity: 1;
  transform: translateY(0);
}

.panel-slide-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

.panel-content-enter-active,
.panel-content-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.panel-content-enter-from,
.panel-content-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

.panel-content-enter-to,
.panel-content-leave-from {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .panel-container,
  .panel-slide-enter-active,
  .panel-slide-leave-active,
  .panel-content-enter-active,
  .panel-content-leave-active {
    transition: none;
  }
}
</style>
