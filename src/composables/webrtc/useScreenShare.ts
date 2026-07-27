/**
 * Desktop screen-share state for an in-progress WebRTC call.
 *
 * Self-contained `isScreenSharing` flag + start/stop pair extracted from
 * `useWebRtc`. Shared call-state refs and lifecycle callbacks are injected
 * via `UseScreenShareOptions` so the hook stays composable and unit-testable
 * without spinning up a full RTCPeerConnection.
 */
import { type Ref, ref } from 'vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('WebRtc:ScreenShare')

type UseScreenShareOptions = {
  localStream: Ref<MediaStream | null>
  peerConnection: Ref<RTCPeerConnection | null>
  selectedVideoDevice: Ref<string | null | undefined>
  /** Returns the current call type (audio/video) so we can resume the right stream after stopping share. */
  getCurrentCallType: () => number | undefined
  getLocalStream: (callType: number) => Promise<unknown> | unknown
  switchVideoDevice: (deviceId: string) => Promise<unknown> | unknown
  /** Optional feedback surface; tests can stub it. Falls back to the global message bridge. */
  notify?: {
    warning: (msg: string) => void
    error: (msg: string) => void
  }
}

const defaultNotify = () =>
  (window as { $message?: { warning: (msg: string) => void; error: (msg: string) => void } }).$message

export const useScreenShare = (options: UseScreenShareOptions) => {
  const isScreenSharing = ref(false)

  const stopScreenShare = (): boolean => {
    if (!isScreenSharing.value) return false
    isScreenSharing.value = false

    if (options.localStream.value) {
      options.localStream.value.getTracks().forEach((track) => track.stop())
    }

    const callType = options.getCurrentCallType()
    if (!options.selectedVideoDevice.value || callType === undefined) {
      return false
    }
    options.getLocalStream(callType)
    if (options.selectedVideoDevice.value) {
      options.switchVideoDevice(options.selectedVideoDevice.value)
    }
    return true
  }

  const startScreenShare = async () => {
    const notify = options.notify ?? defaultNotify()
    try {
      if (!navigator?.mediaDevices?.getDisplayMedia) {
        notify?.warning?.('当前设备不支持桌面共享功能！')
        return
      }
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      })
      if (!screenStream) return

      if (options.localStream.value) {
        options.localStream.value.getTracks().forEach((track) => track.stop())
      }

      options.localStream.value = screenStream
      screenStream.getTracks().forEach((track) => {
        if (options.localStream.value) {
          options.peerConnection.value?.addTrack(track, options.localStream.value)
        }
      })

      const newVideoTrack = screenStream.getVideoTracks()[0]
      const oldVideoTrack = options.localStream.value.getVideoTracks()[0]
      if (!newVideoTrack) {
        notify?.error?.('桌面共享失败，请检查权限设置!')
        return
      }
      newVideoTrack.onended = () => {
        notify?.warning?.('屏幕共享已结束 ~')
        stopScreenShare()
      }
      options.peerConnection.value?.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === 'video') {
          sender.replaceTrack(newVideoTrack)
        }
      })
      oldVideoTrack && options.localStream.value.removeTrack(oldVideoTrack)
      options.localStream.value.addTrack(newVideoTrack)
      isScreenSharing.value = true
    } catch (err: unknown) {
      const error = err as Error & { name?: string }
      logger.error('开始桌面共享失败:', error)
      isScreenSharing.value = false
      stopScreenShare()
      if (error?.name === 'NotAllowedError') {
        notify?.warning?.('已取消屏幕共享...')
        return
      }
      notify?.error?.('桌面共享失败，请检查权限设置!')
    }
  }

  return {
    isScreenSharing,
    startScreenShare,
    stopScreenShare
  }
}
