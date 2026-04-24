<template>
  <div class="call-view" :class="{ 'is-video': isVideo }">
    <div class="call-header">
      <div class="call-info">
        <span class="call-type">{{ isVideo ? t('call.video_call') : t('call.voice_call') }}</span>
        <span class="call-duration">{{ formatDuration(callDuration) }}</span>
      </div>
      <div class="call-status" :class="callState">
        <span class="status-indicator"></span>
        <span class="status-text">{{ getStatusText() }}</span>
      </div>
    </div>

    <div class="call-content">
      <template v-if="isVideo">
        <div class="video-container">
          <video ref="remoteVideoRef" class="remote-video" autoplay playsinline />
          <video ref="localVideoRef" class="local-video" autoplay playsinline muted />
        </div>
      </template>
      <template v-else>
        <div class="voice-container">
          <n-avatar round :size="120" :src="remoteUser?.avatarUrl" :fallback-src="defaultAvatar" />
          <span class="user-name">{{ remoteUser?.displayName || remoteUser?.userId }}</span>
        </div>
      </template>
    </div>

    <div class="call-controls">
      <n-button circle :type="isMuted ? 'error' : 'default'" @click="toggleMute">
        <template #icon>
          <svg class="size-20px">
            <use :href="isMuted ? '#mic-off' : '#mic'"></use>
          </svg>
        </template>
      </n-button>

      <n-button v-if="isVideo" circle :type="isVideoMuted ? 'error' : 'default'" @click="toggleVideo">
        <template #icon>
          <svg class="size-20px">
            <use :href="isVideoMuted ? '#video-off' : '#video'"></use>
          </svg>
        </template>
      </n-button>

      <n-button circle type="error" size="large" @click="handleHangup">
        <template #icon>
          <svg class="size-24px">
            <use href="#phone-off"></use>
          </svg>
        </template>
      </n-button>

      <n-button v-if="isVideo" circle :type="isScreenSharing ? 'primary' : 'default'" @click="toggleScreenShare">
        <template #icon>
          <svg class="size-20px">
            <use href="#screen-share"></use>
          </svg>
        </template>
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { matrixVoIPService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'
import { useTimerManager } from '@/utils/TimerManager'
const logger = createLogger('CallView')
const timerManager = useTimerManager()

const props = defineProps<{
  callId: string
  isVideo: boolean
  callState: 'ringing' | 'connecting' | 'connected' | 'ended' | 'error'
  remoteUser?: {
    userId: string
    displayName?: string
    avatarUrl?: string
  }
}>()

const emit = defineEmits<{
  (e: 'hangup'): void
  (e: 'state-change', state: string): void
}>()

const { t } = useI18n()
const callDuration = ref(0)
const isMuted = ref(false)
const isVideoMuted = ref(false)
const isScreenSharing = ref(false)
const defaultAvatar = '/logoD.png'

let durationTimer: number | null = null

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const getStatusText = (): string => {
  switch (props.callState) {
    case 'ringing':
      return t('call.ringing')
    case 'connecting':
      return t('call.connecting')
    case 'connected':
      return t('call.connected')
    case 'ended':
      return t('call.ended')
    case 'error':
      return t('call.error')
    default:
      return ''
  }
}

const toggleMute = async () => {
  isMuted.value = await matrixVoIPService.toggleMute(props.callId)
}

const toggleVideo = async () => {
  isVideoMuted.value = await matrixVoIPService.toggleVideo(props.callId)
}

const toggleScreenShare = async () => {
  try {
    if (isScreenSharing.value) {
      await matrixVoIPService.stopScreenshare(props.callId)
      isScreenSharing.value = false
    } else {
      await matrixVoIPService.startScreenshare(props.callId)
      isScreenSharing.value = true
    }
  } catch (error) {
    logger.error('屏幕共享失败:', error)
  }
}

const handleHangup = async () => {
  await matrixVoIPService.hangupCall(props.callId)
  emit('hangup')
}

const startDurationTimer = () => {
  if (durationTimer) timerManager.clearInterval(durationTimer)
  durationTimer = timerManager.setInterval(() => {
    callDuration.value++
  }, 1000)
}

const stopDurationTimer = () => {
  if (durationTimer) {
    timerManager.clearInterval(durationTimer)
    durationTimer = null
  }
}

watch(
  () => props.callState,
  (state) => {
    if (state === 'connected') {
      startDurationTimer()
    } else {
      stopDurationTimer()
    }
  }
)

onUnmounted(() => {
  stopDurationTimer()
  timerManager.clearAll()
})
</script>

<style scoped lang="scss">
.call-view {
  @apply flex flex-col h-full bg-[--bg-color];

  &.is-video {
    background: var(--call-video-bg, #000);
  }
}

.call-header {
  @apply flex items-center justify-between p-16px;
}

.call-info {
  @apply flex items-center gap-12px;
}

.call-type {
  @apply text-16px font-medium;
}

.call-duration {
  @apply text-14px color-[--color-text-tertiary];
}

.call-status {
  @apply flex items-center gap-6px;

  &.ringing .status-indicator {
    @apply w-8px h-8px rounded-full bg-[--color-warning] animate-pulse;
  }

  &.connecting .status-indicator {
    @apply w-8px h-8px rounded-full bg-[--color-info] animate-pulse;
  }

  &.connected .status-indicator {
    @apply w-8px h-8px rounded-full bg-[--color-success];
  }

  &.ended .status-indicator,
  &.error .status-indicator {
    @apply w-8px h-8px rounded-full bg-[--color-danger];
  }
}

.status-text {
  @apply text-12px color-[--color-text-tertiary];
}

.call-content {
  @apply flex-1 flex-center;
}

.video-container {
  @apply relative w-full h-full;
}

.remote-video {
  @apply w-full h-full object-cover;
}

.local-video {
  @apply absolute bottom-16px right-16px w-160px h-120px rounded-8px object-cover border-2px border-solid border-white;
}

.voice-container {
  @apply flex flex-col items-center gap-16px;
}

.user-name {
  @apply text-18px font-medium;
}

.call-controls {
  @apply flex items-center justify-center gap-16px p-24px;
}
</style>
