import { computed, onMounted, onUnmounted, type Ref, ref } from 'vue'
import { loadMediaDevicePreferences, saveMediaDevicePreferences } from '@/services/media/mediaDevicePreferences'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MediaDeviceSettings')

/** 音视频设置页的提示文案回调：桌面走 Naive UI message，移动端走 Vant toast。 */
export interface MediaDeviceSettingsFeedback {
  devicesFailed: () => void
  microphoneTestStarted: () => void
  microphoneTestFailed: () => void
  previewStarted: () => void
  previewFailed: () => void
}

export interface MediaDeviceSettingsOptions {
  /** 设备无 label 时的兜底名称（两端文案不同）。 */
  audioFallbackLabel: (deviceId: string) => string
  videoFallbackLabel: (deviceId: string) => string
  /** 未选择设备时的占位文案（移动端展示用）。 */
  emptyDeviceLabel: string
  /** 预览用的 <video> 元素引用，由各端组件绑定（模板 ref 属于 UI 层）。 */
  videoPreviewRef: Ref<HTMLVideoElement | undefined>
  feedback: MediaDeviceSettingsFeedback
}

/**
 * 音视频设备设置共享逻辑（桌面 / 移动共用）。
 *
 * 设备枚举、音质偏好读写、麦克风测试与摄像头预览全部收敛在这里；
 * 两端只保留 UI 组件（Naive UI / Vant）与提示文案差异。
 */
export function useMediaDeviceSettings(options: MediaDeviceSettingsOptions) {
  const devicesLoading = ref(false)
  const isRecording = ref(false)
  const isPreviewing = ref(false)
  const audioLevel = ref(0)

  const audioInputId = ref<string | null>(null)
  const videoInputId = ref<string | null>(null)
  const echoCancellation = ref(true)
  const noiseSuppression = ref(true)
  const autoGainControl = ref(true)

  const audioInputDevices = ref<MediaDeviceInfo[]>([])
  const videoInputDevices = ref<MediaDeviceInfo[]>([])

  let mediaStream: MediaStream | null = null
  let audioContext: AudioContext | null = null
  let analyser: AnalyserNode | null = null
  let animationFrame: number | null = null

  const audioInputOptions = computed(() =>
    audioInputDevices.value.map((device) => ({
      label: device.label || options.audioFallbackLabel(device.deviceId),
      value: device.deviceId
    }))
  )

  const videoInputOptions = computed(() =>
    videoInputDevices.value.map((device) => ({
      label: device.label || options.videoFallbackLabel(device.deviceId),
      value: device.deviceId
    }))
  )

  const audioInputName = computed(
    () =>
      audioInputDevices.value.find((device) => device.deviceId === audioInputId.value)?.label ||
      options.emptyDeviceLabel
  )

  const videoInputName = computed(
    () =>
      videoInputDevices.value.find((device) => device.deviceId === videoInputId.value)?.label ||
      options.emptyDeviceLabel
  )

  onMounted(async () => {
    await loadDevices()
    loadSavedSettings()
  })

  onUnmounted(() => {
    stopPreview()
    stopAudioTest()
  })

  async function loadDevices() {
    devicesLoading.value = true
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()

      audioInputDevices.value = devices.filter((device) => device.kind === 'audioinput')
      videoInputDevices.value = devices.filter((device) => device.kind === 'videoinput')

      if (audioInputOptions.value.length > 0 && !audioInputId.value) {
        audioInputId.value = audioInputOptions.value[0].value
      }
      if (videoInputOptions.value.length > 0 && !videoInputId.value) {
        videoInputId.value = videoInputOptions.value[0].value
      }
    } catch (error) {
      logger.error('Failed to load media devices', error)
      options.feedback.devicesFailed()
    } finally {
      devicesLoading.value = false
    }
  }

  function loadSavedSettings() {
    const preferences = loadMediaDevicePreferences()

    // 设备 id 为 null 表示"没保存过"，此时保留 loadDevices() 选出的默认设备，不要清空。
    if (preferences.audioInputId) audioInputId.value = preferences.audioInputId
    if (preferences.videoInputId) videoInputId.value = preferences.videoInputId

    echoCancellation.value = preferences.echoCancellation
    noiseSuppression.value = preferences.noiseSuppression
    autoGainControl.value = preferences.autoGain
  }

  function selectAudioInput(value: string | null) {
    audioInputId.value = value
    saveMediaDevicePreferences({ audioInputId: value })
  }

  function selectVideoInput(value: string | null) {
    videoInputId.value = value
    saveMediaDevicePreferences({ videoInputId: value })
    if (isPreviewing.value) {
      stopPreview()
      startPreview()
    }
  }

  function handleEchoCancellationChange(value: boolean) {
    saveMediaDevicePreferences({ echoCancellation: value })
  }

  function handleNoiseSuppressionChange(value: boolean) {
    saveMediaDevicePreferences({ noiseSuppression: value })
  }

  function handleAutoGainChange(value: boolean) {
    saveMediaDevicePreferences({ autoGain: value })
  }

  async function handleTestAudio() {
    if (isRecording.value) {
      stopAudioTest()
    } else {
      await startAudioTest()
    }
  }

  async function startAudioTest() {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          ...(audioInputId.value ? { deviceId: { exact: audioInputId.value } } : {}),
          echoCancellation: echoCancellation.value,
          noiseSuppression: noiseSuppression.value,
          autoGainControl: autoGainControl.value
        }
      }

      mediaStream = await navigator.mediaDevices.getUserMedia(constraints)

      audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(mediaStream)
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)

      isRecording.value = true
      updateAudioLevel()
      options.feedback.microphoneTestStarted()
    } catch (error) {
      logger.warn('Failed to start microphone test', error)
      options.feedback.microphoneTestFailed()
    }
  }

  function stopAudioTest() {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame)
      animationFrame = null
    }

    if (audioContext) {
      audioContext.close()
      audioContext = null
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop())
      mediaStream = null
    }

    isRecording.value = false
    audioLevel.value = 0
  }

  function updateAudioLevel() {
    if (!analyser || !isRecording.value) return

    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(dataArray)

    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
    audioLevel.value = Math.min(100, (average / 128) * 100)

    animationFrame = requestAnimationFrame(updateAudioLevel)
  }

  async function handleTogglePreview() {
    if (isPreviewing.value) {
      stopPreview()
    } else {
      await startPreview()
    }
  }

  async function startPreview() {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          ...(videoInputId.value ? { deviceId: { exact: videoInputId.value } } : {})
        }
      }

      mediaStream = await navigator.mediaDevices.getUserMedia(constraints)

      if (options.videoPreviewRef.value) {
        options.videoPreviewRef.value.srcObject = mediaStream
      }

      isPreviewing.value = true
      options.feedback.previewStarted()
    } catch (error) {
      logger.error('Failed to start video preview', error)
      options.feedback.previewFailed()
    }
  }

  function stopPreview() {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop())
      mediaStream = null
    }

    if (options.videoPreviewRef.value) {
      options.videoPreviewRef.value.srcObject = null
    }

    isPreviewing.value = false
  }

  return {
    devicesLoading,
    isRecording,
    isPreviewing,
    audioLevel,
    audioInputId,
    videoInputId,
    echoCancellation,
    noiseSuppression,
    autoGainControl,
    audioInputDevices,
    videoInputDevices,
    audioInputOptions,
    videoInputOptions,
    audioInputName,
    videoInputName,
    loadDevices,
    loadSavedSettings,
    selectAudioInput,
    selectVideoInput,
    handleEchoCancellationChange,
    handleNoiseSuppressionChange,
    handleAutoGainChange,
    handleTestAudio,
    startAudioTest,
    stopAudioTest,
    handleTogglePreview,
    startPreview,
    stopPreview
  }
}
