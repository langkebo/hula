<template>
  <div class="chat-header-toolbar">
    <n-tooltip trigger="hover" :delay="500">
      <template #trigger>
        <n-button quaternary circle size="small" @click="handleVideoCall">
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
        <n-button quaternary circle size="small" @click="handleVoiceCall">
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
        <n-button quaternary circle size="small" :loading="meetingLoading" @click="handleStartMeeting">
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
        <n-button quaternary circle size="small" @click="handleScreenShare">
          <template #icon>
            <n-icon size="20">
              <svg><use href="#screen-share"></use></svg>
            </n-icon>
          </template>
        </n-button>
      </template>
      {{ t('home.chat_header.screen_share') }}
    </n-tooltip>

    <n-tooltip v-if="isGroup" trigger="hover" :delay="500">
      <template #trigger>
        <n-button quaternary circle size="small" @click="handleShowQRCode">
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
        <n-button quaternary circle size="small" @click="handleToggleSidebar">
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { isMobile } from '@/utils/PlatformConstants'
import { RoomTypeEnum } from '@/enums'

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
}>()

const { t } = useI18n()

const isGroup = computed(() => props.roomType === RoomTypeEnum.GROUP)

const handleVideoCall = () => emit('video-call')
const handleVoiceCall = () => emit('voice-call')
const handleStartMeeting = () => emit('start-meeting')
const handleScreenShare = () => emit('screen-share')
const handleShowQRCode = () => emit('show-qr-code')
const handleToggleSidebar = () => emit('toggle-sidebar')
</script>

<style scoped lang="scss">
.chat-header-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
