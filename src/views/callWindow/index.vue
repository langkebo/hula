<template>
  <!-- 通知样式窗口 (接收方且未接听) -->
  <CallIncomingBanner
    v-if="isReceiver && !isCallAccepted"
    :avatar-src="avatarSrc"
    :call-type="callType"
    :remote-user-name="remoteUserInfo?.name || ''"
    @accept="handleAcceptCall"
    @reject="hangUp(CallResponseStatus.REJECTED)" />

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
        @switch-camera="switchCameraFacing"
        @toggle-video="toggleVideo"
        @hangup="hangUp()" />

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
      @toggle-video="toggleVideo"
      @hangup="hangUp()" />
  </div>

  <audio ref="remoteAudioRef" autoplay playsinline style="display: none"></audio>
</template>

<script setup lang="ts">
import { LogicalPosition, LogicalSize, PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { primaryMonitor } from '@tauri-apps/api/window'

import { nextTick, onMounted, ref, watch } from 'vue'
import { useWebRtc } from '@/composables/webrtc/useWebRtc'
import { CallTypeEnum, RTCCallStatus } from '@/enums'
import router from '@/router'
import { CallResponseStatus } from '@/services/legacy/wsType'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { isDesktop, isMac, isWindows } from '@/utils/PlatformConstants'
import { invokeSilently } from '@/utils/TauriInvokeHandler'
import { CallAvatarStage, CallControlsBar, CallIncomingBanner, CallVideoStage } from './components'
import { useCallControls } from './composables/useCallControls'
import { parseCallRoute, useCallState } from './composables/useCallState'

const logger = createLogger('CallWindow')

// 1. 解析路由
const routeInfo = parseCallRoute()
const { remoteUserId, roomId, callType, isReceiver, shouldAutoAccept, isMobileDevice } = routeInfo

if ((!roomId || !remoteUserId) && isMobileDevice) {
  router.replace('/mobile/message')
}

// 2. WebRTC
const {
  localStream,
  remoteStream,
  handleCallResponse,
  callDuration,
  connectionStatus,
  sendRtcCall2VideoCallResponse,
  toggleMute: toggleMuteWebRtc,
  toggleVideo: toggleVideoWebRtc,
  switchCameraFacing,
  isVideoEnabled,
  pauseBell,
  playBell,
  stopBell,
  startBell
} = useWebRtc(roomId, remoteUserId, callType, isReceiver)

// 3. 通话状态
const {
  remoteUserInfo,
  avatarSrc,
  isCallAccepted,
  isMuted,
  isSpeakerOn,
  isVideoOn,
  currentWindowLabel,
  actionBarRef,
  callStatusText,
  formattedCallDuration,
  hasRemoteVideo,
  pipVideoSizeClass,
  shouldCenterPreparingAvatar
} = useCallState({ ...routeInfo, localStream, remoteStream, isVideoEnabled, callDuration, connectionStatus })

// 4. 通话控制
const { toggleMute, toggleSpeaker, toggleVideo, hangUp, acceptCall } = useCallControls({
  isMuted,
  isSpeakerOn,
  isVideoOn,
  isVideoEnabled,
  isCallAccepted,
  connectionStatus,
  isMobileDevice,
  toggleMuteWebRtc,
  toggleVideoWebRtc,
  pauseBell,
  playBell,
  stopBell,
  sendRtcCall2VideoCallResponse,
  handleCallResponse
})

// 隐藏的远程音频元素
const remoteAudioRef = ref<HTMLAudioElement>()

// 窗口尺寸工具
const createSize = (width: number, height: number) => {
  return isWindows() ? new LogicalSize(width, height) : new PhysicalSize(width, height)
}

// 接听通话（含窗口管理）
const handleAcceptCall = async () => {
  await acceptCall()
  try {
    const currentWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null
    if (!currentWindow) return
    const isVideo = callType === CallTypeEnum.VIDEO
    await currentWindow.setSize(createSize(isVideo ? 850 : 500, isVideo ? 580 : 650))
    await currentWindow.center()
    await currentWindow.setAlwaysOnTop(false)
    if (isMac()) {
      await invokeSilently('show_title_bar_buttons', { windowLabel: currentWindow.label })
    }
    try {
      await currentWindow.setFocus()
    } catch (error) {
      logger.warn('Failed to set window focus after accepting call:', error)
    }
  } catch (error) {
    logger.error('Failed to resize window after accepting call:', error)
  }
}

// 监听远程流变化，自动设置音频
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
    if (isReceiver && !isCallAccepted.value && !shouldAutoAccept) {
      startBell()
    }
    if (shouldAutoAccept && isReceiver && !isCallAccepted.value) {
      await nextTick()
      await handleAcceptCall()
    }
    return
  }

  const currentWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null
  if (!currentWindow) return

  // 监听窗口关闭事件，确保关闭窗口时挂断通话
  const unlistenCloseRequested = await currentWindow.onCloseRequested(async (_event) => {
    try {
      if (connectionStatus.value === RTCCallStatus.CALLING || connectionStatus.value === RTCCallStatus.ACCEPT) {
        await sendRtcCall2VideoCallResponse(CallResponseStatus.DROPPED)
        unlistenCloseRequested()
      }
    } catch (error) {
      logger.error('发送挂断消息失败:', error)
    }
  })

  if (isDesktop()) {
    if (isReceiver && !isCallAccepted.value) {
      // 接收方立即开始播放铃声
      startBell()
      // 设置来电通知窗口的正确大小和位置
      await currentWindow.setSize(createSize(360, 90))
      // 隐藏标题栏和设置窗口不可移动
      if (isMac()) {
        await invokeSilently('hide_title_bar_buttons', { windowLabel: currentWindow.label, hideCloseButton: true })
      }
      // 获取屏幕尺寸并定位
      const monitor = await primaryMonitor()
      if (monitor) {
        const margin = 20
        const taskbarHeight = 40
        let x: number
        let y: number

        if (isWindows()) {
          // Windows使用逻辑像素进行计算，窗口在右下角
          const screenWidth = monitor.size.width / (monitor.scaleFactor || 1)
          const screenHeight = monitor.size.height / (monitor.scaleFactor || 1)
          x = Math.max(0, screenWidth - 360 - margin)
          y = Math.max(0, screenHeight - 90 - margin - taskbarHeight)
          await currentWindow.setPosition(new LogicalPosition(x, y))
        } else {
          // Mac使用物理像素进行计算，窗口在右上角
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
      await currentWindow.center()
      await currentWindow.setAlwaysOnTop(false)
      if (isMac()) {
        await invokeSilently('show_title_bar_buttons', { windowLabel: currentWindow.label })
      }
    }
    // 确保窗口显示
    await currentWindow.show()
    await currentWindow.setFocus()
  }
})

defineExpose({
  hangUp
})
</script>
