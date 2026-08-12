/**
 * useWebRtc — main WebRTC composable.
 *
 * Orchestrates call lifecycle: media acquisition, peer connection, signaling,
 * and event listening. Heavy logic is delegated to:
 *  - useRtcPeerConnection: RTCPeerConnection creation + resource cleanup
 *  - useRtcSignaling: SDP/ICE offer/answer/candidate exchange + signal dispatch
 *  - useRtcEventListeners: Tauri ws-* event registration
 */

import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { CallTypeEnum, RTCCallStatus } from '@/enums'
import { useI18nGlobal } from '@/services/i18n'
import { useUserStore } from '@/stores/domains/user/user'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { isMobile } from '@/utils/PlatformConstants'
import { TimerManager } from '@/utils/TimerManager'
import { useMitt } from '../common/useMitt'
import { useTauriListener } from '../common/useTauriListener'
import { loadIceServers } from './iceServers'
import { MAX_TIME_OUT_SECONDS, type RtcState } from './rtcContext'
import type { RtcMsgVO } from './types'
import { useCallBell } from './useCallBell'
import { useCallTimer } from './useCallTimer'
import { useCameraSwitch } from './useCameraSwitch'
import { useMediaDevices } from './useMediaDevices'
import { useRtcEventListeners } from './useRtcEventListeners'
import { useRtcPeerConnection } from './useRtcPeerConnection'
import { useRtcSignaling } from './useRtcSignaling'
import { useScreenShare } from './useScreenShare'

const logger = createLogger('WebRtc')
const rtcCallBellUrl = '/sound/tjg_bell.mp3'

export const useWebRtc = (roomId: string, remoteUserId: string, callType: CallTypeEnum, isReceiver: boolean) => {
  const { addListener } = useTauriListener()
  const router = useRouter()
  const { t } = useI18nGlobal()
  const { showFeedback } = useActionFeedback()

  logger.info(
    `useWebRtc, roomId: ${roomId}, remoteUserId: ${remoteUserId}, callType: ${callType}, isReceiver: ${isReceiver}`
  )

  const userStore = useUserStore()
  const { audioDevices, videoDevices, selectedAudioDevice, selectedVideoDevice, getDevices, resetDevices } =
    useMediaDevices()

  const rtcMsg = ref<Partial<RtcMsgVO>>({ roomId: undefined, callType: undefined, callerId: undefined })
  const connectionStatus = ref<RTCCallStatus | undefined>(undefined)
  const isLinker = ref(false)
  const rtcStatus = ref<RTCPeerConnectionState | undefined>(undefined)
  const localStream = ref<MediaStream | null>(null)
  const remoteStream = ref<MediaStream | null>(null)
  const peerConnection = ref<RTCPeerConnection | null>(null)
  const channel = ref<RTCDataChannel | null>(null)
  const channelStatus = ref<RTCDataChannelState | undefined>(undefined)
  const pendingCandidates = ref<RTCIceCandidate[]>([])
  const offer = ref<RTCSessionDescriptionInit>()
  const isVideoEnabled = ref(callType === CallTypeEnum.VIDEO)
  const isScreenSharing = ref(false)
  const timerManager = new TimerManager()
  const callTimer = ref<number | null>(null)

  const { startBell, stopBell, pauseBell, playBell } = useCallBell(rtcCallBellUrl)
  const { callDuration, startCallTimer, stopCallTimer } = useCallTimer()

  // ===== 共享状态打包 =====
  const rtcState: RtcState = {
    roomId,
    remoteUserId,
    callType,
    isReceiver,
    localStream,
    remoteStream,
    peerConnection,
    channel,
    channelStatus,
    pendingCandidates,
    connectionStatus,
    rtcStatus,
    rtcMsg,
    isLinker,
    offer,
    isVideoEnabled,
    isScreenSharing,
    timerManager,
    callTimer,
    userStore,
    t,
    showFeedback,
    startBell,
    stopBell,
    startCallTimer,
    stopCallTimer,
    audioDevices,
    videoDevices,
    selectedAudioDevice,
    selectedVideoDevice,
    getDevices,
    resetDevices
  }

  // ===== 通话控制 =====
  const endCall = async () => {
    try {
      logger.info('[收到通知] 结束通话')
      if (!isMobile() && hasTauriRuntime()) {
        await getCurrentWebviewWindow().close()
      } else {
        router.back()
      }
    } finally {
      clear()
    }
  }

  const handleCallResponse = async (status: number) => {
    try {
      logger.info('[收到通知] 接听电话响应事件')
      sendRtcCall2VideoCallResponse(status)
      await endCall()
    } finally {
      clear()
    }
  }

  const getLocalStream = async (type: CallTypeEnum) => {
    try {
      logger.info('获取本地媒体流')
      const constraints = {
        audio: audioDevices.value.length > 0 ? { deviceId: selectedAudioDevice.value || undefined } : false,
        video:
          type === CallTypeEnum.VIDEO && videoDevices.value.length > 0
            ? { deviceId: selectedVideoDevice.value || undefined }
            : false
      }
      if (!constraints.audio && !constraints.video) {
        showFeedback(t('hooks.webrtc.no_device'), 'error')
        timerManager.setTimeout(async () => {
          await handleCallResponse(isReceiver ? 0 : 2)
        }, 1000)
        return false
      }
      localStream.value = await navigator.mediaDevices.getUserMedia(constraints)
      logger.info(`get localStream success`)
      localStream.value?.getTracks()?.forEach((track, index) => {
        logger.info(`Track ${index}: kind=${track.kind}, label=${track.label}, enabled=${track.enabled}`)
      })
      const audioTrack = localStream.value.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = true
      }
      return true
    } catch (err) {
      logger.error('获取本地流失败:', err)
      showFeedback(t('hooks.webrtc.get_stream_failed'), 'error')
      await sendRtcCall2VideoCallResponse(2)
      return false
    }
  }

  const startCall = async (roomId: string, type: CallTypeEnum, uidList?: string[]) => {
    try {
      if (!roomId) return false
      clear()
      if (!(await getDevices())) {
        showFeedback(t('hooks.webrtc.get_devices_failed'), 'error')
        timerManager.setTimeout(async () => {
          await handleCallResponse(0)
        }, 1000)
        return
      }
      rtcMsg.value = { roomId, callType: type, callerId: userStore.userInfo?.uid ?? '', uidList: uidList || [] }
      isLinker.value = true
      callTimer.value = timerManager.setTimeout(() => {
        if (connectionStatus.value === RTCCallStatus.CALLING) {
          showFeedback(t('hooks.webrtc.call_timeout'), 'warning')
          endCall()
        }
      }, MAX_TIME_OUT_SECONDS * 1000)

      if (!(await getLocalStream(type))) {
        clear()
        timerManager.setTimeout(async () => {
          await endCall()
        }, 1000)
        return false
      }

      createPeerConnection(roomId)
      const rtcOffer = await peerConnection.value!.createOffer()
      offer.value = rtcOffer
      await peerConnection.value!.setLocalDescription(rtcOffer)
      await sendCall()
      startBell()
      connectionStatus.value = RTCCallStatus.CALLING
      rtcStatus.value = 'new'
    } catch (err) {
      logger.error('开始通话失败:', err)
      showFeedback(t('hooks.webrtc.rtc_connection_failed'), 'error')
      clear()
      return false
    }
  }

  const toggleMute = () => {
    if (localStream.value) {
      const audioTrack = localStream.value.getAudioTracks()[0]
      if (audioTrack) audioTrack.enabled = !audioTrack.enabled
    }
  }

  const toggleVideo = async () => {
    if (!localStream.value) return
    const videoTrack = localStream.value.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      isVideoEnabled.value = videoTrack.enabled
    } else if (callType === CallTypeEnum.VIDEO) {
      try {
        const constraints = {
          audio: false,
          video: videoDevices.value.length > 0 ? { deviceId: selectedVideoDevice.value || undefined } : true
        }
        const newStream = await navigator.mediaDevices.getUserMedia(constraints)
        const newVideoTrack = newStream.getVideoTracks()[0]
        if (newVideoTrack && peerConnection.value) {
          peerConnection.value.addTrack(newVideoTrack, localStream.value!)
          localStream.value!.addTrack(newVideoTrack)
          isVideoEnabled.value = true
        }
      } catch (error) {
        logger.error('重新获取视频轨道失败:', error)
        showFeedback(t('hooks.webrtc.camera_failed'), 'error')
      }
    }
  }

  // ===== 子 composable 组合 =====
  const { createPeerConnection, clear, setEndCall } = useRtcPeerConnection(rtcState)
  setEndCall(endCall)

  const { sendCall, sendRtcCall2VideoCallResponse, sendOffer, handleSignalMessage } = useRtcSignaling(rtcState, {
    createPeerConnection,
    getLocalStream,
    endCall,
    handleCallResponse
  })

  const { switchAudioDevice, switchVideoDevice, switchCameraFacing } = useCameraSwitch({
    localStream,
    peerConnection,
    selectedAudioDevice,
    selectedVideoDevice,
    videoDevices,
    isVideoCall: () => rtcMsg.value.callType === CallTypeEnum.VIDEO,
    isMobile,
    notify: { error: (msg: string) => showFeedback(msg, 'error') }
  })

  const { startScreenShare, stopScreenShare } = useScreenShare({
    localStream,
    peerConnection,
    selectedVideoDevice,
    getCurrentCallType: () => rtcMsg.value.callType,
    getLocalStream,
    switchVideoDevice,
    notify: {
      warning: (msg: string) => showFeedback(msg, 'warning'),
      error: (msg: string) => showFeedback(msg, 'error')
    }
  })

  useRtcEventListeners(roomId, isReceiver, { handleSignalMessage, sendOffer, endCall }, offer, addListener)

  onMounted(async () => {
    await loadIceServers()
    if (!isReceiver) {
      logger.debug(`调用方发送${callType === CallTypeEnum.VIDEO ? '视频' : '语音'}通话请求`)
      await startCall(roomId, callType, [remoteUserId])
    }
  })

  onUnmounted(() => {
    useMitt.off('WEBRTC_SIGNAL', handleSignalMessage)
  })

  return {
    startCallTimer,
    stopScreenShare,
    startScreenShare,
    toggleVideo,
    switchVideoDevice,
    switchCameraFacing,
    switchAudioDevice,
    isScreenSharing,
    selectedVideoDevice,
    selectedAudioDevice,
    localStream,
    remoteStream,
    peerConnection,
    getLocalStream,
    startCall,
    handleCallResponse,
    callDuration,
    connectionStatus,
    toggleMute,
    sendRtcCall2VideoCallResponse,
    isVideoEnabled,
    stopBell,
    startBell,
    pauseBell,
    playBell
  }
}
