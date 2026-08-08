<template>
  <div class="chat-header-toolbar">
    <n-tooltip trigger="hover" :delay="500">
      <template #trigger>
        <n-button quaternary circle size="small" :aria-label="t('chat.header.video_call')" @click="handleVideoCall">
          <template #icon>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path
                d="M17 10.5V7a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"
                fill="currentColor"
                stroke="none" />
            </svg>
          </template>
        </n-button>
      </template>
      {{ t('chat.header.video_call') }}
    </n-tooltip>

    <n-tooltip trigger="hover" :delay="500">
      <template #trigger>
        <n-button quaternary circle size="small" :aria-label="t('chat.header.voice_call')" @click="handleVoiceCall">
          <template #icon>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path
                d="M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.28-.28.67-.36 1.02-.25 1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
                fill="currentColor"
                stroke="none" />
            </svg>
          </template>
        </n-button>
      </template>
      {{ t('chat.header.voice_call') }}
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path
                d="M17 10.5V7a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"
                fill="currentColor"
                stroke="none" />
              <path d="M12 9v2h3v2h-3v2h-2v-2H7v-2h3V9h2z" fill="var(--tjg-surface-panel)" stroke="none" />
            </svg>
          </template>
        </n-button>
      </template>
      {{ t('chat.header.start_meeting') }}
    </n-tooltip>

    <n-tooltip v-if="!isMobile" trigger="hover" :delay="500">
      <template #trigger>
        <n-button quaternary circle size="small" :aria-label="t('chat.header.screen_share')" @click="handleScreenShare">
          <template #icon>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path
                d="M21 16V4H3v12h18zm0-14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7v2h3v2H7v-2h3v-2H3a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h18z"
                fill="currentColor"
                stroke="none" />
              <path d="M12 7l4 4h-3v4h-2v-4H8l4-4z" fill="var(--tjg-surface-panel)" stroke="none" />
            </svg>
          </template>
        </n-button>
      </template>
      {{ t('chat.header.screen_share') }}
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path
                d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7zM19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7z"
                fill="currentColor"
                stroke="none" />
            </svg>
          </template>
        </n-button>
      </template>
      {{ t('chat.header.open_in_new_window') }}
    </n-tooltip>

    <n-tooltip v-if="isGroup" trigger="hover" :delay="500">
      <template #trigger>
        <n-button quaternary circle size="small" :aria-label="t('chat.header.group_qr_code')" @click="handleShowQRCode">
          <template #icon>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path
                d="M3 3h7v7H3V3zm2 2v3h3V5H5zm9-2h7v7h-7V3zm2 2v3h3V5h-3zM3 14h7v7H3v-7zm2 2v3h3v-3H5zm9-2h2v2h-2v-2zm3 0h2v2h-2v-2zm-3 3h2v2h-2v-2zm3 0h2v2h-2v-2zm0 3h2v2h-2v-2zm-3 0h2v2h-2v-2z"
                fill="currentColor"
                stroke="none" />
            </svg>
          </template>
        </n-button>
      </template>
      {{ t('chat.header.group_qr_code') }}
    </n-tooltip>

    <n-tooltip trigger="hover" :delay="500">
      <template #trigger>
        <n-button
          quaternary
          circle
          size="small"
          :class="{ 'private-mode-active': privateModeActive }"
          :aria-label="t('chat.header.private_mode_toggle')"
          @click="handleTogglePrivateMode">
          <template #icon>
            <svg width="20" height="20" viewBox="0 0 24 24">
              <text
                x="12"
                y="17"
                text-anchor="middle"
                font-size="16"
                font-weight="700"
                :fill="privateModeActive ? 'var(--tjg-color-danger-500)' : 'currentColor'">
                S
              </text>
            </svg>
          </template>
        </n-button>
      </template>
      {{ privateModeActive ? t('chat.header.private_mode_active') : t('chat.header.private_mode_toggle') }}
    </n-tooltip>

    <n-tooltip v-if="!isMobile" trigger="hover" :delay="500">
      <template #trigger>
        <n-button
          quaternary
          circle
          size="small"
          :aria-label="t('chat.header.search_messages')"
          @click="handleOpenSearch">
          <template #icon>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" stroke-linecap="round" />
            </svg>
          </template>
        </n-button>
      </template>
      {{ t('chat.header.search_messages') }}
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="6" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="18" cy="12" r="2" />
            </svg>
          </template>
        </n-button>
      </template>
      {{ t('chat.header.more_options') }}
    </n-tooltip>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RoomTypeEnum } from '@/enums'
import { isMobile } from '@/utils/PlatformConstants'

const props = defineProps<{
  roomType: RoomTypeEnum | undefined
  meetingLoading?: boolean
  privateModeActive?: boolean
}>()

const emit = defineEmits<{
  (e: 'video-call'): void
  (e: 'voice-call'): void
  (e: 'start-meeting'): void
  (e: 'screen-share'): void
  (e: 'show-qr-code'): void
  (e: 'toggle-sidebar'): void
  (e: 'open-in-new-window'): void
  (e: 'toggle-private-mode'): void
  (e: 'open-search'): void
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
const handleTogglePrivateMode = () => emit('toggle-private-mode')
const handleOpenSearch = () => emit('open-search')
</script>

<style scoped lang="scss">
.chat-header-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
}

.private-mode-active {
  color: var(--tjg-color-danger-500);
  background: color-mix(in srgb, var(--tjg-color-danger-500) 10%, transparent);
  box-shadow: 0 0 8px color-mix(in srgb, var(--tjg-color-danger-500) 30%, transparent);
}
</style>
