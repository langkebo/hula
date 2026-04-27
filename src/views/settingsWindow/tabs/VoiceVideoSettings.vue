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
          style="width: 200px"
          @update:value="handleAudioInputChange" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.voice_video.audio_output_label') }}</span>
          <span class="setting-desc">{{ t('setting.voice_video.audio_output_desc') }}</span>
        </div>
        <n-select
          v-model:value="audioOutputId"
          :options="audioOutputOptions"
          :loading="devicesLoading"
          :placeholder="t('setting.voice_video.select_speaker')"
          style="width: 200px"
          @update:value="handleAudioOutputChange" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.voice_video.input_volume_label') }}</span>
          <span class="setting-desc">{{ t('setting.voice_video.input_volume_desc') }}</span>
        </div>
        <div class="volume-control">
          <n-slider
            v-model:value="inputVolume"
            :min="0"
            :max="100"
            :step="1"
            style="width: 150px"
            @update:value="handleInputVolumeChange" />
          <span class="volume-value">{{ inputVolume }}%</span>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.voice_video.output_volume_label') }}</span>
          <span class="setting-desc">{{ t('setting.voice_video.output_volume_desc') }}</span>
        </div>
        <div class="volume-control">
          <n-slider
            v-model:value="outputVolume"
            :min="0"
            :max="100"
            :step="1"
            style="width: 150px"
            @update:value="handleOutputVolumeChange" />
          <span class="volume-value">{{ outputVolume }}%</span>
        </div>
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
          style="width: 200px"
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
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSelect, NSlider, NButton, NSwitch, NDivider, useMessage } from 'naive-ui'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('VoiceVideoSettings')

defineOptions({
  name: 'VoiceVideoSettings'
})

const message = useMessage()
const { t } = useI18n()

const devicesLoading = ref(false)
const testLoading = ref(false)
const isRecording = ref(false)
const isPreviewing = ref(false)
const audioLevel = ref(0)

const audioInputId = ref<string | null>(null)
const audioOutputId = ref<string | null>(null)
const videoInputId = ref<string | null>(null)
const inputVolume = ref(100)
const outputVolume = ref(100)
const echoCancellation = ref(true)
const noiseSuppression = ref(true)
const autoGainControl = ref(true)

const audioInputDevices = ref<MediaDeviceInfo[]>([])
const audioOutputDevices = ref<MediaDeviceInfo[]>([])
const videoInputDevices = ref<MediaDeviceInfo[]>([])

const audioInputOptions = computed(() =>
  audioInputDevices.value.map((d) => ({
    label: d.label || t('setting.voice_video.microphone_fallback', { id: d.deviceId.slice(0, 8) }),
    value: d.deviceId
  }))
)

const audioOutputOptions = computed(() =>
  audioOutputDevices.value.map((d) => ({
    label: d.label || t('setting.voice_video.speaker_fallback', { id: d.deviceId.slice(0, 8) }),
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
    audioOutputDevices.value = devices.filter((d) => d.kind === 'audiooutput')
    videoInputDevices.value = devices.filter((d) => d.kind === 'videoinput')

    if (audioInputOptions.value.length > 0 && !audioInputId.value) {
      audioInputId.value = audioInputOptions.value[0].value
    }
    if (audioOutputOptions.value.length > 0 && !audioOutputId.value) {
      audioOutputId.value = audioOutputOptions.value[0].value
    }
    if (videoInputOptions.value.length > 0 && !videoInputId.value) {
      videoInputId.value = videoInputOptions.value[0].value
    }
  } catch (error) {
    logger.error('Failed to load media devices', error)
    message.error(t('setting.voice_video.load_devices_failed'))
  } finally {
    devicesLoading.value = false
  }
}

function loadSavedSettings() {
  const savedAudioInput = localStorage.getItem('hula-audio-input')
  if (savedAudioInput) {
    audioInputId.value = savedAudioInput
  }

  const savedAudioOutput = localStorage.getItem('hula-audio-output')
  if (savedAudioOutput) {
    audioOutputId.value = savedAudioOutput
  }

  const savedVideoInput = localStorage.getItem('hula-video-input')
  if (savedVideoInput) {
    videoInputId.value = savedVideoInput
  }

  const savedInputVolume = localStorage.getItem('hula-input-volume')
  if (savedInputVolume) {
    inputVolume.value = parseInt(savedInputVolume, 10)
  }

  const savedOutputVolume = localStorage.getItem('hula-output-volume')
  if (savedOutputVolume) {
    outputVolume.value = parseInt(savedOutputVolume, 10)
  }

  const savedEcho = localStorage.getItem('hula-echo-cancellation')
  if (savedEcho) {
    echoCancellation.value = savedEcho === 'true'
  }

  const savedNoise = localStorage.getItem('hula-noise-suppression')
  if (savedNoise) {
    noiseSuppression.value = savedNoise === 'true'
  }

  const savedAutoGain = localStorage.getItem('hula-auto-gain')
  if (savedAutoGain) {
    autoGainControl.value = savedAutoGain === 'true'
  }
}

function handleAudioInputChange(value: string) {
  localStorage.setItem('hula-audio-input', value)
}

function handleAudioOutputChange(value: string) {
  localStorage.setItem('hula-audio-output', value)
}

function handleVideoInputChange(value: string) {
  localStorage.setItem('hula-video-input', value)
  if (isPreviewing.value) {
    stopPreview()
    startPreview()
  }
}

function handleInputVolumeChange(value: number) {
  localStorage.setItem('hula-input-volume', value.toString())
}

function handleOutputVolumeChange(value: number) {
  localStorage.setItem('hula-output-volume', value.toString())
}

function handleEchoCancellationChange(value: boolean) {
  localStorage.setItem('hula-echo-cancellation', value.toString())
}

function handleNoiseSuppressionChange(value: boolean) {
  localStorage.setItem('hula-noise-suppression', value.toString())
}

function handleAutoGainChange(value: boolean) {
  localStorage.setItem('hula-auto-gain', value.toString())
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
    message.success(t('setting.voice_video.microphone_test_started'))
  } catch (error) {
    logger.error('Failed to start microphone test', error)
    message.error(t('setting.voice_video.microphone_access_failed'))
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
    message.success(t('setting.voice_video.preview_started'))
  } catch (error) {
    logger.error('Failed to start video preview', error)
    message.error(t('setting.voice_video.camera_access_failed'))
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
  padding: 0 var(--hula-space-2);
}

.settings-section {
  margin-bottom: var(--hula-space-4);
}

.section-title {
  font-size: var(--hula-font-size-lg);
  font-weight: var(--hula-font-weight-medium);
  margin: 0 0 var(--hula-space-4) 0;
  color: var(--hula-text-primary);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--hula-space-3) 0;
  border-bottom: 1px solid var(--hula-settings-divider);
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-label {
  display: block;
  font-size: var(--hula-font-size-base);
  color: var(--hula-text-primary);
}

.setting-desc {
  display: block;
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
  margin-top: var(--hula-space-1);
}

.volume-control {
  display: flex;
  align-items: center;
  gap: var(--hula-space-3);
}

.volume-value {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
  min-width: 40px;
}

.audio-level-display {
  margin-top: var(--hula-space-3);
  padding: var(--hula-space-3);
  background-color: var(--hula-settings-card-bg);
  border-radius: var(--hula-radius-sm);
}

.level-bar {
  height: 8px;
  background-color: var(--hula-settings-meter-bg);
  border-radius: var(--hula-radius-xs);
  overflow: hidden;
}

.level-fill {
  height: 100%;
  background-color: var(--hula-color-success-500);
  border-radius: var(--hula-radius-xs);
  transition: width 0.1s ease;
}

.level-text {
  display: block;
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
  margin-top: var(--hula-space-2);
  text-align: center;
}

.video-preview {
  margin-top: var(--hula-space-4);
  border-radius: var(--hula-radius-sm);
  overflow: hidden;
  background-color: var(--hula-surface-media-preview);
}

.preview-video {
  width: 100%;
  max-height: 240px;
  object-fit: cover;
}
</style>
