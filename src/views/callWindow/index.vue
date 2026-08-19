<template>
  <!-- 通知样式窗口 (接收方且未接听) -->
  <CallIncomingBanner
    v-if="isReceiver && !isCallAccepted"
    :avatar-src="avatarSrc"
    :call-type="callType"
    :remote-user-name="remoteUserInfo?.name || ''"
    @accept="handleAcceptCall"
    @reject="handleReject" />

  <!-- 正常通话窗口 -->
  <div v-else data-tauri-drag-region class="h-full flex flex-col select-none relative bg-[--tjg-surface-media-preview]">
    <!-- 背景羽化模糊层 -->
    <div
      :style="{
        backgroundImage: `url(${avatarSrc})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }"
      class="absolute inset-0 blur-xl opacity-40"></div>
    <!-- 深色遮罩 -->
    <div class="absolute inset-0 bg-black/20"></div>

    <!-- 窗口控制栏 -->
    <ActionBar
      v-if="!isMobileDevice"
      ref="actionBarRef"
      class="relative z-10"
      :top-win-label="currentWindowLabel"
      :shrink="false" />

    <!-- 主要内容区域 -->
    <div
      :class="[
        'relative z-10 flex flex-col min-h-0 flex-1',
        isMobileDevice ? 'p-0' : 'px-8px pt-6px',
        !isMobileDevice || callType !== CallTypeEnum.VIDEO ? 'items-center justify-center' : ''
      ]">
      <!-- 视频通话时显示视频 -->
      <CallVideoStage
        v-if="callType === CallTypeEnum.VIDEO && localStream && (isVideoEnabled || hasRemoteVideo)"
        :local-stream="localStream"
        :remote-stream="remoteStream"
        :is-video-enabled="isVideoEnabled"
        :is-speaker-on="isSpeakerOn"
        :is-muted="isMuted"
        :call-type="callType"
        :connection-status="connectionStatus"
        :call-status-text="callStatusText"
        :formatted-call-duration="formattedCallDuration"
        :is-mobile-device="isMobileDevice"
        :pip-video-size-class="pipVideoSizeClass"
        @toggle-mute="toggleMute"
        @toggle-speaker="toggleSpeaker"
        @switch-camera="handleSwitchCamera"
        @toggle-video="handleToggleVideo"
        @hangup="handleHangup()" />

      <!-- 语音通话或其他状态时显示头像 -->
      <CallAvatarStage
        v-else
        :avatar-src="avatarSrc"
        :remote-user-name="remoteUserInfo?.name || ''"
        :call-status-text="callStatusText"
        :should-center="shouldCenterPreparingAvatar" />

      <!-- 通话时长 -->
      <div
        v-if="connectionStatus === RTCCallStatus.ACCEPT && (!isMobileDevice || callType !== CallTypeEnum.VIDEO)"
        class="inline-block rounded-full bg-black/50 px-16px py-6px text-16px text-gray-300 my-12px text-center">
        {{ formattedCallDuration }}
      </div>
    </div>

    <!-- 底部控制栏 -->
    <CallControlsBar
      :call-type="callType"
      :is-mobile-device="isMobileDevice"
      :is-muted="isMuted"
      :is-speaker-on="isSpeakerOn"
      :is-video-enabled="isVideoEnabled"
      @toggle-mute="toggleMute"
      @toggle-speaker="toggleSpeaker"
      @toggle-video="handleToggleVideo"
      @hangup="handleHangup()" />
  </div>

  <audio ref="remoteAudioRef" autoplay playsinline style="display: none"></audio>
</template>

<script setup lang="ts">
import { LogicalPosition, LogicalSize, PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { primaryMonitor } from '@tauri-apps/api/window'

import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useVoIPCallFlow } from '@/composables/useVoIPCallFlow'
import { CallTypeEnum, RTCCallStatus } from '@/enums'
import router from '@/router'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { isDesktop, isMac, isWindows } from '@/utils/PlatformConstants'
import { invokeSilently } from '@/utils/TauriInvokeHandler'
import { useTimerManager } from '@/utils/TimerManager'
import { CallAvatarStage, CallControlsBar, CallIncomingBanner, CallVideoStage } from './components'
import { parseCallRoute, useCallState } from './composables/useCallState'
import { useCallControls } from './composables/useCallControls'

const logger = createLogger('CallWindow')
const timerManager = useTimerManager()

// 1. 解析路由
const routeInfo = parseCallRoute()
const { remoteUserId, roomId, callType, isReceiver, shouldAutoAccept, isMobileDevice } = routeInfo

if ((!roomId || !remoteUserId) && isMobileDevice) {
  router.replace('/mobile/message')
}

// 2. Matrix VoIP 通话流程
const {
  callInfo,
  isAudioMuted,
  isVideoEnabled,
  isSpeakerOn,
  state,
  toggleMute: voipToggleMute,
  toggleVideo: voipToggleVideo,
  toggleSpeaker,
  startCall,
  answerCall,
  rejectCall,
  hangup: voipHangup,
  checkPermissions,
  checkAvailability
} = useVoIPCallFlow({ initialRoomId: roomId })

// 3. 通话状态（映射到旧接口兼容）
const legacyConnectionStatus = ref<RTCCallStatus | undefined>()
const callDuration = ref(0)

watch(state, (s) => {
  switch (s) {
    case 'ringing':
      legacyConnectionStatus.value = isReceiver ? RTCCallStatus.CALLING : RTCCallStatus.CALLING
      break
    case 'connecting':
      legacyConnectionStatus.value = RTCCallStatus.CALLING
      break
    case 'connected':
      legacyConnectionStatus.value = RTCCallStatus.ACCEPT
      break
    case 'ended':
      legacyConnectionStatus.value = RTCCallStatus.END
      break
    case 'error':
      legacyConnectionStatus.value = RTCCallStatus.ERROR
      break
    default:
      legacyConnectionStatus.value = undefined
  }
})

const connectionStatus = legacyConnectionStatus

const localStream = ref<MediaStream | null>(null)
const remoteStream = ref<MediaStream | null>(null)

// 从 callInfo 同步流
watch(
  () => callInfo.value?.localStream,
  (stream) => {
    localStream.value = stream ?? null
  },
  { immediate: true }
)

watch(
  () => callInfo.value?.remoteStream,
  (stream) => {
    remoteStream.value = stream ?? null
  },
  { immediate: true }
)

const {
  remoteUserInfo,
  avatarSrc,
  isCallAccepted,
  isMuted,
  isVideoOn,
  currentWindowLabel,
  actionBarRef,
  callStatusText,
  formattedCallDuration,
  hasRemoteVideo,
  pipVideoSizeClass,
  shouldCenterPreparingAvatar
} = useCallState({ ...routeInfo, localStream, remoteStream, isVideoEnabled, callDuration, connectionStatus })

// 4. 通话控制（简化版，去掉 WebRTC 专属参数）
const { toggleMute, hangUp } = useCallControls({
  isMuted,
  isCallAccepted,
  connectionStatus,
  isMobileDevice
})

// ── 铃声管理 ──
const BELL_URL = '/sound/tjg_bell.mp3'
let bellAudio: HTMLAudioElement | null = null

const startBell = () => {
  const audio = new Audio(BELL_URL)
  audio.loop = true
  bellAudio = audio
  audio.play?.().catch(() => {
    logger.debug('铃声播放被浏览器阻止')
  })
}

const stopBell = () => {
  bellAudio?.pause?.()
  bellAudio = null
}

// 来电铃声控制
watch(
  state,
  (s) => {
    if (isReceiver && s === 'ringing' && !isCallAccepted.value) {
      startBell()
    } else {
      stopBell()
    }
  },
  { immediate: true }
)

// ── 通话时长计时器 ──
let durationTimer: number | null = null

const startDurationTimer = () => {
  if (durationTimer) return
  durationTimer = timerManager.setInterval(() => {
    callDuration.value++
  }, 1000)
}

const stopDurationTimer = () => {
  if (durationTimer !== null) {
    timerManager.clearInterval(durationTimer)
    durationTimer = null
  }
}

watch(
  state,
  (s) => {
    if (s === 'connected') {
      startDurationTimer()
    } else if (s === 'ended' || s === 'error') {
      stopDurationTimer()
    }
  }
)

// 生命周期清理
onUnmounted(() => {
  stopBell()
  stopDurationTimer()
  timerManager.clearAll()
})

// ── 视频操作 ──
const handleToggleVideo = async () => {
  await voipToggleVideo()
  isVideoOn.value = isVideoEnabled.value
}

const handleSwitchCamera = async () => {
  if (!localStream.value) return
  try {
    const videoTrack = localStream.value.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.stop()
      localStream.value.removeTrack(videoTrack)
    }
    const facingMode = localStream.value.getVideoTracks().length > 0 ? 'environment' : 'user'
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facingMode === 'user' ? 'environment' : 'user' },
      audio: false
    })
    const newVideoTrack = newStream.getVideoTracks()[0]
    if (newVideoTrack) {
      localStream.value.addTrack(newVideoTrack)
    }
  } catch (err) {
    logger.error('摄像头切换失败:', err)
  }
}

// ── 接听通话 ──
const handleAcceptCall = async () => {
  stopBell()
  isCallAccepted.value = true
  const opts = { audio: true, video: callType === CallTypeEnum.VIDEO }
  await answerCall(undefined, opts)
  // 窗口调整
  try {
    const currentWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null
    if (!currentWindow) return
    const isVideo = callType === CallTypeEnum.VIDEO
    const size = isWindows()
      ? new LogicalSize(isVideo ? 850 : 500, isVideo ? 580 : 650)
      : new PhysicalSize(isVideo ? 850 : 500, isVideo ? 580 : 650)
    await currentWindow.setSize(size)
    await currentWindow.center()
    await currentWindow.setAlwaysOnTop(false)
    if (isMac()) {
      await invokeSilently('show_title_bar_buttons', { windowLabel: currentWindow.label })
    }
    await currentWindow.setFocus()
  } catch (error) {
    logger.error('Failed to resize window after accepting call:', error)
  }
}

const handleReject = async () => {
  stopBell()
  await rejectCall()
  if (isMobileDevice && window.history.length > 1) {
    router.back()
  }
}

const handleHangup = async () => {
  stopBell()
  if (isMobileDevice) {
    if (router.currentRoute.value.path === '/mobile/rtcCall') {
      if (window.history.length > 1) {
        router.back()
      } else {
        router.replace('/mobile/message')
      }
    } else {
      router.back()
    }
  }
  await voipHangup()
}

// ── 窗口关闭时挂断 ──
const setupCloseListener = async () => {
  if (!hasTauriRuntime()) return
  const currentWindow = WebviewWindow.getCurrent()
  if (!currentWindow) return

  const unlisten = await currentWindow.onCloseRequested(async () => {
    try {
      const s = state.value
      if (s === 'ringing' || s === 'connecting' || s === 'connected') {
        await voipHangup()
        unlisten()
      }
    } catch (error) {
      logger.error('发送挂断消息失败:', error)
    }
  })
}

// ── 隐藏的远程音频元素 ──
const remoteAudioRef = ref<HTMLAudioElement>()

watch(
  [remoteStream, isSpeakerOn],
  () => {
    if (remoteAudioRef.value && remoteStream.value) {
      remoteAudioRef.value.srcObject = remoteStream.value
      remoteAudioRef.value.muted = !isSpeakerOn.value
    }
  },
  { immediate: true }
)

// 同步初始视频状态
watch(
  isVideoEnabled,
  (newVal) => {
    isVideoOn.value = newVal
  },
  { immediate: true }
)

// 生命周期
onMounted(async () => {
  if (isMobileDevice) {
    if (shouldAutoAccept && isReceiver && !isCallAccepted.value) {
      await nextTick()
      await handleAcceptCall()
    }
    return
  }

  await setupCloseListener()

  if (isDesktop()) {
    if (isReceiver && !isCallAccepted.value) {
      const currentWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null
      if (!currentWindow) return
      // 来电通知窗口尺寸
      const size = isWindows()
        ? new LogicalSize(360, 90)
        : new PhysicalSize(360, 90)
      await currentWindow.setSize(size)
      if (isMac()) {
        await invokeSilently('hide_title_bar_buttons', { windowLabel: currentWindow.label, hideCloseButton: true })
      }
      // 定位到屏幕角落
      const monitor = await primaryMonitor()
      if (monitor) {
        const margin = 20
        const taskbarHeight = 40
        let x: number
        let y: number
        if (isWindows()) {
          const screenWidth = monitor.size.width / (monitor.scaleFactor || 1)
          const screenHeight = monitor.size.height / (monitor.scaleFactor || 1)
          x = Math.max(0, screenWidth - 360 - margin)
          y = Math.max(0, screenHeight - 90 - margin - taskbarHeight)
          await currentWindow.setPosition(new LogicalPosition(x, y))
        } else {
          const screenWidth = monitor.size.width
          x = Math.max(0, screenWidth - 360 - margin)
          y = margin
          await currentWindow.setPosition(new PhysicalPosition(x, y))
        }
      } else {
        await currentWindow.setPosition(new LogicalPosition(800, 600))
      }
      await currentWindow.setAlwaysOnTop(true)
    } else {
      // 正常通话窗口设置
      const currentWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null
      if (currentWindow) {
        await currentWindow.center()
        await currentWindow.setAlwaysOnTop(false)
        if (isMac()) {
          await invokeSilently('show_title_bar_buttons', { windowLabel: currentWindow.label })
        }
      }
    }
    // 确保窗口显示
    const currentWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null
    if (currentWindow) {
      await currentWindow.show()
      await currentWindow.setFocus()
    }
  }

  // 发起去电
  if (!isReceiver) {
    const hasPerms = await checkPermissions()
    if (hasPerms.audio) {
      await checkAvailability()
      await startCall(roomId, { audio: true, video: callType === CallTypeEnum.VIDEO })
    } else {
      logger.warn('缺少媒体权限，无法发起通话')
    }
  }
})

defineExpose({
  hangUp: handleHangup
})
</script>
