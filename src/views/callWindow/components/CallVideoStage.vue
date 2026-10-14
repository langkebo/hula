<template>
  <div class="w-full flex-1 relative min-h-0 overflow-hidden">
    <!-- 状态提示（未接通时） -->
    <div v-if="connectionStatus !== RTCCallStatus.ACCEPT" class="absolute inset-0 flex-center z-20">
      <div class="rounded-full bg-black/60 px-20px py-8px text-16px text-white">
        {{ callStatusText }}
      </div>
    </div>

    <!-- 主视频 -->
    <video
      ref="mainVideoRef"
      autoplay
      playsinline
      class="w-full h-full scale-x-[-1] bg-black object-cover rounded-8px"></video>

    <!-- 画中画视频 -->
    <div class="absolute right-8px top-12px group z-30">
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
  </div>
</template>

<script setup lang="ts">
import { ref, toRef, watch } from 'vue'
// biome-ignore lint/style/useImportType: enum used in template
import { RTCCallStatus } from '@/enums'
import { useCallMedia } from '../composables/useCallMedia'

const props = defineProps<{
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  isVideoEnabled: boolean
  isSpeakerOn: boolean
  connectionStatus: RTCCallStatus | undefined
  callStatusText: string
  pipVideoSizeClass: string
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
