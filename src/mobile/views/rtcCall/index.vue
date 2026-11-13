<template>
  <div class="rtc-call-mobile" :class="{ 'is-video': isVideo }">
    <!-- 来电界面 -->
    <div v-if="isIncoming && !isCallActive" class="incoming-call-screen">
      <div class="caller-info">
        <van-image round width="80" height="80" :src="remoteAvatarUrl" class="caller-avatar" />
        <span class="caller-name">{{ peerDisplayName }}</span>
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
        <van-image round width="80" height="80" :src="remoteAvatarUrl" class="caller-avatar" />
        <span class="caller-name">{{ peerDisplayName }}</span>
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
      <RtcCallStatusOverlay
        :peer-name="peerDisplayName"
        :reconnecting="isReconnecting"
        :avatar-url="remoteAvatarUrl"
        :is-video="isVideo" />
      <template v-if="isVideo">
        <div class="video-container">
          <video ref="remoteVideoRef" class="remote-video" autoplay playsinline />
          <video ref="localVideoRef" class="local-video" autoplay playsinline muted />
        </div>
      </template>

      <RtcCallActionBar
        :muted="isAudioMuted"
        :camera-enabled="isVideo"
        :speaker-on="isSpeakerOn"
        @toggle-mute="handleToggleMute"
        @toggle-camera="handleSwitchCamera"
        @toggle-speaker="handleToggleSpeaker"
        @hangup="handleHangup" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { showDialog } from 'vant'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useVoIPCallFlow } from '@/composables/useVoIPCallFlow'
import router from '@/router'
import { profileService } from '@/services/matrix/user/MatrixProfileService'
import { createLogger } from '@/utils/Logger'
import { classifyMediaError, type MediaErrorTarget, resolveMediaErrorText } from './mediaError'
import RtcCallActionBar from './RtcCallActionBar.vue'
import RtcCallStatusOverlay from './RtcCallStatusOverlay.vue'

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
  lastError,
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

const isReconnecting = computed(() => callInfo.value?.state === 'reconnecting')

/** 刷新页面后路由只带 remoteUserId，资料需回查（Q-8） */
const remoteProfile = ref<{ displayName?: string; avatarUrl?: string } | null>(null)

const remoteUserId = computed(() => props.remoteUser?.userId || '')
const remoteAvatarUrl = computed(() => props.remoteUser?.avatarUrl || remoteProfile.value?.avatarUrl || '')
const peerDisplayName = computed(
  () => props.remoteUser?.displayName || remoteProfile.value?.displayName || remoteUserId.value || ''
)

async function resolveRemoteProfile() {
  if (props.remoteUser?.displayName && props.remoteUser?.avatarUrl) return
  if (!remoteUserId.value) return

  try {
    const profile = await profileService.getProfile(remoteUserId.value)
    remoteProfile.value = {
      ...(profile.displayname ? { displayName: profile.displayname } : {}),
      ...(profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : {})
    }
  } catch (error) {
    logger.warn('Failed to fetch remote user profile', error)
  }
}

const isCallActive = computed(() => {
  const currentState = callInfo.value?.state
  return currentState === 'connected' || currentState === 'connecting' || currentState === 'reconnecting'
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

/**
 * 把媒体设备异常按 err.name 分类成可读引导弹窗。
 * 返回 false 表示不是权限/设备类错误（调用方已自行兜底提示）。
 */
const showMediaErrorDialog = async (err: unknown, target: MediaErrorTarget): Promise<boolean> => {
  const kind = classifyMediaError(err)
  if (kind === 'unknown') return false
  const { messageKey, guideKey } = resolveMediaErrorText(kind, target)
  const message = guideKey ? `${t(messageKey)}\n${t(guideKey)}` : t(messageKey)
  await showDialog({
    message,
    messageAlign: 'left',
    confirmButtonText: t('common.close'),
    closeOnClickOverlay: false
  }).catch(() => {})
  return true
}

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
    await showMediaErrorDialog(err, 'camera')
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

// 远端挂断时直接回退；通话出错先给出可读原因（用户点“关闭”后再回退）
watch(state, async (next) => {
  if (next === 'ended') {
    emit('close')
    leaveCallPage()
    return
  }
  if (next === 'error') {
    await showDialog({
      message: t('voip.errors.call_failed'),
      confirmButtonText: t('common.close'),
      closeOnClickOverlay: false
    }).catch(() => {})
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
    await showMediaErrorDialog(lastError.value, props.isVideo ? 'av' : 'mic')
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
  void resolveRemoteProfile()

  if (props.isIncoming || initialCallId || !props.roomId) {
    return
  }
  const started = await startCall(props.roomId, { audio: true, video: props.isVideo })
  if (!started) {
    await showMediaErrorDialog(lastError.value, props.isVideo ? 'av' : 'mic')
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
  @apply flex flex-col h-full w-full relative;
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
</style>
