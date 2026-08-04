<template>
  <div class="rtc-call-mobile" :class="{ 'is-video': isVideo }">
    <!-- 来电界面 -->
    <div v-if="isIncoming && !isCallActive" class="incoming-call-screen">
      <div class="caller-info">
        <van-image round width="80" height="80" :src="remoteUser?.avatarUrl || ''" class="caller-avatar" />
        <span class="caller-name">{{ remoteUser?.displayName || remoteUser?.userId || t('voip.unknown') }}</span>
        <span class="call-type-label">
          {{ isVideo ? t('voip.incoming.video_call') : t('voip.incoming.voice_call') }}
        </span>
      </div>
      <div class="incoming-actions">
        <van-button round class="btn-decline" :aria-label="t('voip.incoming.decline')" @click="handleDecline">
          <van-icon name="close" size="24" />
        </van-button>
        <van-button
          round
          type="primary"
          class="btn-answer"
          :aria-label="t('voip.incoming.answer')"
          @click="handleAnswer">
          <van-icon name="phone-o" size="24" />
        </van-button>
      </div>
    </div>

    <!-- 去电界面 -->
    <div v-else-if="!isIncoming && !isCallActive" class="outgoing-call-screen">
      <div class="caller-info">
        <van-image round width="80" height="80" :src="remoteUser?.avatarUrl || ''" class="caller-avatar" />
        <span class="caller-name">{{ remoteUser?.displayName || remoteUser?.userId || t('voip.unknown') }}</span>
        <span class="call-state-text">{{ t('voip.states.ringing_outgoing') }}</span>
      </div>
      <div class="outgoing-actions">
        <van-button round class="btn-cancel" :aria-label="t('voip.outgoing.cancel')" @click="handleCancel">
          <van-icon name="close" size="24" />
        </van-button>
      </div>
    </div>

    <!-- 通话中界面 -->
    <div v-else class="active-call-screen">
      <template v-if="isVideo">
        <div class="video-container">
          <video ref="remoteVideoRef" class="remote-video" autoplay playsinline />
          <video ref="localVideoRef" class="local-video" autoplay playsinline muted />
        </div>
      </template>
      <template v-else>
        <div class="voice-container">
          <van-image round width="100" height="100" :src="remoteUser?.avatarUrl || ''" />
          <span class="user-name">{{ remoteUser?.displayName || remoteUser?.userId }}</span>
          <span class="call-status">{{ t('voip.states.connected') }}</span>
        </div>
      </template>

      <div class="call-controls">
        <div class="controls-row">
          <!-- 静音 -->
          <van-button
            round
            :class="isMuted ? 'btn-active-toggled' : 'btn-control'"
            :aria-label="t('voip.call.mute')"
            @click="handleToggleMute">
            <van-icon :name="isMuted ? 'warning-o' : 'volume-o'" size="22" />
          </van-button>

          <!-- 扬声器 -->
          <van-button
            round
            :class="isSpeakerOn ? 'btn-control' : 'btn-active-toggled'"
            :aria-label="t('voip.call.speaker')"
            @click="handleToggleSpeaker">
            <van-icon :name="isSpeakerOn ? 'volume' : 'volume-o'" size="22" />
          </van-button>

          <!-- 摄像头切换（仅视频通话） -->
          <van-button
            v-if="isVideo"
            round
            class="btn-control"
            :aria-label="t('voip.call.switch_camera')"
            @click="handleSwitchCamera">
            <van-icon name="revoke" size="22" />
          </van-button>
        </div>

        <div class="hangup-row">
          <!-- 挂断 -->
          <van-button
            round
            type="danger"
            size="large"
            class="btn-hangup"
            :aria-label="t('voip.call.hangup')"
            @click="handleHangup">
            <van-icon name="phone-o" size="28" />
          </van-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVoIPCallFlow } from '@/composables/webrtc/useVoIPCallFlow'
import { matrixVoIPService } from '@/services/matrix/media/MatrixVoIPService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('RtcCallMobile')
const { t } = useI18n()

const props = defineProps<{
  callId: string
  roomId?: string
  isVideo: boolean
  isIncoming: boolean
  remoteUser?: {
    userId: string
    displayName?: string
    avatarUrl?: string
  }
}>()

const emit = defineEmits<{
  (e: 'reject'): void
  (e: 'close'): void
  (e: 'answer'): void
}>()

// --- VoIP call flow ---
const { callInfo, isSpeakerOn, toggleSpeaker, answerCall, rejectCall, hangup } = useVoIPCallFlow()

// --- Refs ---
const isMuted = ref(false)
const remoteVideoRef = ref<HTMLVideoElement>()
const localVideoRef = ref<HTMLVideoElement>()
const cameraFacingMode = ref<'user' | 'environment'>('user')

// --- Computed streams from callInfo ---
const localStream = computed(() => callInfo.value?.localStream ?? null)
const remoteStream = computed(() => callInfo.value?.remoteStream ?? null)

const isCallActive = computed(() => {
  const state = callInfo.value?.state
  return state === 'connected' || state === 'connecting'
})

// --- Stream binding ---
watch(
  localStream,
  (stream) => {
    if (localVideoRef.value) {
      localVideoRef.value.srcObject = stream
    }
  },
  { immediate: true }
)

watch(
  remoteStream,
  (stream) => {
    if (remoteVideoRef.value) {
      remoteVideoRef.value.srcObject = stream
    }
  },
  { immediate: true }
)

// --- Actions ---
const handleToggleMute = async () => {
  try {
    isMuted.value = await matrixVoIPService.toggleMute(props.callId)
  } catch (err) {
    logger.error('toggleMute failed:', err)
  }
}

const handleToggleSpeaker = async () => {
  await toggleSpeaker()
}

const handleSwitchCamera = async () => {
  const stream = callInfo.value?.localStream
  if (!stream) {
    return
  }

  try {
    // Stop and remove current video track
    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.stop()
      stream.removeTrack(videoTrack)
    }

    // Toggle facing mode
    const newFacingMode = cameraFacingMode.value === 'user' ? 'environment' : 'user'
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: newFacingMode },
      audio: false
    })

    const newVideoTrack = newStream.getVideoTracks()[0]
    if (newVideoTrack) {
      stream.addTrack(newVideoTrack)
      cameraFacingMode.value = newFacingMode
    }

    logger.info(`Camera switched to: ${newFacingMode}`)
  } catch (err) {
    logger.error('Camera switch failed:', err)
  }
}

const handleDecline = async () => {
  try {
    await rejectCall(props.callId)
  } catch (err) {
    logger.error('Decline call failed:', err)
  } finally {
    emit('reject')
    emit('close')
  }
}

const handleAnswer = async () => {
  try {
    await answerCall(props.callId, { audio: true, video: props.isVideo })
  } catch (err) {
    logger.error('Answer call failed:', err)
    return
  }
  emit('answer')
}

const handleCancel = async () => {
  try {
    await hangup()
  } catch (err) {
    logger.error('Cancel call failed:', err)
  } finally {
    emit('reject')
    emit('close')
  }
}

const handleHangup = async () => {
  try {
    await hangup()
  } catch (err) {
    logger.error('Hangup failed:', err)
  } finally {
    emit('close')
  }
}

// --- Cleanup on unmount ---
onUnmounted(() => {
  if (localVideoRef.value) {
    localVideoRef.value.srcObject = null
  }
  if (remoteVideoRef.value) {
    remoteVideoRef.value.srcObject = null
  }
})
</script>

<style scoped lang="scss">
.rtc-call-mobile {
  @apply flex flex-col items-center justify-center h-full w-full bg-[--tjg-surface-page];
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);

  &.is-video {
    background: var(--tjg-surface-media-preview);
  }
}

.incoming-call-screen,
.outgoing-call-screen {
  @apply flex flex-col items-center justify-center gap-40px flex-1 w-full;
}

.caller-info {
  @apply flex flex-col items-center gap-12px;

  .caller-avatar {
    border: 2px solid var(--tjg-color-primary-500);
  }

  .caller-name {
    @apply text-20px font-semibold;
    color: var(--tjg-text-primary);
  }

  .call-type-label,
  .call-state-text {
    @apply text-14px;
    color: var(--tjg-text-tertiary);
  }
}

.incoming-actions {
  @apply flex items-center gap-32px;

  .btn-decline {
    @apply size-64px;
    background: var(--tjg-color-danger-500);
    color: var(--tjg-text-inverse);
    border: none;
  }

  .btn-answer {
    @apply size-64px;
    border: none;
  }
}

.outgoing-actions {
  .btn-cancel {
    @apply size-64px;
    background: var(--tjg-color-danger-500);
    color: var(--tjg-text-inverse);
    border: none;
  }
}

.active-call-screen {
  @apply flex flex-col h-full w-full;
}

.video-container {
  @apply relative flex-1 w-full;

  .remote-video {
    @apply w-full h-full object-cover;
  }

  .local-video {
    @apply absolute bottom-80px right-16px w-120px h-160px rounded-8px object-cover;
    border: 2px solid rgba(255, 255, 255, 0.8);
  }
}

.voice-container {
  @apply flex flex-col items-center justify-center gap-16px flex-1;

  .user-name {
    @apply text-20px font-medium;
    color: var(--tjg-text-primary);
  }

  .call-status {
    @apply text-14px;
    color: var(--tjg-text-tertiary);
  }
}

.call-controls {
  @apply flex flex-col items-center gap-24px pb-32px w-full;
  padding-bottom: calc(32px + env(safe-area-inset-bottom));

  .controls-row {
    @apply flex items-center justify-center gap-20px;
  }

  .hangup-row {
    @apply mt-8px;
  }

  .btn-control {
    @apply size-48px;
    background: var(--tjg-surface-subtle);
    color: var(--tjg-text-primary);
    border: none;
  }

  .btn-active-toggled {
    @apply size-48px;
    background: rgba(255, 59, 48, 0.6);
    color: var(--tjg-text-inverse);
    border: none;
  }

  .btn-hangup {
    @apply size-64px;
    border: none;
    transform: rotate(135deg);
  }
}
</style>
