import type { Ref } from 'vue'
import { computed, nextTick, ref } from 'vue'
import { createLogger } from '@/utils/Logger'

interface UseCallMediaParams {
  localStream: Ref<MediaStream | null>
  remoteStream: Ref<MediaStream | null>
  isVideoEnabled: Ref<boolean>
  isSpeakerOn: Ref<boolean>
  mainVideoRef: Ref<HTMLVideoElement | undefined>
  pipVideoRef: Ref<HTMLVideoElement | undefined>
}

export const useCallMedia = (params: UseCallMediaParams) => {
  const logger = createLogger('CallMedia')

  const isLocalVideoMain = ref(true)

  const hasLocalVideo = computed(() => params.isVideoEnabled.value && !!params.localStream.value)

  const hasRemoteVideo = computed(() => {
    if (!params.remoteStream.value) return false
    const videoTracks = params.remoteStream.value.getVideoTracks()
    return videoTracks.length > 0 && videoTracks.some((track) => track.enabled)
  })

  const clearVideoElements = () => {
    if (params.mainVideoRef.value) params.mainVideoRef.value.srcObject = null
    if (params.pipVideoRef.value) params.pipVideoRef.value.srcObject = null
  }

  const updateRemoteVideoAudio = () => {
    const shouldMute = !params.isSpeakerOn.value
    logger.info(`updateRemoteVideoAudio, shouldMute: ${shouldMute}`)
    if (params.mainVideoRef.value && params.mainVideoRef.value.srcObject === params.remoteStream.value) {
      params.mainVideoRef.value.muted = shouldMute
    }
    if (params.pipVideoRef.value && params.pipVideoRef.value.srcObject === params.remoteStream.value) {
      params.pipVideoRef.value.muted = shouldMute
    }
  }

  const setVideoElement = (
    videoElement: HTMLVideoElement | undefined,
    stream: MediaStream | null,
    isMuted: boolean = false
  ) => {
    if (!videoElement) return
    videoElement.srcObject = stream
    videoElement.muted = isMuted
    if (stream) {
      nextTick(() => updateRemoteVideoAudio())
    }
  }

  const assignDualVideoStreams = () => {
    if (isLocalVideoMain.value) {
      setVideoElement(params.mainVideoRef.value, params.localStream.value, true)
      setVideoElement(params.pipVideoRef.value, params.remoteStream.value)
    } else {
      setVideoElement(params.mainVideoRef.value, params.remoteStream.value)
      setVideoElement(params.pipVideoRef.value, params.localStream.value, true)
    }
  }

  const assignSingleVideoStream = (stream: MediaStream | null, isMuted: boolean) => {
    setVideoElement(params.mainVideoRef.value, stream, isMuted)
    setVideoElement(params.pipVideoRef.value, null, isMuted)
  }

  const assignVideoStreams = async () => {
    await nextTick()
    if (!hasLocalVideo.value && !hasRemoteVideo.value) {
      clearVideoElements()
      return
    }
    if (hasLocalVideo.value && hasRemoteVideo.value) {
      assignDualVideoStreams()
    } else if (hasLocalVideo.value) {
      assignSingleVideoStream(params.localStream.value, true)
    } else if (hasRemoteVideo.value) {
      assignSingleVideoStream(params.remoteStream.value, false)
    }
  }

  const toggleVideoLayout = async () => {
    isLocalVideoMain.value = !isLocalVideoMain.value
    await assignVideoStreams()
  }

  return {
    isLocalVideoMain,
    hasLocalVideo,
    hasRemoteVideo,
    assignVideoStreams,
    toggleVideoLayout,
    updateRemoteVideoAudio
  }
}
