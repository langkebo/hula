<template>
  <!-- 视频通话-桌面端 -->
  <div v-if="callType === CallTypeEnum.VIDEO && !isMobileDevice" class="relative z-10">
    <div class="py-14px flex-center gap-32px">
      <!-- 静音按钮 -->
      <div class="flex-col-x-center gap-8px w-80px">
        <div
          @click="emit('toggle-mute')"
          class="size-44px rounded-full flex-center cursor-pointer"
          :class="
            !isMuted
              ? 'bg-[--tjg-surface-subtle] hover:bg-[--tjg-surface-list-hover]'
              : 'bg-[--tjg-color-danger-500]/60 hover:bg-[--tjg-color-danger-500]/80'
          ">
          <svg class="size-16px text-[--tjg-text-inverse]">
            <use :href="!isMuted ? '#voice' : '#voice-off'"></use>
          </svg>
        </div>
        <div class="text-12px text-[--tjg-text-quaternary] text-center">
          {{ !isMuted ? t('message.call_window.mic_on') : t('message.call_window.mic_off') }}
        </div>
      </div>

      <!-- 扬声器按钮 -->
      <div class="flex-col-x-center gap-8px w-80px">
        <div
          @click="emit('toggle-speaker')"
          class="size-44px rounded-full flex-center cursor-pointer"
          :class="
            isSpeakerOn
              ? 'bg-[--tjg-surface-subtle] hover:bg-[--tjg-surface-list-hover]'
              : 'bg-[--tjg-color-danger-500]/60 hover:bg-[--tjg-color-danger-500]/80'
          ">
          <svg class="size-16px text-[--tjg-text-inverse]">
            <use :href="isSpeakerOn ? '#volume-notice' : '#volume-mute'"></use>
          </svg>
        </div>
        <div class="text-12px text-[--tjg-text-quaternary] text-center">
          {{ isSpeakerOn ? t('message.call_window.speaker_on') : t('message.call_window.speaker_off') }}
        </div>
      </div>

      <!-- 摄像头按钮 -->
      <div class="flex-col-x-center gap-8px w-80px">
        <div
          @click="emit('toggle-video')"
          class="size-44px rounded-full flex-center cursor-pointer"
          :class="
            isVideoEnabled
              ? 'bg-[--tjg-surface-subtle] hover:bg-[--tjg-surface-list-hover]'
              : 'bg-[--tjg-color-danger-500]/60 hover:bg-[--tjg-color-danger-500]/80'
          ">
          <svg class="size-16px text-[--tjg-text-inverse]">
            <use :href="isVideoEnabled ? '#video-one' : '#monitor-off'"></use>
          </svg>
        </div>
        <div class="text-12px text-[--tjg-text-quaternary] text-center">
          {{ isVideoEnabled ? t('message.call_window.camera_disable') : t('message.call_window.camera_enable') }}
        </div>
      </div>

      <!-- 挂断按钮 -->
      <div class="flex-col-x-center gap-8px w-80px">
        <div
          @click="emit('hangup')"
          class="size-44px rounded-full bg-[--tjg-color-danger-500]/60 hover:bg-[--tjg-color-danger-500]/80 flex-center cursor-pointer">
          <svg class="size-16px text-[--tjg-text-inverse]">
            <use href="#PhoneHangup"></use>
          </svg>
        </div>
        <div class="text-12px text-[--tjg-text-quaternary] text-center">{{ t('message.call_window.hangup') }}</div>
      </div>
    </div>
  </div>

  <!-- 语音通话 -->
  <div v-else-if="callType !== CallTypeEnum.VIDEO" class="relative z-10">
    <div :class="isMobileDevice ? 'pb-120px' : 'pb-30px'" class="flex-col-x-center">
      <!-- 上排按钮：静音、扬声器 -->
      <div class="flex-center gap-40px mb-32px">
        <!-- 静音按钮 -->
        <div class="flex-col-x-center gap-8px w-80px">
          <div
            @click="emit('toggle-mute')"
            class="size-44px rounded-full flex-center cursor-pointer"
            :class="
              !isMuted
                ? 'bg-[--tjg-surface-subtle] hover:bg-[--tjg-surface-list-hover]'
                : 'bg-[--tjg-color-danger-500]/60 hover:bg-[--tjg-color-danger-500]/80'
            ">
            <svg class="size-16px text-[--tjg-text-inverse]">
              <use :href="!isMuted ? '#voice' : '#voice-off'"></use>
            </svg>
          </div>
          <div v-if="!isMobileDevice" class="text-12px text-[--tjg-text-quaternary] text-center">
            {{ !isMuted ? t('message.call_window.mic_on') : t('message.call_window.mic_off') }}
          </div>
        </div>

        <!-- 扬声器按钮 -->
        <div class="flex-col-x-center gap-8px w-80px">
          <div
            @click="emit('toggle-speaker')"
            class="size-44px rounded-full flex-center cursor-pointer"
            :class="
              isSpeakerOn
                ? 'bg-[--tjg-surface-subtle] hover:bg-[--tjg-surface-list-hover]'
                : 'bg-[--tjg-color-danger-500]/60 hover:bg-[--tjg-color-danger-500]/80'
            ">
            <svg class="size-16px text-[--tjg-text-inverse]">
              <use :href="isSpeakerOn ? '#volume-notice' : '#volume-mute'"></use>
            </svg>
          </div>
          <div v-if="!isMobileDevice" class="text-12px text-[--tjg-text-quaternary] text-center">
            {{ isSpeakerOn ? t('message.call_window.speaker_on') : t('message.call_window.speaker_off') }}
          </div>
        </div>
      </div>

      <!-- 下排按钮：挂断 -->
      <div class="flex-x-center">
        <div
          @click="emit('hangup')"
          class="size-66px rounded-full bg-[--tjg-color-danger-500]/60 hover:bg-[--tjg-color-danger-500]/80 flex-center cursor-pointer">
          <svg class="size-24px text-[--tjg-text-inverse]">
            <use href="#PhoneHangup"></use>
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
// biome-ignore lint/style/useImportType: enum used in template
import { CallTypeEnum } from '@/enums'

defineProps<{
  callType: CallTypeEnum
  isMobileDevice: boolean
  isMuted: boolean
  isSpeakerOn: boolean
  isVideoEnabled: boolean
}>()

const emit = defineEmits<{
  'toggle-mute': []
  'toggle-speaker': []
  'toggle-video': []
  hangup: []
}>()

const { t } = useI18n()
</script>
