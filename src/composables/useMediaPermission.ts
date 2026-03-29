import { createSharedComposable, createEventHook } from '@vueuse/core'
import { ref, readonly } from 'vue'

export type MediaPermission = 'granted' | 'denied' | 'default' | 'unsupported'
export type MediaDeviceKind = 'audioinput' | 'audiooutput' | 'videoinput'

export interface MediaDevice {
  deviceId: string
  label: string
  kind: MediaDeviceKind
}

const useSharedMediaPermission = createSharedComposable(() => {
  const permission = ref<MediaPermission>('default')
  const isSupported = ref(false)
  const devices = ref<MediaDevice[]>([])
  const audioInputDevices = ref<MediaDevice[]>([])
  const audioOutputDevices = ref<MediaDevice[]>([])
  const videoInputDevices = ref<MediaDevice[]>([])

  const onPermissionChange = createEventHook<void>()

  async function checkPermission(): Promise<MediaPermission> {
    if (!navigator.mediaDevices || !('getUserMedia' in navigator.mediaDevices)) {
      isSupported.value = false
      permission.value = 'unsupported'
      return 'unsupported'
    }

    isSupported.value = true

    try {
      const result = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      result.getTracks().forEach((track) => track.stop())
      permission.value = 'granted'
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        permission.value = 'denied'
      } else if (err.name === 'NotFoundError') {
        permission.value = 'denied'
      } else {
        permission.value = 'default'
      }
    }

    return permission.value
  }

  async function requestPermission(mediaType: 'audio' | 'video' | 'both' = 'both'): Promise<MediaPermission> {
    if (!navigator.mediaDevices) {
      permission.value = 'unsupported'
      return 'unsupported'
    }

    try {
      const constraints: MediaStreamConstraints =
        mediaType === 'audio'
          ? { audio: true }
          : mediaType === 'video'
            ? { video: true }
            : { audio: true, video: true }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      stream.getTracks().forEach((track) => track.stop())
      permission.value = 'granted'
      return 'granted'
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        permission.value = 'denied'
      } else {
        permission.value = 'default'
      }
      return permission.value
    }
  }

  async function enumerateDevices(): Promise<MediaDevice[]> {
    if (!navigator.mediaDevices || !('enumerateDevices' in navigator.mediaDevices)) {
      return []
    }

    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices()
      const mediaDevices: MediaDevice[] = allDevices
        .filter((device) => device.kind === 'audioinput' || device.kind === 'audiooutput' || device.kind === 'videoinput')
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `${device.kind} (${device.deviceId.slice(0, 8)})`,
          kind: device.kind as MediaDeviceKind
        }))

      devices.value = mediaDevices
      audioInputDevices.value = mediaDevices.filter((d) => d.kind === 'audioinput')
      audioOutputDevices.value = mediaDevices.filter((d) => d.kind === 'audiooutput')
      videoInputDevices.value = mediaDevices.filter((d) => d.kind === 'videoinput')

      return mediaDevices
    } catch (err) {
      console.warn('[MediaPermission] 获取设备列表失败:', err)
      return []
    }
  }

  async function initialize() {
    await checkPermission()
    await enumerateDevices()

    if (navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    }
  }

  function handleDeviceChange() {
    enumerateDevices()
    onPermissionChange.trigger()
  }

  function cleanup() {
    if (navigator.mediaDevices) {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    }
  }

  initialize()

  return {
    permission: readonly(permission),
    isSupported: readonly(isSupported),
    devices: readonly(devices),
    audioInputDevices: readonly(audioInputDevices),
    audioOutputDevices: readonly(audioOutputDevices),
    videoInputDevices: readonly(videoInputDevices),
    onPermissionChange: onPermissionChange.on,
    checkPermission,
    requestPermission,
    enumerateDevices,
    cleanup
  }
})

export function useMediaPermission() {
  return useSharedMediaPermission()
}

export default useMediaPermission
