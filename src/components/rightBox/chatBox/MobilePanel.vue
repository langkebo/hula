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
          <More @sendFiles="emit('moreSendFiles', $event)" />
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { VoiceRecordPayload } from '@/components/rightBox/VoiceRecorder.vue'
import { MobilePanelStateEnum } from '@/enums'
import type { EmojiUrlPayload } from '@/composables/chat/useFooterEmoji'

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
}>()

const onEmojiHandle = (item: unknown, type?: unknown) => {
  emit('emojiHandle', item as string | EmojiUrlPayload, (type ?? 'emoji') as 'emoji' | 'emoji-url')
}
</script>

<style scoped lang="scss">
.panel-container {
  width: 100%;
  overflow: hidden;
  background-color: var(--tjg-surface-panel-muted);
  display: flex;
  flex-direction: column;
  transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.panel-container--fixed {
  height: 18rem;
}

.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
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
</style>
