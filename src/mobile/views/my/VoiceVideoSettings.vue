<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_voice_video.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <div class="text-14px text-gray-500 mb-8px">{{ t('mobile_voice_video.audio_section') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_voice_video.audio_input')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-blue-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:microphone" :width="20" color="#1989fa" />
                </div>
              </template>
              <template #right-icon>
                <van-picker-group>
                  <van-field v-model="audioInputName" readonly is-link @click="showAudioInputPicker = true" />
                </van-picker-group>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_voice_video.audio_output')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-green-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:speaker" :width="20" color="#52c41a" />
                </div>
              </template>
              <template #right-icon>
                <van-field v-model="audioOutputName" readonly is-link @click="showAudioOutputPicker = true" />
              </template>
            </van-cell>
          </van-cell-group>

          <van-cell-group inset>
            <van-cell :title="t('mobile_voice_video.input_volume')">
              <template #value>
                <van-slider v-model="inputVolume" :min="0" :max="100" class="w-100px" />
                <span class="ml-8px text-12px text-gray-500">{{ inputVolume }}%</span>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_voice_video.output_volume')">
              <template #value>
                <van-slider v-model="outputVolume" :min="0" :max="100" class="w-100px" />
                <span class="ml-8px text-12px text-gray-500">{{ outputVolume }}%</span>
              </template>
            </van-cell>
          </van-cell-group>

          <van-cell-group inset>
            <van-cell :title="t('mobile_voice_video.test_microphone')">
              <template #right-icon>
                <van-button
                  :type="isRecording ? 'danger' : 'default'"
                  size="small"
                  :loading="testLoading"
                  @click="handleTestAudio">
                  {{ isRecording ? t('mobile_voice_video.stop') : t('mobile_voice_video.test') }}
                </van-button>
              </template>
            </van-cell>
          </van-cell-group>

          <div v-if="audioLevel > 0" class="px-16px">
            <div class="h-8px bg-gray-200 rounded-full overflow-hidden">
              <div
                class="h-full bg-green-500 rounded-full transition-all duration-100"
                :style="{ width: `${audioLevel}%` }"></div>
            </div>
            <div class="text-12px text-gray-500 text-center mt-4px">
              {{ t('mobile_voice_video.level') }}: {{ Math.round(audioLevel) }}%
            </div>
          </div>

          <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_voice_video.video_section') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_voice_video.video_input')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-purple-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:video" :width="20" color="#722ed1" />
                </div>
              </template>
              <template #right-icon>
                <van-field v-model="videoInputName" readonly is-link @click="showVideoInputPicker = true" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_voice_video.video_preview')">
              <template #right-icon>
                <van-button :type="isPreviewing ? 'danger' : 'default'" size="small" @click="handleTogglePreview">
                  {{ isPreviewing ? t('mobile_voice_video.stop') : t('mobile_voice_video.preview') }}
                </van-button>
              </template>
            </van-cell>
          </van-cell-group>

          <div v-if="isPreviewing" class="px-16px">
            <video ref="videoPreviewRef" autoplay muted playsinline class="w-full rounded-lg bg-black"></video>
          </div>

          <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_voice_video.call_section') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_voice_video.echo_cancellation')">
              <template #right-icon>
                <van-switch v-model="echoCancellation" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_voice_video.noise_suppression')">
              <template #right-icon>
                <van-switch v-model="noiseSuppression" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_voice_video.auto_gain')">
              <template #right-icon>
                <van-switch v-model="autoGainControl" />
              </template>
            </van-cell>
          </van-cell-group>
        </div>
      </div>

      <van-popup v-model:show="showAudioInputPicker" position="bottom" round>
        <van-picker
          :columns="audioInputOptions"
          @confirm="onAudioInputConfirm"
          @cancel="showAudioInputPicker = false" />
      </van-popup>

      <van-popup v-model:show="showAudioOutputPicker" position="bottom" round>
        <van-picker
          :columns="audioOutputOptions"
          @confirm="onAudioOutputConfirm"
          @cancel="showAudioOutputPicker = false" />
      </van-popup>

      <van-popup v-model:show="showVideoInputPicker" position="bottom" round>
        <van-picker
          :columns="videoInputOptions"
          @confirm="onVideoInputConfirm"
          @cancel="showVideoInputPicker = false" />
      </van-popup>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { createLogger } from '@/utils/Logger'
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { showToast } from 'vant'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'

const logger = createLogger('VoiceVideoSettings')
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

const showAudioInputPicker = ref(false)
const showAudioOutputPicker = ref(false)
const showVideoInputPicker = ref(false)

const audioInputDevices = ref<MediaDeviceInfo[]>([])
const audioOutputDevices = ref<MediaDeviceInfo[]>([])
const videoInputDevices = ref<MediaDeviceInfo[]>([])

const audioInputOptions = computed(() =>
  audioInputDevices.value.map((d) => ({
    text: d.label || `麦克风 ${d.deviceId.slice(0, 8)}`,
    value: d.deviceId
  }))
)

const audioOutputOptions = computed(() =>
  audioOutputDevices.value.map((d) => ({
    text: d.label || `扬声器 ${d.deviceId.slice(0, 8)}`,
    value: d.deviceId
  }))
)

const videoInputOptions = computed(() =>
  videoInputDevices.value.map((d) => ({
    text: d.label || `摄像头 ${d.deviceId.slice(0, 8)}`,
    value: d.deviceId
  }))
)

const audioInputName = computed(() => {
  const device = audioInputDevices.value.find((d) => d.deviceId === audioInputId.value)
  return device?.label || t('mobile_voice_video.select_device')
})

const audioOutputName = computed(() => {
  const device = audioOutputDevices.value.find((d) => d.deviceId === audioOutputId.value)
  return device?.label || t('mobile_voice_video.select_device')
})

const videoInputName = computed(() => {
  const device = videoInputDevices.value.find((d) => d.deviceId === videoInputId.value)
  return device?.label || t('mobile_voice_video.select_device')
})

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

    if (audioInputDevices.value.length > 0 && !audioInputId.value) {
      audioInputId.value = audioInputDevices.value[0].deviceId
    }
    if (audioOutputDevices.value.length > 0 && !audioOutputId.value) {
      audioOutputId.value = audioOutputDevices.value[0].deviceId
    }
    if (videoInputDevices.value.length > 0 && !videoInputId.value) {
      videoInputId.value = videoInputDevices.value[0].deviceId
    }
  } catch (error) {
    logger.error('获取设备列表失败:', error)
    showToast({
      type: 'fail',
      message: t('mobile_voice_video.device_error')
    })
  } finally {
    devicesLoading.value = false
  }
}

function loadSavedSettings() {
  const savedInputVolume = localStorage.getItem('hula-input-volume')
  if (savedInputVolume) inputVolume.value = parseInt(savedInputVolume, 10)

  const savedOutputVolume = localStorage.getItem('hula-output-volume')
  if (savedOutputVolume) outputVolume.value = parseInt(savedOutputVolume, 10)

  const savedEcho = localStorage.getItem('hula-echo-cancellation')
  if (savedEcho) echoCancellation.value = savedEcho === 'true'

  const savedNoise = localStorage.getItem('hula-noise-suppression')
  if (savedNoise) noiseSuppression.value = savedNoise === 'true'

  const savedAutoGain = localStorage.getItem('hula-auto-gain')
  if (savedAutoGain) autoGainControl.value = savedAutoGain === 'true'
}

function onAudioInputConfirm({ selectedOptions }: any) {
  audioInputId.value = selectedOptions[0].value
  localStorage.setItem('hula-audio-input', audioInputId.value!)
  showAudioInputPicker.value = false
}

function onAudioOutputConfirm({ selectedOptions }: any) {
  audioOutputId.value = selectedOptions[0].value
  localStorage.setItem('hula-audio-output', audioOutputId.value!)
  showAudioOutputPicker.value = false
}

function onVideoInputConfirm({ selectedOptions }: any) {
  videoInputId.value = selectedOptions[0].value
  localStorage.setItem('hula-video-input', videoInputId.value!)
  showVideoInputPicker.value = false
  if (isPreviewing.value) {
    stopPreview()
    startPreview()
  }
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
    showToast({
      type: 'success',
      message: t('mobile_voice_video.test_started')
    })
  } catch (error) {
    logger.error('麦克风测试失败:', error)
    showToast({
      type: 'fail',
      message: t('mobile_voice_video.mic_error')
    })
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
    showToast({
      type: 'success',
      message: t('mobile_voice_video.preview_started')
    })
  } catch (error) {
    logger.error('视频预览失败:', error)
    showToast({
      type: 'fail',
      message: t('mobile_voice_video.camera_error')
    })
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

<style scoped></style>
