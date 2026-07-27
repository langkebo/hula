/**
 * Audio/video device switching for an in-progress WebRTC call.
 *
 * Extracts `switchAudioDevice` / `switchVideoDevice` / `switchCameraFacing`
 * (and the front/back camera detection helper) out of `useWebRtc`. The hook
 * mutates the shared `selectedAudioDevice` / `selectedVideoDevice` refs in
 * place so call sites that read them (eg. screen share resume path) keep
 * observing the same source of truth.
 */
import type { Ref } from 'vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('WebRtc:CameraSwitch')

type UseCameraSwitchOptions = {
  localStream: Ref<MediaStream | null>
  peerConnection: Ref<RTCPeerConnection | null>
  selectedAudioDevice: Ref<string | null | undefined>
  selectedVideoDevice: Ref<string | null | undefined>
  videoDevices: Ref<MediaDeviceInfo[]>
  /** Returns truthy when the current call is a video call (so audio swap retains video constraint). */
  isVideoCall: () => boolean
  /** True on mobile platforms — gates `switchCameraFacing`. */
  isMobile: () => boolean
  /** Optional feedback surface; tests can stub it. Falls back to the global message bridge. */
  notify?: {
    error: (msg: string) => void
  }
}

const defaultNotify = () => (window as { $message?: { error: (msg: string) => void } }).$message

const replaceTrack = (pc: RTCPeerConnection | null, kind: 'audio' | 'video', newTrack: MediaStreamTrack) => {
  pc?.getSenders().forEach((sender) => {
    if (sender.track && sender.track.kind === kind) {
      sender.replaceTrack?.(newTrack)
    }
  })
}

export const useCameraSwitch = (options: UseCameraSwitchOptions) => {
  const { localStream, peerConnection, selectedAudioDevice, selectedVideoDevice, videoDevices, isVideoCall, isMobile } =
    options

  const switchAudioDevice = async (deviceId: string) => {
    const notify = options.notify ?? defaultNotify()
    try {
      selectedAudioDevice.value = deviceId
      if (!localStream.value) return

      const newStream = await navigator?.mediaDevices?.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: isVideoCall()
          ? selectedVideoDevice.value
            ? { deviceId: { exact: selectedVideoDevice.value || undefined } }
            : false
          : false
      })

      const newAudioTrack = newStream.getAudioTracks()[0]
      const oldAudioTrack = localStream.value.getAudioTracks()[0]

      if (!newAudioTrack) {
        notify?.error?.('切换设备不存在或不支持，请重新选择！')
        return
      }
      if (!oldAudioTrack) {
        localStream.value.addTrack(newAudioTrack)
        peerConnection.value?.addTrack(newAudioTrack, localStream.value)
        return
      }
      replaceTrack(peerConnection.value, 'audio', newAudioTrack)
      localStream.value.removeTrack(oldAudioTrack)
      localStream.value.addTrack(newAudioTrack)
    } catch (error) {
      notify?.error?.('切换音频设备失败！')
      logger.error('切换音频设备失败:', error)
    }
  }

  const switchVideoDevice = async (deviceId: string) => {
    const notify = options.notify ?? defaultNotify()
    try {
      selectedVideoDevice.value = deviceId
      if (!localStream.value || localStream.value.getVideoTracks().length === 0) return

      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: selectedAudioDevice.value ? { deviceId: { exact: selectedAudioDevice.value || undefined } } : false,
        video: { deviceId: { exact: deviceId } }
      })

      const newVideoTrack = newStream.getVideoTracks()[0]
      const oldVideoTrack = localStream.value.getVideoTracks()[0]

      if (!newVideoTrack) {
        notify?.error?.('切换设备不存在或不支持，请重新选择！')
        return
      }
      if (!oldVideoTrack) {
        localStream.value.addTrack(newVideoTrack)
        peerConnection.value?.addTrack(newVideoTrack, localStream.value)
        return
      }
      replaceTrack(peerConnection.value, 'video', newVideoTrack)
      localStream.value.removeTrack(oldVideoTrack)
      localStream.value.addTrack(newVideoTrack)
    } catch (error) {
      notify?.error?.('切换视频设备失败！')
      logger.error('切换视频设备失败:', error)
    }
  }

  const getFrontAndBackCameras = () => {
    const matchAny = (label: string, needles: string[]) => needles.some((n) => label.toLowerCase().includes(n))

    const frontCamera = videoDevices.value.find((d) => matchAny(d.label, ['front', '前置', 'user']))
    const backCamera = videoDevices.value.find((d) => matchAny(d.label, ['back', '后置', 'environment', 'rear']))
    return { frontCamera, backCamera }
  }

  const switchCameraFacing = async () => {
    if (!isMobile()) {
      logger.warn('摄像头翻转功能仅在移动端可用')
      return
    }
    const notify = options.notify ?? defaultNotify()
    try {
      const { frontCamera, backCamera } = getFrontAndBackCameras()
      if (!frontCamera || !backCamera) {
        await switchVideoDevice('user')
        return
      }
      const targetDevice = selectedVideoDevice.value === frontCamera.deviceId ? backCamera : frontCamera
      await switchVideoDevice(targetDevice.deviceId)
    } catch (error) {
      notify?.error?.('摄像头翻转失败！')
      logger.error('摄像头翻转失败:', error)
    }
  }

  return {
    switchAudioDevice,
    switchVideoDevice,
    switchCameraFacing,
    getFrontAndBackCameras
  }
}
