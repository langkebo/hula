<template>
  <div class="voice-video-settings">
    <div class="settings-section">
      <h3 class="section-title">音频设置</h3>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">音频输入设备</span>
          <span class="setting-desc">选择用于语音通话的麦克风</span>
        </div>
        <n-select
          v-model:value="audioInputId"
          :options="audioInputOptions"
          :loading="devicesLoading"
          placeholder="选择麦克风"
          style="width: 200px"
          @update:value="handleAudioInputChange" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">音频输出设备</span>
          <span class="setting-desc">选择用于播放声音的扬声器</span>
        </div>
        <n-select
          v-model:value="audioOutputId"
          :options="audioOutputOptions"
          :loading="devicesLoading"
          placeholder="选择扬声器"
          style="width: 200px"
          @update:value="handleAudioOutputChange" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">输入音量</span>
          <span class="setting-desc">调整麦克风音量</span>
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
          <span class="setting-label">输出音量</span>
          <span class="setting-desc">调整扬声器音量</span>
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
          <span class="setting-label">音频测试</span>
          <span class="setting-desc">测试麦克风是否正常工作</span>
        </div>
        <n-button :type="isRecording ? 'error' : 'default'" :loading="testLoading" @click="handleTestAudio">
          {{ isRecording ? '停止测试' : '测试麦克风' }}
        </n-button>
      </div>

      <div v-if="audioLevel > 0" class="audio-level-display">
        <div class="level-bar">
          <div class="level-fill" :style="{ width: `${audioLevel}%` }"></div>
        </div>
        <span class="level-text">音量级别: {{ Math.round(audioLevel) }}%</span>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">视频设置</h3>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">视频输入设备</span>
          <span class="setting-desc">选择用于视频通话的摄像头</span>
        </div>
        <n-select
          v-model:value="videoInputId"
          :options="videoInputOptions"
          :loading="devicesLoading"
          placeholder="选择摄像头"
          style="width: 200px"
          @update:value="handleVideoInputChange" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">视频预览</span>
          <span class="setting-desc">预览摄像头画面</span>
        </div>
        <n-button :type="isPreviewing ? 'error' : 'default'" @click="handleTogglePreview">
          {{ isPreviewing ? '停止预览' : '开始预览' }}
        </n-button>
      </div>

      <div v-if="isPreviewing" class="video-preview">
        <video ref="videoPreviewRef" autoplay muted playsinline class="preview-video"></video>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">通话设置</h3>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">回声消除</span>
          <span class="setting-desc">消除通话中的回声</span>
        </div>
        <n-switch v-model:value="echoCancellation" @update:value="handleEchoCancellationChange" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">噪声抑制</span>
          <span class="setting-desc">降低背景噪声</span>
        </div>
        <n-switch v-model:value="noiseSuppression" @update:value="handleNoiseSuppressionChange" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">自动增益</span>
          <span class="setting-desc">自动调整麦克风音量</span>
        </div>
        <n-switch v-model:value="autoGainControl" @update:value="handleAutoGainChange" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { NSelect, NSlider, NButton, NSwitch, NDivider, useMessage } from 'naive-ui'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('VoiceVideoSettings')

defineOptions({
  name: 'VoiceVideoSettings'
})

const message = useMessage()

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

const audioInputOptions = ref<Array<{ label: string; value: string }>>([])
const audioOutputOptions = ref<Array<{ label: string; value: string }>>([])
const videoInputOptions = ref<Array<{ label: string; value: string }>>([])

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

    audioInputOptions.value = devices
      .filter((d) => d.kind === 'audioinput')
      .map((d) => ({
        label: d.label || `麦克风 ${d.deviceId.slice(0, 8)}`,
        value: d.deviceId
      }))

    audioOutputOptions.value = devices
      .filter((d) => d.kind === 'audiooutput')
      .map((d) => ({
        label: d.label || `扬声器 ${d.deviceId.slice(0, 8)}`,
        value: d.deviceId
      }))

    videoInputOptions.value = devices
      .filter((d) => d.kind === 'videoinput')
      .map((d) => ({
        label: d.label || `摄像头 ${d.deviceId.slice(0, 8)}`,
        value: d.deviceId
      }))

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
    logger.error('获取设备列表失败:', error)
    message.error('获取设备列表失败，请检查权限')
  } finally {
    devicesLoading.value = false
  }
}

function loadSavedSettings() {
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
    message.success('麦克风测试已开始')
  } catch (error) {
    logger.error('麦克风测试失败:', error)
    message.error('无法访问麦克风，请检查权限')
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
    message.success('视频预览已开始')
  } catch (error) {
    logger.error('视频预览失败:', error)
    message.error('无法访问摄像头，请检查权限')
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
  padding: 0;
}

.settings-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
  margin: 0 0 16px 0;
  color: var(--text-color, #1a1a1a);
}

:deep(.dark) .section-title {
  color: #fff;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-label {
  display: block;
  font-size: 14px;
  color: var(--text-color, #1a1a1a);
}

:deep(.dark) .setting-label {
  color: #fff;
}

.setting-desc {
  display: block;
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.volume-value {
  font-size: 12px;
  color: #999;
  min-width: 40px;
}

.audio-level-display {
  margin-top: 12px;
  padding: 12px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

:deep(.dark) .audio-level-display {
  background-color: rgba(255, 255, 255, 0.05);
}

.level-bar {
  height: 8px;
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

:deep(.dark) .level-bar {
  background-color: rgba(255, 255, 255, 0.1);
}

.level-fill {
  height: 100%;
  background-color: #52c41a;
  border-radius: 4px;
  transition: width 0.1s ease;
}

.level-text {
  display: block;
  font-size: 12px;
  color: #999;
  margin-top: 8px;
  text-align: center;
}

.video-preview {
  margin-top: 16px;
  border-radius: 8px;
  overflow: hidden;
  background-color: #000;
}

.preview-video {
  width: 100%;
  max-height: 240px;
  object-fit: cover;
}
</style>
