import { ref } from 'vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useMediaDevices')

/**
 * 媒体设备枚举状态封装：音/视频输入设备清单 + 当前选中项 + 加载态。
 *
 * `refresh()` 会先请求一次 getUserMedia 以拿到完整的 device label
 * （Safari / Chrome 的权限前置行为），再 enumerateDevices，最后
 * 默认选中 `default` 或第一个设备。权限被拒绝时降级为仅枚举。
 *
 * 从 useWebRtc 抽出。仅依赖 navigator.mediaDevices，可在 jsdom 下
 * 通过 stub 单测。
 */
export const useMediaDevices = () => {
  const audioDevices = ref<MediaDeviceInfo[]>([])
  const videoDevices = ref<MediaDeviceInfo[]>([])
  const selectedAudioDevice = ref<string | null | undefined>(null)
  const selectedVideoDevice = ref<string | null | undefined>(null)
  const isDeviceLoad = ref(false)

  const refresh = async (): Promise<boolean> => {
    try {
      logger.info('start getDevices')
      isDeviceLoad.value = true

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        stream.getTracks().forEach((track) => track.stop())
      } catch {
        logger.error('Permission denied, will get limited device info')
      }

      const devices = (await navigator.mediaDevices.enumerateDevices()) || []
      logger.info(`getDevices, devices: ${JSON.stringify(devices)}`)
      if (devices.length === 0) {
        isDeviceLoad.value = false
        return false
      }

      audioDevices.value = devices.filter((d) => d.kind === 'audioinput')
      videoDevices.value = devices.filter((d) => d.kind === 'videoinput')

      selectedAudioDevice.value =
        audioDevices.value.find((d) => d.deviceId === 'default')?.deviceId || audioDevices.value[0]?.deviceId
      selectedVideoDevice.value =
        videoDevices.value.find((d) => d.deviceId === 'default')?.deviceId || videoDevices.value[0]?.deviceId

      isDeviceLoad.value = false
      return true
    } catch (err) {
      logger.error(`获取设备失败: ${err}`)
      selectedAudioDevice.value = selectedAudioDevice.value || null
      selectedVideoDevice.value = selectedVideoDevice.value || null
      isDeviceLoad.value = false
      return false
    }
  }

  const reset = () => {
    audioDevices.value = []
    videoDevices.value = []
    selectedAudioDevice.value = null
    selectedVideoDevice.value = null
  }

  return {
    audioDevices,
    videoDevices,
    selectedAudioDevice,
    selectedVideoDevice,
    isDeviceLoad,
    getDevices: refresh,
    resetDevices: reset
  }
}
