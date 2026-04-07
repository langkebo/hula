<template>
  <div class="voice-recorder-enhanced">
    <div class="recorder-main">
      <div class="status-display">
        <template v-if="!isRecording && !audioBlob && !isUploading">
          <span class="hint-text">
            {{ t('voice.recorder.hint') }}
          </span>
        </template>

        <template v-else-if="isRecording">
          <div class="recording-indicator">
            <div class="pulse-ring" />
            <div class="pulse-dot" />
          </div>
          <span class="recording-time">{{ formatTime(recordingTime) }}</span>
          <div class="volume-meter">
            <div v-for="i in 5" :key="i" class="volume-bar" :class="{ active: volumeLevel >= i * 20 }" />
          </div>
        </template>

        <template v-else-if="isUploading">
          <n-progress
            type="circle"
            :percentage="uploadProgress"
            :stroke-width="16"
            :show-indicator="false"
            style="width: 40px; height: 40px" />
          <span>{{ t('voice.recorder.uploading') }}</span>
        </template>

        <template v-else-if="audioBlob">
          <div class="preview-controls">
            <n-button circle size="small" @click="togglePreview">
              <template #icon>
                <n-icon>
                  <svg><use :href="isPreviewPlaying ? '#pause' : '#play'" /></svg>
                </n-icon>
              </template>
            </n-button>
            <span class="preview-duration">{{ formatTime(recordingDuration) }}</span>
          </div>
        </template>
      </div>

      <div class="controls">
        <template v-if="!isRecording && !audioBlob && !isUploading">
          <n-button
            type="primary"
            circle
            size="large"
            @mousedown="startRecording"
            @mouseup="stopRecording"
            @mouseleave="stopRecording"
            @touchstart.prevent="startRecording"
            @touchend.prevent="stopRecording">
            <template #icon>
              <n-icon size="24">
                <svg><use href="#microphone" /></svg>
              </n-icon>
            </template>
          </n-button>
          <n-button quaternary circle size="small" @click="handleCancel">
            <template #icon>
              <n-icon>
                <svg><use href="#close" /></svg>
              </n-icon>
            </template>
          </n-button>
        </template>

        <template v-else-if="isRecording">
          <n-button type="error" circle size="large" @click="stopRecording">
            <template #icon>
              <n-icon size="24">
                <svg><use href="#stop" /></svg>
              </n-icon>
            </template>
          </n-button>
          <n-button quaternary circle size="small" @click="cancelRecording">
            <template #icon>
              <n-icon>
                <svg><use href="#close" /></svg>
              </n-icon>
            </template>
          </n-button>
        </template>

        <template v-else-if="audioBlob && !isUploading">
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button quaternary circle size="small" @click="reRecord">
                <template #icon>
                  <n-icon>
                    <svg><use href="#refresh" /></svg>
                  </n-icon>
                </template>
              </n-button>
            </template>
            {{ t('voice.recorder.rerecord') }}
          </n-tooltip>

          <n-button type="primary" :loading="sending" @click="handleSend">
            <template #icon>
              <n-icon>
                <svg><use href="#send" /></svg>
              </n-icon>
            </template>
            {{ t('voice.recorder.send') }}
          </n-button>

          <n-button quaternary circle size="small" @click="handleCancel">
            <template #icon>
              <n-icon>
                <svg><use href="#close" /></svg>
              </n-icon>
            </template>
          </n-button>
        </template>
      </div>
    </div>

    <div v-if="error" class="error-message">
      <n-icon color="#e74c3c">
        <svg><use href="#warning" /></svg>
      </n-icon>
      <span>{{ error }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { matrixVoiceService, type VoiceUploadProgress } from '@/services/matrix/MatrixVoiceService'
import { info, error as logError } from '@tauri-apps/plugin-log'
import { useTimerManager } from '@/utils/TimerManager'

const { t } = useI18n()
const timerManager = useTimerManager()

const props = defineProps<{
  roomId: string
  maxDuration?: number
}>()

const emit = defineEmits<{
  (e: 'cancel'): void
  (
    e: 'send',
    data: {
      mxcUrl: string
      duration: number
      size: number
      filename: string
    }
  ): void
}>()

const isRecording = ref(false)
const isUploading = ref(false)
const uploadProgress = ref(0)
const audioBlob = ref<Blob | null>(null)
const recordingTime = ref(0)
const recordingDuration = ref(0)
const volumeLevel = ref(0)
const isPreviewPlaying = ref(false)
const sending = ref(false)
const error = ref('')

let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let audioContext: AudioContext | null = null
let analyser: AnalyserNode | null = null
let previewAudio: HTMLAudioElement | null = null
let recordingInterval: number | null = null

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const startRecording = async () => {
  try {
    error.value = ''
    audioChunks = []

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    audioContext = new AudioContext()
    analyser = audioContext.createAnalyser()
    const source = audioContext.createMediaStreamSource(stream)
    source.connect(analyser)
    analyser.fftSize = 256

    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    })

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunks.push(e.data)
      }
    }

    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop())
      audioBlob.value = new Blob(audioChunks, { type: 'audio/webm' })
      recordingDuration.value = recordingTime.value
      isRecording.value = false

      if (recordingInterval) {
        clearInterval(recordingInterval)
        recordingInterval = null
      }
    }

    mediaRecorder.start(100)
    isRecording.value = true
    recordingTime.value = 0

    recordingInterval = timerManager.setInterval(() => {
      recordingTime.value++

      if (analyser) {
        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        volumeLevel.value = Math.min(100, Math.round((average / 255) * 100))
      }
    }, 1000)

    info('[VoiceRecorder] 开始录音')
  } catch (err) {
    error.value = t('voice.recorder.permission_denied')
    logError(`[VoiceRecorder] 录音权限被拒绝: ${err}`)
  }
}

const stopRecording = () => {
  if (mediaRecorder && isRecording.value) {
    mediaRecorder.stop()
    info('[VoiceRecorder] 停止录音')
  }
}

const cancelRecording = () => {
  if (mediaRecorder && isRecording.value) {
    mediaRecorder.stop()
  }
  resetState()
}

const reRecord = () => {
  resetState()
}

const togglePreview = () => {
  if (!audioBlob.value) return

  if (isPreviewPlaying.value) {
    previewAudio?.pause()
    isPreviewPlaying.value = false
  } else {
    if (!previewAudio) {
      previewAudio = new Audio(URL.createObjectURL(audioBlob.value))
      previewAudio.onended = () => {
        isPreviewPlaying.value = false
      }
    }
    previewAudio.play()
    isPreviewPlaying.value = true
  }
}

const handleSend = async () => {
  if (!audioBlob.value) return

  sending.value = true
  isUploading.value = true

  try {
    const arrayBuffer = await audioBlob.value.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    const result = await matrixVoiceService.uploadVoice(
      props.roomId,
      new Blob([uint8Array.buffer], { type: 'audio/webm' })
    )

    emit('send', {
      type: 'm.voice',
      content: {
        msgtype: 'm.audio',
        body: `Voice message (${recordingDuration.value}s)`,
        url: result.content_uri,
        info: {
          duration: recordingDuration.value,
          mimetype: 'audio/webm',
          size: audioBlob.value.size
        }
      }
    } as any)

    info(`[VoiceRecorder] 语音上传成功: ${result.content_uri}`)
    resetState()
  } catch (err) {
    error.value = t('voice.recorder.upload_failed')
    logError(`[VoiceRecorder] 上传失败: ${err}`)
  } finally {
    sending.value = false
    isUploading.value = false
    uploadProgress.value = 0
  }
}

const handleCancel = () => {
  resetState()
  emit('cancel')
}

const resetState = () => {
  audioBlob.value = null
  recordingTime.value = 0
  recordingDuration.value = 0
  volumeLevel.value = 0
  error.value = ''

  if (previewAudio) {
    previewAudio.pause()
    URL.revokeObjectURL(previewAudio.src)
    previewAudio = null
  }

  if (recordingInterval) {
    timerManager.clearInterval(recordingInterval)
    recordingInterval = null
  }
}

onUnmounted(() => {
  resetState()
  if (audioContext) {
    audioContext.close()
  }
  timerManager.clearAll()
})
</script>

<style scoped lang="scss">
.voice-recorder-enhanced {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--bg-color);
  border-radius: 12px;
  min-width: 280px;
}

.recorder-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.status-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 40px;
}

.hint-text {
  color: var(--text-color-3);
  font-size: 14px;
}

.recording-indicator {
  position: relative;
  width: 16px;
  height: 16px;

  .pulse-ring {
    position: absolute;
    inset: -4px;
    border: 2px solid #e74c3c;
    border-radius: 50%;
    animation: pulse-ring 1.5s infinite;
  }

  .pulse-dot {
    position: absolute;
    inset: 2px;
    background: #e74c3c;
    border-radius: 50%;
  }
}

.recording-time {
  font-size: 18px;
  font-weight: 600;
  color: #e74c3c;
  font-variant-numeric: tabular-nums;
}

.volume-meter {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 20px;

  .volume-bar {
    width: 4px;
    height: 4px;
    background: #ccc;
    border-radius: 2px;
    transition: height 0.1s;

    &.active {
      background: #13987f;
      height: 16px;
    }
  }
}

.preview-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-duration {
  font-size: 14px;
  color: var(--text-color);
}

.controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #e74c3c;
  font-size: 13px;
}

@keyframes pulse-ring {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
}
</style>
