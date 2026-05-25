<template>
  <div class="voice-message-enhanced" :class="{ 'is-current-user': isCurrentUser }">
    <div class="voice-main" @click="handleTogglePlayback">
      <div class="voice-icon">
        <n-spin v-if="loading" :size="16" />
        <svg v-else-if="isPlaying" :style="{ color: iconColor }">
          <use href="#pause" />
        </svg>
        <svg v-else :style="{ color: iconColor }">
          <use href="#play" />
        </svg>
      </div>

      <div class="voice-waveform" ref="_waveformRef">
        <canvas ref="canvasRef" :width="waveformWidth" height="32" />
        <div class="progress-line" :style="{ left: `${progress * 100}%`, background: iconColor }" />
      </div>

      <div class="voice-duration" :style="{ color: iconColor }">
        {{ formatDuration(currentTime, duration) }}
      </div>
    </div>

    <div v-if="showControls" class="voice-controls">
      <n-popover trigger="click" placement="top">
        <template #trigger>
          <n-button size="tiny" quaternary circle>
            <template #icon>
              <n-icon size="14">
                <svg><use href="#speed" /></svg>
              </n-icon>
            </template>
          </n-button>
        </template>
        <n-flex vertical :size="4">
          <span class="text-12px text-gray-500">{{ t('voice.speed') }}</span>
          <n-flex :size="4">
            <n-button
              v-for="s in speedOptions"
              :key="s"
              :type="playbackSpeed === s ? 'primary' : 'default'"
              size="tiny"
              @click="handleSpeedChange(s)">
              {{ s }}x
            </n-button>
          </n-flex>
        </n-flex>
      </n-popover>

      <n-button v-if="transcriptionEnabled" size="tiny" quaternary circle @click="handleTranscribe">
        <template #icon>
          <n-icon size="14">
            <svg><use href="#text" /></svg>
          </n-icon>
        </template>
      </n-button>

      <n-button size="tiny" quaternary circle @click="handleDownload">
        <template #icon>
          <n-icon size="14">
            <svg><use href="#download" /></svg>
          </n-icon>
        </template>
      </n-button>
    </div>

    <div v-if="transcription && showTranscription" class="voice-transcription">
      <n-icon size="14" color="var(--color-primary)">
        <svg><use href="#text" /></svg>
      </n-icon>
      <span>{{ transcription }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixVoiceService } from '@/services/matrix/media/MatrixVoiceService'
import type { VoiceBody } from '@/services/types'
import { useUserStore } from '@/stores/domains/user/user'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('VoiceMessageEnhanced')

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const userStore = useUserStore()

const props = defineProps<{
  body: VoiceBody
  fromUserUid: string
  roomId: string
  messageId: string
  showControls?: boolean
  transcriptionEnabled?: boolean
}>()

const emit = defineEmits<(e: 'transcribed', text: string) => void>()

const canvasRef = ref<HTMLCanvasElement>()
const audioElement = ref<HTMLAudioElement | null>(null)

const loading = ref(false)
const isPlaying = ref(false)
const duration = ref(props.body.second || 0)
const currentTime = ref(0)
const progress = computed(() => (duration.value > 0 ? currentTime.value / duration.value : 0))
const playbackSpeed = ref(1)
const transcription = ref('')
const showTranscription = ref(false)

const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2]

const isCurrentUser = computed(() => props.fromUserUid === userStore.userInfo?.uid)
const iconColor = computed(() =>
  isCurrentUser.value
    ? '#fff'
    : getComputedStyle(document.documentElement).getPropertyValue('--voice-icon-color-other').trim() || '#000'
)

const waveformWidth = computed(() => {
  const baseWidth = 120
  const durationWidth = Math.min(props.body.second * 4, 200)
  return baseWidth + durationWidth
})

const formatDuration = (current: number, _total: number) => {
  const mins = Math.floor(current / 60)
  const secs = Math.floor(current % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const drawWaveform = () => {
  if (!canvasRef.value) return

  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return

  const width = canvasRef.value.width
  const height = canvasRef.value.height

  ctx.clearRect(0, 0, width, height)

  const barCount = Math.floor(width / 3)
  const barWidth = 2
  const gap = 1

  for (let i = 0; i < barCount; i++) {
    const x = i * (barWidth + gap)
    const barHeight = Math.random() * (height - 8) + 4
    const y = (height - barHeight) / 2

    const isPlayed = i / barCount <= progress.value
    ctx.fillStyle = isPlayed ? iconColor.value : iconColor.value + '60'

    ctx.beginPath()
    ctx.roundRect(x, y, barWidth, barHeight, 1)
    ctx.fill()
  }
}

const handleTogglePlayback = async () => {
  if (!audioElement.value) {
    await initAudio()
  }

  if (audioElement.value) {
    if (isPlaying.value) {
      audioElement.value.pause()
      isPlaying.value = false
    } else {
      await audioElement.value.play()
      isPlaying.value = true
    }
  }
}

const initAudio = async () => {
  loading.value = true
  try {
    const voice = await matrixVoiceService.getVoice(props.roomId, props.messageId)
    const playableUrl = voice?.httpUrl || voice?.mxcUrl
    if (playableUrl) {
      audioElement.value = new Audio(playableUrl)
      audioElement.value.playbackRate = playbackSpeed.value

      audioElement.value.addEventListener('timeupdate', () => {
        currentTime.value = audioElement.value?.currentTime || 0
        drawWaveform()
      })

      audioElement.value.addEventListener('ended', () => {
        isPlaying.value = false
        currentTime.value = 0
        drawWaveform()
      })

      audioElement.value.addEventListener('loadedmetadata', () => {
        duration.value = audioElement.value?.duration || props.body.second
        drawWaveform()
      })
    }
  } catch (err) {
    logger.error('加载语音失败:', err)
  } finally {
    loading.value = false
  }
}

const handleSpeedChange = (speed: number) => {
  playbackSpeed.value = speed
  if (audioElement.value) {
    audioElement.value.playbackRate = speed
  }
}

const handleTranscribe = async () => {
  try {
    showTranscription.value = true
    const result = await matrixVoiceService.transcribeVoice({
      roomId: props.roomId,
      eventId: props.messageId
    })
    if (!result) {
      throw new Error('语音转写失败')
    }
    transcription.value = result.text
    emit('transcribed', result.text)
  } catch (err) {
    transcription.value = t('voice.transcription_failed')
  }
}

const handleDownload = async () => {
  try {
    const voice = await matrixVoiceService.getVoice(props.roomId, props.messageId)
    const downloadableUrl = voice?.httpUrl || voice?.mxcUrl
    if (downloadableUrl) {
      const response = await fetch(downloadableUrl)
      const blob = await response.blob()

      const filePath = await save({
        defaultPath: `voice_${props.messageId}.mp3`,
        filters: [{ name: 'Audio', extensions: ['mp3', 'ogg', 'wav'] }]
      })

      if (filePath) {
        const buffer = await blob.arrayBuffer()
        await writeFile(filePath, new Uint8Array(buffer))
        showFeedback(t('voice.download_success'), 'success')
      }
    }
  } catch (err) {
    showFeedback(t('voice.download_failed'), 'error')
  }
}

watch(progress, () => {
  drawWaveform()
})

onMounted(() => {
  drawWaveform()
})

onUnmounted(() => {
  if (audioElement.value) {
    audioElement.value.pause()
    audioElement.value = null
  }
})
</script>

<style scoped lang="scss">
.voice-message-enhanced {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 12px;
  background: var(--hula-surface-app);
  min-width: 200px;

  &.is-current-user {
    background: var(--color-primary-hover);
  }
}

.voice-main {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.voice-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 18px;
    height: 18px;
  }
}

.voice-waveform {
  flex: 1;
  position: relative;
  height: 32px;

  canvas {
    width: 100%;
    height: 100%;
  }

  .progress-line {
    position: absolute;
    top: 0;
    width: 2px;
    height: 100%;
    pointer-events: none;
    transition: left 0.1s linear;
  }
}

.voice-duration {
  font-size: 12px;
  white-space: nowrap;
  min-width: 40px;
  text-align: right;
}

.voice-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--border-color);
}

.voice-transcription {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 8px;
  background: var(--hula-surface-app);
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.4;
}
</style>
