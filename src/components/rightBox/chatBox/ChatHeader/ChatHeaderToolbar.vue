<template>
  <div class="chat-header-toolbar">
    <n-tooltip trigger="hover" :delay="500">
      <template #trigger>
        <n-button quaternary circle size="small" :aria-label="t('chat.header.video_call')" @click="handleVideoCall">
          <template #icon>
            <n-icon size="20">
              <svg><use href="#video"></use></svg>
            </n-icon>
          </template>
        </n-button>
      </template>
      {{ t('home.chat_header.video_call') }}
    </n-tooltip>

    <n-tooltip trigger="hover" :delay="500">
      <template #trigger>
        <n-button quaternary circle size="small" :aria-label="t('chat.header.voice_call')" @click="handleVoiceCall">
          <template #icon>
            <n-icon size="20">
              <svg><use href="#phone"></use></svg>
            </n-icon>
          </template>
        </n-button>
      </template>
      {{ t('home.chat_header.voice_call') }}
    </n-tooltip>

    <n-tooltip trigger="hover" :delay="500">
      <template #trigger>
        <n-button
          quaternary
          circle
          size="small"
          :aria-label="t('chat.header.start_meeting')"
          :loading="meetingLoading"
          @click="handleStartMeeting">
          <template #icon>
            <n-icon size="20">
              <Icon icon="mdi:video-plus" />
            </n-icon>
          </template>
        </n-button>
      </template>
      {{ t('home.chat_header.start_meeting') }}
    </n-tooltip>

    <n-tooltip v-if="!isMobile" trigger="hover" :delay="500">
      <template #trigger>
        <n-button quaternary circle size="small" :aria-label="t('chat.header.screen_share')" @click="handleScreenShare">
          <template #icon>
            <n-icon size="20">
              <svg><use href="#screen-share"></use></svg>
            </n-icon>
          </template>
        </n-button>
      </template>
      {{ t('home.chat_header.screen_share') }}
    </n-tooltip>

    <!-- 附录 C.6：在新窗口打开（仅桌面端显示） -->
    <n-tooltip v-if="!isMobile" trigger="hover" :delay="500">
      <template #trigger>
        <n-button
          quaternary
          circle
          size="small"
          :aria-label="t('chat.header.open_in_new_window')"
          @click="handleOpenInNewWindow">
          <template #icon>
            <n-icon size="20">
              <svg><use href="#expand"></use></svg>
            </n-icon>
          </template>
        </n-button>
      </template>
      {{ t('chat.header.open_in_new_window') }}
    </n-tooltip>

    <n-tooltip v-if="isGroup" trigger="hover" :delay="500">
      <template #trigger>
        <n-button quaternary circle size="small" :aria-label="t('chat.header.group_qr_code')" @click="handleShowQRCode">
          <template #icon>
            <n-icon size="20">
              <svg><use href="#qr-code"></use></svg>
            </n-icon>
          </template>
        </n-button>
      </template>
      {{ t('home.chat_header.qr_code') }}
    </n-tooltip>

    <n-tooltip trigger="hover" :delay="500">
      <template #trigger>
        <n-button
          quaternary
          circle
          size="small"
          :aria-label="t('chat.header.more_options')"
          @click="handleToggleSidebar">
          <template #icon>
            <n-icon size="20">
              <svg><use href="#menu"></use></svg>
            </n-icon>
          </template>
        </n-button>
      </template>
      {{ t('home.chat_header.more') }}
    </n-tooltip>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RoomTypeEnum } from '@/enums'
import { isMobile } from '@/utils/PlatformConstants'

const props = defineProps<{
  roomType: RoomTypeEnum | undefined
  meetingLoading?: boolean
}>()

const emit = defineEmits<{
  (e: 'video-call'): void
  (e: 'voice-call'): void
  (e: 'start-meeting'): void
  (e: 'screen-share'): void
  (e: 'show-qr-code'): void
  (e: 'toggle-sidebar'): void
  (e: 'open-in-new-window'): void
}>()

const { t } = useI18n()

const isGroup = computed(() => props.roomType === RoomTypeEnum.GROUP)

const handleVideoCall = () => emit('video-call')
const handleVoiceCall = () => emit('voice-call')
const handleStartMeeting = () => emit('start-meeting')
const handleScreenShare = () => emit('screen-share')
const handleShowQRCode = () => emit('show-qr-code')
const handleToggleSidebar = () => emit('toggle-sidebar')
const handleOpenInNewWindow = () => emit('open-in-new-window')
</script>

<style scoped lang="scss">
.chat-header-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
