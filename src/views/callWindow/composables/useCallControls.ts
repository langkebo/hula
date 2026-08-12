import type { Ref } from 'vue'
import { RTCCallStatus } from '@/enums'
import router from '@/router'
import { CallResponseStatus } from '@/services/legacy/wsType'
import { createLogger } from '@/utils/Logger'

interface UseCallControlsParams {
  isMuted: Ref<boolean>
  isSpeakerOn: Ref<boolean>
  isVideoOn: Ref<boolean>
  isVideoEnabled: Ref<boolean>
  isCallAccepted: Ref<boolean>
  connectionStatus: Ref<RTCCallStatus | undefined>
  isMobileDevice: boolean
  toggleMuteWebRtc: () => void
  toggleVideoWebRtc: () => Promise<void>
  pauseBell: () => void
  playBell: () => void
  stopBell: () => void
  sendRtcCall2VideoCallResponse: (status: number) => Promise<void>
  handleCallResponse: (status: number) => Promise<void>
}

export const useCallControls = (params: UseCallControlsParams) => {
  const logger = createLogger('CallControls')

  const toggleMute = () => {
    params.isMuted.value = !params.isMuted.value
    params.toggleMuteWebRtc()
  }

  const toggleSpeaker = () => {
    params.isSpeakerOn.value = !params.isSpeakerOn.value
    logger.debug('切换扬声器状态:', params.isSpeakerOn.value)
    if (params.connectionStatus.value === RTCCallStatus.CALLING && !params.isSpeakerOn.value) {
      params.pauseBell()
    } else if (params.connectionStatus.value === RTCCallStatus.CALLING && params.isSpeakerOn.value) {
      params.playBell()
    }
  }

  const toggleVideo = async () => {
    try {
      await params.toggleVideoWebRtc()
      params.isVideoOn.value = params.isVideoEnabled.value
    } catch (error) {
      logger.error('切换视频失败:', error)
    }
  }

  const hangUp = (status: CallResponseStatus = CallResponseStatus.DROPPED) => {
    params.stopBell()
    if (params.isMobileDevice) {
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
    params.handleCallResponse(status)
  }

  const acceptCall = async () => {
    params.stopBell()
    params.isCallAccepted.value = true
    params.sendRtcCall2VideoCallResponse(1)
  }

  return { toggleMute, toggleSpeaker, toggleVideo, hangUp, acceptCall }
}
