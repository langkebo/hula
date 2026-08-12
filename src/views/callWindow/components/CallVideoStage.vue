<template>
  <div class="w-full flex-1 relative min-h-0 overflow-hidden">
    <!-- 状态提示（桌面端未接通时） -->
    <div v-if="!isMobileDevice && connectionStatus !== RTCCallStatus.ACCEPT" class="absolute inset-0 flex-center z-20">
      <div class="rounded-full bg-black/60 px-20px py-8px text-16px text-white">
        {{ callStatusText }}
      </div>
    </div>

    <!-- 主视频 -->
    <video
      ref="mainVideoRef"
      autoplay
      playsinline
      :class="[
        'w-full h-full scale-x-[-1] bg-black object-cover',
        isMobileDevice ? 'rounded-none' : 'rounded-8px'
      ]"></video>

    <!-- 画中画视频 -->
    <div :class="isMobileDevice ? 'top-100px' : 'top-12px'" class="absolute right-8px group z-30">
      <video
        ref="pipVideoRef"
        autoplay
        playsinline
        :class="pipVideoSizeClass"
        class="scale-x-[-1] rounded-8px bg-black object-cover border-2 border-white cursor-pointer"
        @click="handleToggleLayout"></video>
      <!-- 切换提示 -->
      <div
        class="absolute inset-0 flex-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-30 rounded-8px pointer-events-none">
        <svg class="text-[--tjg-text-inverse] size-20px">
          <use href="#switch"></use>
        </svg>
      </div>
    </div>

    <!-- 底部控制按钮悬浮层（仅移动端） -->
    <div
      v-if="isMobileDevice"
      class="absolute inset-x-0 bottom-0 z-30 px-24px pb-24px pointer-events-none"
      :style="{
        background: 'linear-gradient(180deg, rgba(15, 15, 15, 0) 0%, rgba(15, 15, 15, 0.88) 100%)',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom))'
      }">
      <!-- 通话时长 -->
      <div v-if="connectionStatus === RTCCallStatus.ACCEPT" class="pb-16px text-center pointer-events-none">
        <div class="inline-block rounded-full bg-black/50 px-16px py-6px text-14px text-[--tjg-text-inverse]">
          {{ formattedCallDuration }}
        </div>
      </div>

      <div class="flex-center gap-24px pointer-events-auto">
        <!-- 静音按钮 -->
        <div class="flex-center">
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
        </div>

        <!-- 扬声器按钮 -->
        <div class="flex-center">
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
        </div>

        <!-- 摄像头翻转按钮（仅视频通话） -->
        <div v-if="callType === CallTypeEnum.VIDEO" class="flex-center">
          <div
            @click="emit('switch-camera')"
            class="size-44px rounded-full flex-center cursor-pointer bg-[--tjg-surface-subtle] hover:bg-[--tjg-surface-list-hover]">
            <svg class="size-16px text-[--tjg-text-inverse]">
              <use href="#refresh"></use>
            </svg>
          </div>
        </div>

        <!-- 摄像头按钮 -->
        <div class="flex-center">
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
        </div>

        <!-- 挂断按钮 -->
        <div class="flex-center">
          <div
            @click="emit('hangup')"
            class="size-44px rounded-full bg-[--tjg-color-danger-500]/60 hover:bg-[--tjg-color-danger-500]/80 flex-center cursor-pointer">
            <svg class="size-16px text-[--tjg-text-inverse]">
              <use href="#PhoneHangup"></use>
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, toRef, watch } from 'vue'
// biome-ignore lint/style/useImportType: enum used in template
import { CallTypeEnum, RTCCallStatus } from '@/enums'
import { useCallMedia } from '../composables/useCallMedia'

const props = defineProps<{
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  isVideoEnabled: boolean
  isSpeakerOn: boolean
  isMuted: boolean
  callType: CallTypeEnum
  connectionStatus: RTCCallStatus | undefined
  callStatusText: string
  formattedCallDuration: string
  isMobileDevice: boolean
  pipVideoSizeClass: string
}>()

const emit = defineEmits<{
  'toggle-mute': []
  'toggle-speaker': []
  'switch-camera': []
  'toggle-video': []
  hangup: []
}>()

const mainVideoRef = ref<HTMLVideoElement>()
const pipVideoRef = ref<HTMLVideoElement>()

const { hasLocalVideo, hasRemoteVideo, assignVideoStreams, toggleVideoLayout, updateRemoteVideoAudio } = useCallMedia({
  localStream: toRef(props, 'localStream'),
  remoteStream: toRef(props, 'remoteStream'),
  isVideoEnabled: toRef(props, 'isVideoEnabled'),
  isSpeakerOn: toRef(props, 'isSpeakerOn'),
  mainVideoRef,
  pipVideoRef
})

const handleToggleLayout = () => {
  void toggleVideoLayout()
}

// 监听视频状态变化，自动更新视频显示
watch([hasLocalVideo, hasRemoteVideo, () => props.localStream, () => props.remoteStream], () => {
  void assignVideoStreams()
})

// 监听扬声器状态，更新视频元素音频
watch(
  () => props.isSpeakerOn,
  () => {
    updateRemoteVideoAudio()
  }
)

// 初始分配
watch(
  () => props.localStream,
  () => {
    void assignVideoStreams()
  },
  { immediate: true }
)
</script>
