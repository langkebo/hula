<template>
  <div class="voice-video-settings">
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.voice_video.audio_section') }}</h3>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.voice_video.audio_input_label') }}</span>
          <span class="setting-desc">{{ t('setting.voice_video.audio_input_desc') }}</span>
        </div>
        <n-select
          v-model:value="audioInputId"
          :options="audioInputOptions"
          :loading="devicesLoading"
          :placeholder="t('setting.voice_video.select_microphone')"
          class="device-select-width"
          @update:value="handleAudioInputChange" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.voice_video.audio_test_label') }}</span>
          <span class="setting-desc">{{ t('setting.voice_video.audio_test_desc') }}</span>
        </div>
        <n-button :type="isRecording ? 'error' : 'default'" :loading="testLoading" @click="handleTestAudio">
          {{ isRecording ? t('setting.voice_video.stop_test') : t('setting.voice_video.test_microphone') }}
        </n-button>
      </div>

      <div v-if="audioLevel > 0" class="audio-level-display">
        <div class="level-bar">
          <div class="level-fill" :style="{ width: `${audioLevel}%` }"></div>
        </div>
        <span class="level-text">
          {{ t('setting.voice_video.audio_level', { value: String(Math.round(audioLevel)) }) }}
        </span>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.voice_video.video_section') }}</h3>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.voice_video.video_input_label') }}</span>
          <span class="setting-desc">{{ t('setting.voice_video.video_input_desc') }}</span>
        </div>
        <n-select
          v-model:value="videoInputId"
          :options="videoInputOptions"
          :loading="devicesLoading"
          :placeholder="t('setting.voice_video.select_camera')"
          class="device-select-width"
          @update:value="handleVideoInputChange" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.voice_video.preview_label') }}</span>
          <span class="setting-desc">{{ t('setting.voice_video.preview_desc') }}</span>
        </div>
        <n-button :type="isPreviewing ? 'error' : 'default'" @click="handleTogglePreview">
          {{ isPreviewing ? t('setting.voice_video.stop_preview') : t('setting.voice_video.start_preview') }}
        </n-button>
      </div>

      <div v-if="isPreviewing" class="video-preview">
        <video ref="videoPreviewRef" autoplay muted playsinline class="preview-video"></video>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.voice_video.call_section') }}</h3>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.voice_video.echo_cancellation_label') }}</span>
          <span class="setting-desc">{{ t('setting.voice_video.echo_cancellation_desc') }}</span>
        </div>
        <n-switch v-model:value="echoCancellation" @update:value="handleEchoCancellationChange" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.voice_video.noise_suppression_label') }}</span>
          <span class="setting-desc">{{ t('setting.voice_video.noise_suppression_desc') }}</span>
        </div>
        <n-switch v-model:value="noiseSuppression" @update:value="handleNoiseSuppressionChange" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.voice_video.auto_gain_label') }}</span>
          <span class="setting-desc">{{ t('setting.voice_video.auto_gain_desc') }}</span>
        </div>
        <n-switch v-model:value="autoGainControl" @update:value="handleAutoGainChange" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NDivider, NSelect, NSwitch } from 'naive-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { loadMediaDevicePreferences, saveMediaDevicePreferences } from '@/services/media/mediaDevicePreferences'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('VoiceVideoSettings')

defineOptions({
  name: 'VoiceVideoSettings'
})

const { showFeedback } = useActionFeedback()
const { t } = useI18n()

const devicesLoading = ref(false)
const testLoading = ref(false)
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

const audioInputOptions = computed(() =>
  audioInputDevices.value.map((d) => ({
    label: d.label || t('setting.voice_video.microphone_fallback', { id: d.deviceId.slice(0, 8) }),
    value: d.deviceId
  }))
)

const videoInputOptions = computed(() =>
  videoInputDevices.value.map((d) => ({
    label: d.label || t('setting.voice_video.camera_fallback', { id: d.deviceId.slice(0, 8) }),
    value: d.deviceId
  }))
)

const videoPreviewRef = ref<HTMLVideoElement>()
let mediaStream: MediaStream | null = null
let audioContext: AudioContext | null = null
let analyser: AnalyserNode | null = null
let animationFrame: number | null = null

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

    audioInputDevices.value = devices.filter((d) => d.kind === 'audioinput')
    videoInputDevices.value = devices.filter((d) => d.kind === 'videoinput')

    if (audioInputOptions.value.length > 0 && !audioInputId.value) {
      audioInputId.value = audioInputOptions.value[0].value
    }
    if (videoInputOptions.value.length > 0 && !videoInputId.value) {
      videoInputId.value = videoInputOptions.value[0].value
    }
  } catch (error) {
    logger.error('Failed to load media devices', error)
    showFeedback(t('setting.voice_video.load_devices_failed'), 'error')
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

function handleAudioInputChange(value: string) {
  saveMediaDevicePreferences({ audioInputId: value })
}

function handleVideoInputChange(value: string) {
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
        deviceId: audioInputId.value ? { exact: audioInputId.value } : undefined,
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
    showFeedback(t('setting.voice_video.microphone_test_started'), 'success')
  } catch (error) {
    logger.warn('Failed to start microphone test', error)
    showFeedback(t('setting.voice_video.microphone_access_failed'), 'error')
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

  const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
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
        deviceId: videoInputId.value ? { exact: videoInputId.value } : undefined
      }
    }

    mediaStream = await navigator.mediaDevices.getUserMedia(constraints)

    if (videoPreviewRef.value) {
      videoPreviewRef.value.srcObject = mediaStream
    }

    isPreviewing.value = true
    showFeedback(t('setting.voice_video.preview_started'), 'success')
  } catch (error) {
    logger.error('Failed to start video preview', error)
    showFeedback(t('setting.voice_video.camera_access_failed'), 'error')
  }
}

function stopPreview() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop())
    mediaStream = null
  }

  if (videoPreviewRef.value) {
    videoPreviewRef.value.srcObject = null
  }

  isPreviewing.value = false
}
</script>

<style scoped>
.voice-video-settings {
  padding: 0 var(--tjg-space-2);
}

.settings-section {
  margin-bottom: var(--tjg-space-4);
}

.section-title {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  margin: 0 0 var(--tjg-space-4) 0;
  color: var(--tjg-text-primary);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--tjg-space-3) 0;
  border-bottom: 1px solid var(--tjg-settings-divider);
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-label {
  display: block;
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
}

.setting-desc {
  display: block;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
  margin-top: var(--tjg-space-1);
}

.audio-level-display {
  margin-top: var(--tjg-space-3);
  padding: var(--tjg-space-3);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-sm);
}

.level-bar {
  height: 8px;
  background-color: var(--tjg-settings-meter-bg);
  border-radius: var(--tjg-radius-xs);
  overflow: hidden;
}

.level-fill {
  height: 100%;
  background-color: var(--tjg-color-success-500);
  border-radius: var(--tjg-radius-xs);
  transition: width 0.1s ease;
}

.level-text {
  display: block;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
  margin-top: var(--tjg-space-2);
  text-align: center;
}

.video-preview {
  margin-top: var(--tjg-space-4);
  border-radius: var(--tjg-radius-sm);
  overflow: hidden;
  background-color: var(--tjg-surface-media-preview);
}

.preview-video {
  width: 100%;
  max-height: 240px;
  object-fit: cover;
}

/* 统一选择器宽度（避免每个 select 都内联 style） */
.device-select-width {
  width: 200px;
}

/* 音量滑杆宽度 */
</style>
