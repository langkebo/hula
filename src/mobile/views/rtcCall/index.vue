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
            :class="isAudioMuted ? 'btn-active-toggled' : 'btn-control'"
            :aria-label="t('voip.call.mute')"
            @click="handleToggleMute">
            <van-icon :name="isAudioMuted ? 'warning-o' : 'volume-o'" size="22" />
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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useVoIPCallFlow } from '@/composables/useVoIPCallFlow'
import router from '@/router'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('RtcCallMobile')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

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
// callId 由路由层从 query 映射（来电透传）；去电时页面自己发起通话
const initialCallId = props.callId?.trim() || undefined
const {
  callInfo,
  isAudioMuted,
  isSpeakerOn,
  state,
  toggleSpeaker,
  startCall,
  toggleMute,
  answerCall,
  rejectCall,
  hangup
} = useVoIPCallFlow({
  // exactOptionalPropertyTypes 下可选属性不接受显式 undefined，缺省时整体省略
  ...(initialCallId ? { initialCallId } : {}),
  ...(props.roomId ? { initialRoomId: props.roomId } : {})
})

// --- Refs ---
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
// 两条流是同一个关注点（把流绑到对应的 <video>），合成一个 watch：
// ref 在非视频通话下不存在，故逐个判空；immediate 保证挂载即绑。
watch(
  [localStream, remoteStream],
  ([local, remote]) => {
    if (localVideoRef.value) localVideoRef.value.srcObject = local
    if (remoteVideoRef.value) remoteVideoRef.value.srcObject = remote
  },
  { immediate: true }
)

// --- Actions ---
const handleToggleMute = async () => {
  await toggleMute()
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

// 本地挂断/拒接与远端结束都会走到这里，guard 保证只导航一次
let hasLeft = false
const leaveCallPage = () => {
  if (hasLeft) return
  hasLeft = true
  if (window.history.state?.back) {
    router.back()
    return
  }
  router.replace('/mobile/message')
}

// 远端挂断或通话出错时页面不能停留在通话界面
watch(state, (next) => {
  if (next === 'ended' || next === 'error') {
    emit('close')
    leaveCallPage()
  }
})

const handleDecline = async () => {
  await rejectCall()
  emit('reject')
  emit('close')
  leaveCallPage()
}

const handleAnswer = async () => {
  if (!initialCallId) {
    // 路由未透传 callId 时没有可接听的 Matrix 通话，明确告知而不是静默失败
    showFeedback(t('voip.errors.answer_failed'), 'error')
    return
  }
  const answered = await answerCall(undefined, { audio: true, video: props.isVideo })
  if (!answered) {
    return
  }
  emit('answer')
}

const handleCancel = async () => {
  await hangup()
  emit('reject')
  emit('close')
  leaveCallPage()
}

const handleHangup = async () => {
  await hangup()
  emit('close')
  leaveCallPage()
}

// 去电：调用方只负责跳转并把 roomId / callType 放进 query，通话必须由本页发起
onMounted(async () => {
  if (props.isIncoming || initialCallId || !props.roomId) {
    return
  }
  const started = await startCall(props.roomId, { audio: true, video: props.isVideo })
  if (!started) {
    leaveCallPage()
  }
})

// --- Cleanup on unmount ---
onUnmounted(() => {
  // 卸载后 startCall 才 rejected（如页面已被返回键关闭）时，续体不能再触发一次回退
  hasLeft = true
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
    border: 2px solid var(--tjg-text-inverse);

    @supports (color: color-mix(in srgb, red, blue)) {
      border: 2px solid color-mix(in srgb, var(--tjg-text-inverse) 80%, transparent);
    }
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
    background: var(--tjg-color-danger-500);
    color: var(--tjg-text-inverse);
    border: none;

    @supports (color: color-mix(in srgb, red, blue)) {
      background: color-mix(in srgb, var(--tjg-color-danger-500) 60%, transparent);
    }
  }

  .btn-hangup {
    @apply size-64px;
    border: none;
    transform: rotate(135deg);
  }
}
</style>
